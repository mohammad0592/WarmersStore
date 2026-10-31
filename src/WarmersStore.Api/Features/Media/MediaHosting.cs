using Microsoft.Extensions.FileProviders;
using Microsoft.Net.Http.Headers;

namespace WarmersStore.Api.Features.Media;

public static class MediaHosting
{
    public static IServiceCollection AddMedia(this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment)
    {
        var options = configuration.GetSection(MediaOptions.SectionName).Get<MediaOptions>() ?? new MediaOptions();
        var root = Path.GetFullPath(Path.Combine(environment.ContentRootPath, options.Root));
        Directory.CreateDirectory(root);

        services.Configure<MediaOptions>(o =>
        {
            o.Root = root;
            o.MaxUploadBytes = options.MaxUploadBytes;
        });
        services.AddSingleton<IImageStorage>(sp => new LocalImageStorage(root, sp.GetRequiredService<ILogger<LocalImageStorage>>()));
        return services;
    }

    /// <summary>
    /// Serves uploaded images from /media. Keys are random and never reused, so files are cached
    /// for a year; only .webp produced by <see cref="ImageProcessor"/> exists there.
    /// </summary>
    public static WebApplication UseMedia(this WebApplication app)
    {
        var root = app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<MediaOptions>>().Value.Root;

        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(root),
            RequestPath = "/media",
            ServeUnknownFileTypes = false,
            OnPrepareResponse = context =>
                context.Context.Response.Headers[HeaderNames.CacheControl] = "public, max-age=31536000, immutable",
        });

        // No /media endpoint is mapped on purpose: a matched endpoint makes the static-file middleware
        // step aside. Missing files still get a plain 404, because the SPA fallback skips file paths.
        return app;
    }
}
