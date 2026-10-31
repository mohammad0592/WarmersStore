using System.Threading.RateLimiting;
using Microsoft.Extensions.Options;

namespace WarmersStore.Api.Common.Hosting;

public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    public int QuotePerMinute { get; set; } = 60;
    public int SubmitPerMinute { get; set; } = 10;

    /// <summary>Admin sign-in attempts per IP; account lockout separately caps attempts per account.</summary>
    public int LoginPerMinute { get; set; } = 10;
}

/// <summary>Per-client-IP limits for public endpoints that do work on every call.</summary>
public static class RateLimiting
{
    public const string QuotePolicy = "checkout-quote";
    public const string SubmitPolicy = "checkout-submit";
    public const string LoginPolicy = "admin-login";

    public static IServiceCollection AddAppRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RateLimitingOptions>(configuration.GetSection(RateLimitingOptions.SectionName));

        services.AddRateLimiter(options =>
        {
            options.AddPolicy(QuotePolicy, context => PerIp(context, o => o.QuotePerMinute));
            options.AddPolicy(SubmitPolicy, context => PerIp(context, o => o.SubmitPerMinute));
            options.AddPolicy(LoginPolicy, context => PerIp(context, o => o.LoginPerMinute));

            options.OnRejected = async (rejection, ct) =>
            {
                if (rejection.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    rejection.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
                }

                await Results.Problem(
                    statusCode: StatusCodes.Status429TooManyRequests,
                    title: "Too many requests",
                    detail: "طلبات كثيرة خلال وقت قصير، حاول بعد دقيقة.")
                    .ExecuteAsync(rejection.HttpContext);
            };
        });

        return services;
    }

    // RemoteIpAddress is the real client address because forwarded headers are applied first.
    private static RateLimitPartition<string> PerIp(HttpContext context, Func<RateLimitingOptions, int> limit)
    {
        var options = context.RequestServices.GetRequiredService<IOptions<RateLimitingOptions>>().Value;
        var key = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = limit(options),
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        });
    }
}
