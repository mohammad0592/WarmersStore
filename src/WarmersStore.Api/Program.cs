using System.IO.Compression;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Formatting.Compact;
using WarmersStore.Api.Common.Hosting;
using WarmersStore.Api.Features;
using WarmersStore.Api.Features.Admin;
using WarmersStore.Api.Features.Catalog;
using WarmersStore.Api.Features.CustomPackages;
using WarmersStore.Api.Features.Delivery;
using WarmersStore.Api.Features.Distributors;
using WarmersStore.Api.Features.Health;
using WarmersStore.Api.Features.Media;
using WarmersStore.Api.Features.Packages;
using WarmersStore.Api.Features.Settings;
using WarmersStore.Api.Features.Orders;
using WarmersStore.Api.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Railway (and similar hosts) tell the app which port to listen on via PORT.
if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port)
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// Requests here are small JSON; image uploads raise this limit on their own endpoints.
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 1024 * 1024);

builder.Services.AddSerilog((services, logger) =>
{
    logger.ReadFrom.Configuration(builder.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext();

    if (builder.Environment.IsDevelopment())
    {
        logger.WriteTo.Console();
    }
    else
    {
        logger.WriteTo.Console(new RenderedCompactJsonFormatter());
    }
});

// Resolved eagerly so a missing database configuration fails at startup, not on first request.
var connectionString = DatabaseConnection.Resolve(builder.Configuration);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDbContext<AppDbContext>(options => options
    .UseNpgsql(connectionString)
    .UseSnakeCaseNamingConvention());

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// The hosting proxy passes responses through as they are, so the app compresses them itself.
// Images aren't listed: WebP is already compressed.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["text/javascript", "application/problem+json", "image/svg+xml"]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Optimal);
builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Optimal);

builder.Services.AddProblemDetails();
builder.Services.AddAppRateLimiting(builder.Configuration);
builder.Services.AddAdminAuthentication(builder.Environment);
builder.Services.AddMedia(builder.Configuration, builder.Environment);

builder.Services.Configure<OrderRetentionOptions>(builder.Configuration.GetSection(OrderRetentionOptions.SectionName));
if (builder.Configuration.GetValue($"{OrderRetentionOptions.SectionName}:CleanupEnabled", true))
{
    builder.Services.AddHostedService<OrderCleanupService>();
}
builder.Services.AddAppHealthChecks();
builder.Services.AddOpenApi();

// TLS is terminated by the hosting proxy; trust its X-Forwarded-* headers.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();
// Bad requests (e.g. malformed JSON) keep their 4xx status; Development rethrows them by default.
// A request the browser abandoned (navigating away) is 499 "client closed request", not a server error.
app.UseExceptionHandler(new ExceptionHandlerOptions
{
    StatusCodeSelector = ex => ex switch
    {
        BadHttpRequestException badRequest => badRequest.StatusCode,
        OperationCanceledException => 499,
        _ => StatusCodes.Status500InternalServerError,
    },
});
app.UseStatusCodePages();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseSecurityHeaders();
app.UseResponseCompression();
app.UseSerilogRequestLogging(options =>
{
    options.GetLevel = (context, _, ex) =>
        context.RequestAborted.IsCancellationRequested || ex is OperationCanceledException ? Serilog.Events.LogEventLevel.Information
        : ex is not null || context.Response.StatusCode >= 500 ? Serilog.Events.LogEventLevel.Error
        : context.Request.Path.StartsWithSegments("/health") ? Serilog.Events.LogEventLevel.Verbose
        : Serilog.Events.LogEventLevel.Information;
});

app.UseSpaStaticFiles();
app.UseMedia();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapAppHealthChecks();
app.MapPublicApi();
app.MapAdminApi()
    .MapAdminProductEndpoints()
    .MapAdminPackageEndpoints()
    .MapAdminCityEndpoints()
    .MapAdminDistributorEndpoints()
    .MapAdminSettingsEndpoints()
    .MapAdminCustomPackageEndpoints()
    .MapAdminDeliveryEndpoints()
    .MapAdminOrderEndpoints();
app.MapSpaFallback();

await app.InitializeDatabaseAsync();
await app.RunAsync();
