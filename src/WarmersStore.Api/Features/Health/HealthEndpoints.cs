using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Health;

public static class HealthEndpoints
{
    private const string ReadyTag = "ready";

    public static IServiceCollection AddAppHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>("database", tags: [ReadyTag]);
        return services;
    }

    public static WebApplication MapAppHealthChecks(this WebApplication app)
    {
        // Liveness: the process is up. Used by Railway's healthcheck; never touches the database.
        app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });

        // Readiness: dependencies are reachable.
        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains(ReadyTag),
        });

        return app;
    }
}

internal sealed class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            // Fails if the database is unreachable or the schema hasn't been migrated.
            _ = await db.StoreSettings.AsNoTracking().AnyAsync(cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception ex) when (ex is NpgsqlException or TimeoutException or InvalidOperationException)
        {
            // Don't leak connection details in the response; the exception is logged by the framework.
            return HealthCheckResult.Unhealthy("Database unreachable.", ex);
        }
    }
}
