using Microsoft.AspNetCore.HttpOverrides;
using Npgsql;
using Serilog;
using Serilog.Formatting.Compact;
using WarmersStore.Api.Common.Hosting;
using WarmersStore.Api.Features.Health;

var builder = WebApplication.CreateBuilder(args);

// Railway (and similar hosts) tell the app which port to listen on via PORT.
if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port)
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

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
builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));

builder.Services.AddProblemDetails();
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
app.UseExceptionHandler();
app.UseStatusCodePages();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseSecurityHeaders();
app.UseSerilogRequestLogging(options =>
{
    options.GetLevel = (context, _, ex) =>
        ex is not null || context.Response.StatusCode >= 500 ? Serilog.Events.LogEventLevel.Error
        : context.Request.Path.StartsWithSegments("/health") ? Serilog.Events.LogEventLevel.Verbose
        : Serilog.Events.LogEventLevel.Information;
});

app.UseSpaStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapAppHealthChecks();
app.MapSpaFallback();

app.Run();
