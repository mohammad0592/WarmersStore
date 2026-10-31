namespace WarmersStore.Api.Common.Hosting;

public static class SecurityHeaders
{
    /// <summary>
    /// Baseline security headers for every response. A Content-Security-Policy is added
    /// during hardening (M12) once fonts and image sources are final.
    /// </summary>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers["X-Content-Type-Options"] = "nosniff";
                headers["X-Frame-Options"] = "DENY";
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
                return Task.CompletedTask;
            });

            await next();
        });
}
