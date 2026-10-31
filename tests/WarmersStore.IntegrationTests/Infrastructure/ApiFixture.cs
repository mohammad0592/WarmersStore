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

    /// <summary>Test-only admin, created by the start-up seeder. The password is generated per run.</summary>
    public const string AdminEmail = "admin@test.local";
    public static readonly string AdminPassword = $"test-{Guid.NewGuid():N}";

    /// <summary>Uploaded images for this test run; deleted when the fixture is disposed.</summary>
    public string MediaRoot { get; } = Path.Combine(Path.GetTempPath(), $"warmers-media-{Guid.NewGuid():N}");

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
            builder.UseSetting("RateLimiting:LoginPerMinute", "100000");
            builder.UseSetting("Orders:CleanupEnabled", "false");
            builder.UseSetting("Media:Root", MediaRoot);
            builder.UseSetting("Admin:Email", AdminEmail);
            builder.UseSetting("Admin:Password", AdminPassword);
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
        if (Directory.Exists(MediaRoot))
        {
            Directory.Delete(MediaRoot, recursive: true);
        }
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

    /// <summary>A client with its own cookie jar (so sign-ins don't leak between tests).</summary>
    public HttpClient NewClient() => _factory.CreateClient();

    public IServiceProvider Services => _factory.Services;

    /// <summary>A new client signed in as the seeded admin, sending the admin CSRF header.</summary>
    public async Task<HttpClient> AdminClientAsync()
    {
        var client = NewClient();
        client.DefaultRequestHeaders.Add("X-Dafa-Admin", "1");
        var response = await client.PostAsJsonAsync("/api/admin/auth/login", new { email = AdminEmail, password = AdminPassword });
        response.EnsureSuccessStatusCode();
        return client;
    }

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
        // Identity tables are kept (the seeded admin), but lockouts from earlier tests are cleared.
        await db.Database.ExecuteSqlRawAsync("UPDATE asp_net_users SET access_failed_count = 0, lockout_end = NULL");
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
