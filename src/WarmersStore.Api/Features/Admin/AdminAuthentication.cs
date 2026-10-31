using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Admin;

public static class AdminAuthentication
{
    public const string AdminPolicy = "Admin";
    public const string CookieName = "dafa_admin";

    /// <summary>
    /// Admin requests that change data must carry this header. Browsers can't add custom headers to
    /// cross-site requests without a CORS preflight, which this API never grants, so together with
    /// the SameSite=Strict cookie it blocks cross-site request forgery.
    /// </summary>
    public const string CsrfHeader = "X-Dafa-Admin";

    public static IServiceCollection AddAdminAuthentication(this IServiceCollection services, IWebHostEnvironment environment)
    {
        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;

                // Length over composition rules (NIST SP 800-63B): long passphrases, no forced symbols.
                options.Password.RequiredLength = 12;
                options.Password.RequiredUniqueChars = 4;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;

                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddSignInManager();

        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = CookieName;
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            // Railway terminates TLS and forwards the scheme, so production requests count as HTTPS.
            options.Cookie.SecurePolicy = environment.IsProduction() ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromHours(8);
            options.SlidingExpiration = true;

            // This is an API: answer with status codes instead of redirecting to a login page.
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        services.AddAuthorizationBuilder()
            .AddPolicy(AdminPolicy, policy => policy.RequireAuthenticatedUser().RequireRole(Roles.Admin));

        // Keys that encrypt the admin cookie live in PostgreSQL, so redeploys don't sign admins out.
        services.AddDataProtection()
            .SetApplicationName("WarmersStore")
            .PersistKeysToDbContext<AppDbContext>();

        return services;
    }
}

/// <summary>Rejects state-changing admin requests that lack <see cref="AdminAuthentication.CsrfHeader"/>.</summary>
internal sealed class RequireAdminHeaderFilter : IEndpointFilter
{
    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var request = context.HttpContext.Request;
        if (!HttpMethods.IsGet(request.Method) && !HttpMethods.IsHead(request.Method)
            && !request.Headers.ContainsKey(AdminAuthentication.CsrfHeader))
        {
            return ValueTask.FromResult<object?>(Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: $"Missing {AdminAuthentication.CsrfHeader} header"));
        }

        return next(context);
    }
}
