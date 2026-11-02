using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Features.Admin;
using WarmersStore.Api.Infrastructure.Persistence.Seeding;

namespace WarmersStore.Api.Infrastructure.Persistence;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    /// <summary>
    /// Apply pending migrations at startup, in every environment. If a migration fails the new
    /// deployment never becomes healthy, so the host keeps the previous one running.
    /// </summary>
    public bool MigrateOnStartup { get; set; }

    /// <summary>Insert required settings rows and the initial product catalog when missing.</summary>
    public bool SeedEssentialData { get; set; } = true;

    /// <summary>Insert clearly marked sample packages, cities and distributors. Never runs in Production.</summary>
    public bool SeedSampleData { get; set; }
}

public static class DatabaseInitializer
{
    public static async Task InitializeDatabaseAsync(this WebApplication app)
    {
        var options = app.Configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>() ?? new();

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();

        if (options.MigrateOnStartup)
        {
            logger.LogInformation("Applying database migrations");
            await db.Database.MigrateAsync();
        }

        if (options.SeedEssentialData)
        {
            await EssentialDataSeeder.SeedAsync(db, logger);
            await AdminSeeder.SeedAsync(scope.ServiceProvider, app.Configuration, logger);
        }

        if (options.SeedSampleData)
        {
            if (app.Environment.IsProduction())
            {
                logger.LogWarning("Database:SeedSampleData is ignored in Production");
            }
            else
            {
                await SampleDataSeeder.SeedAsync(db, logger);
            }
        }
    }
}
