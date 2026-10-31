using Microsoft.Net.Http.Headers;

namespace WarmersStore.Api.Common.Hosting;

/// <summary>
/// Serves the built React app from wwwroot. Vite emits content-hashed files under /assets,
/// which are cached for a year; index.html is never cached so deploys take effect immediately.
/// </summary>
public static class SpaHosting
{
    public static WebApplication UseSpaStaticFiles(this WebApplication app)
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = context =>
            {
                var headers = context.Context.Response.Headers;
                headers[HeaderNames.CacheControl] = context.Context.Request.Path.StartsWithSegments("/assets")
                    ? "public, max-age=31536000, immutable"
                    : "no-cache";
            },
        });

        return app;
    }

    public static WebApplication MapSpaFallback(this WebApplication app)
    {
        // Unknown API routes must return a JSON 404, never the SPA shell.
        app.MapFallback("/api/{**path}", () => Results.Problem(statusCode: StatusCodes.Status404NotFound));

        app.MapFallbackToFile("index.html", new StaticFileOptions
        {
            OnPrepareResponse = context =>
                context.Context.Response.Headers[HeaderNames.CacheControl] = "no-cache",
        });

        return app;
    }
}
