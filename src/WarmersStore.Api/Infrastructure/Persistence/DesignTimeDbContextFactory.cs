using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using WarmersStore.Api.Common.Hosting;

namespace WarmersStore.Api.Infrastructure.Persistence;

/// <summary>
/// Used by `dotnet ef` and by the migration bundle (efbundle), so neither boots the web host.
/// Reads the same environment variables as the app (ConnectionStrings__Default or DATABASE_URL);
/// without them it targets the local compose database, which `migrations add` never connects to.
/// </summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    private const string LocalDevelopment =
        "Host=localhost;Port=5433;Database=warmers;Username=warmers;Password=warmers_dev";

    public AppDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder().AddEnvironmentVariables().Build();
        var hasDatabaseConfig = !string.IsNullOrWhiteSpace(configuration.GetConnectionString("Default"))
            || !string.IsNullOrWhiteSpace(configuration["DATABASE_URL"]);

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(hasDatabaseConfig ? DatabaseConnection.Resolve(configuration) : LocalDevelopment)
            .UseSnakeCaseNamingConvention()
            .Options;

        return new AppDbContext(options, TimeProvider.System);
    }
}
