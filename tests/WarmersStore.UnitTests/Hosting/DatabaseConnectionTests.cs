using Microsoft.Extensions.Configuration;
using Npgsql;
using WarmersStore.Api.Common.Hosting;

namespace WarmersStore.UnitTests.Hosting;

public class DatabaseConnectionTests
{
    [Fact]
    public void FromUrl_ParsesRailwayStyleUrl()
    {
        var result = new NpgsqlConnectionStringBuilder(
            DatabaseConnection.FromUrl("postgresql://user:p%40ss%3Aword@db.internal:6543/railway"));

        Assert.Equal("db.internal", result.Host);
        Assert.Equal(6543, result.Port);
        Assert.Equal("railway", result.Database);
        Assert.Equal("user", result.Username);
        Assert.Equal("p@ss:word", result.Password);
    }

    [Fact]
    public void FromUrl_DefaultsPortAndReadsSslMode()
    {
        var result = new NpgsqlConnectionStringBuilder(
            DatabaseConnection.FromUrl("postgres://u:p@host/db?sslmode=require"));

        Assert.Equal(5432, result.Port);
        Assert.Equal(SslMode.Require, result.SslMode);
    }

    [Theory]
    [InlineData("mysql://u:p@host/db")]
    [InlineData("not a url")]
    public void FromUrl_RejectsNonPostgresUrls(string url) =>
        Assert.Throws<InvalidOperationException>(() => DatabaseConnection.FromUrl(url));

    [Fact]
    public void Resolve_PrefersConnectionStringOverDatabaseUrl()
    {
        var configuration = Build(new()
        {
            ["ConnectionStrings:Default"] = "Host=explicit;Database=a",
            ["DATABASE_URL"] = "postgres://u:p@fromurl/b",
        });

        Assert.Equal("explicit", new NpgsqlConnectionStringBuilder(DatabaseConnection.Resolve(configuration)).Host);
    }

    [Fact]
    public void Resolve_DisablesGssEncryptionByDefault()
    {
        var configuration = Build(new() { ["ConnectionStrings:Default"] = "Host=h;Database=a" });

        Assert.Equal(GssEncryptionMode.Disable,
            new NpgsqlConnectionStringBuilder(DatabaseConnection.Resolve(configuration)).GssEncryptionMode);
    }

    [Fact]
    public void Resolve_KeepsExplicitGssEncryptionMode()
    {
        var configuration = Build(new() { ["ConnectionStrings:Default"] = "Host=h;Database=a;GSS Encryption Mode=Require" });

        Assert.Equal(GssEncryptionMode.Require,
            new NpgsqlConnectionStringBuilder(DatabaseConnection.Resolve(configuration)).GssEncryptionMode);
    }

    [Fact]
    public void Resolve_FallsBackToDatabaseUrl()
    {
        var configuration = Build(new() { ["DATABASE_URL"] = "postgres://u:p@fromurl/b" });

        Assert.Equal("fromurl", new NpgsqlConnectionStringBuilder(DatabaseConnection.Resolve(configuration)).Host);
    }

    [Fact]
    public void Resolve_ThrowsWhenNothingConfigured() =>
        Assert.Throws<InvalidOperationException>(() => DatabaseConnection.Resolve(Build(new())));

    private static IConfiguration Build(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}
