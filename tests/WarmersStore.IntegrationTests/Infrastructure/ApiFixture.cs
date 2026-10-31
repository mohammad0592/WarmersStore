using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Testcontainers.PostgreSql;
using WarmersStore.Api.Infrastructure.Persistence;
using WarmersStore.Api.Infrastructure.Persistence.Seeding;

namespace WarmersStore.IntegrationTests.Infrastructure;

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}

/// <summary>
/// One PostgreSQL container and one app instance for the whole test collection.
/// The app applies migrations at startup exactly like Development does.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
    private WebApplicationFactory<Program> _factory = null!;

    public HttpClient Client { get; private set; } = null!;

    public string ConnectionString => _postgres.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Default", ConnectionString);
            builder.UseSetting("Database:MigrateOnStartup", "true");
            builder.UseSetting("Database:SeedEssentialData", "true");
            builder.UseSetting("Database:SeedSampleData", "false");
            // Tests share one client address; rate limits get their own test with low limits.
            builder.UseSetting("RateLimiting:QuotePerMinute", "100000");
            builder.UseSetting("RateLimiting:SubmitPerMinute", "100000");
            builder.UseSetting("Orders:CleanupEnabled", "false");
        });

        Client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        foreach (var derived in _derivedFactories)
        {
            await derived.DisposeAsync();
        }
        await _factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    private readonly List<WebApplicationFactory<Program>> _derivedFactories = [];

    /// <summary>A separate app instance on the same database, with extra settings applied.</summary>
    public HttpClient CreateClientWithSettings(params (string Key, string Value)[] settings)
    {
        var derived = _factory.WithWebHostBuilder(builder =>
        {
            foreach (var (key, value) in settings)
            {
                builder.UseSetting(key, value);
            }
        });
        _derivedFactories.Add(derived);
        return derived.CreateClient();
    }

    public Task<HttpResponseMessage> PostJsonAsync<T>(string url, T body) =>
        Client.PostAsJsonAsync(url, body, Json);

    public Task<T> GetJsonAsync<T>(string url) =>
        Client.GetFromJsonAsync<T>(url, Json)!;

    public async Task WithDbAsync(Func<AppDbContext, Task> action)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await action(db);
    }

    /// <summary>Empties every table, then restores the essential seed data as the common baseline.</summary>
    public Task ResetDatabaseAsync() => WithDbAsync(async db =>
    {
        await db.Database.ExecuteSqlRawAsync("""
            TRUNCATE orders, distributors, cities, package_items, packages, product_images, product_custom_rules,
                     custom_discount_tiers, delivery_areas, products,
                     custom_package_settings, delivery_settings, store_settings
            RESTART IDENTITY CASCADE
            """);
        await EssentialDataSeeder.SeedAsync(db, NullLogger.Instance);
    });
}

/// <summary>Base class: every test starts from the essential-seed baseline.</summary>
[Collection(ApiCollection.Name)]
public abstract class ApiTestBase(ApiFixture fixture) : IAsyncLifetime
{
    protected ApiFixture Api { get; } = fixture;

    public Task InitializeAsync() => Api.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;
}
