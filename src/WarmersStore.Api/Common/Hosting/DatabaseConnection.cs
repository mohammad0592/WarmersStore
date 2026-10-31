using Npgsql;

namespace WarmersStore.Api.Common.Hosting;

/// <summary>
/// Resolves the PostgreSQL connection string from configuration.
/// Prefers <c>ConnectionStrings:Default</c>; falls back to a <c>DATABASE_URL</c>
/// (postgres://user:pass@host:port/db) as provided by Railway.
/// </summary>
public static class DatabaseConnection
{
    public static string Resolve(IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            var databaseUrl = configuration["DATABASE_URL"];
            connectionString = string.IsNullOrWhiteSpace(databaseUrl)
                ? throw new InvalidOperationException(
                    "No database configured. Set ConnectionStrings__Default or DATABASE_URL.")
                : FromUrl(databaseUrl);
        }

        return ApplyDefaults(connectionString);
    }

    /// <summary>
    /// Kerberos is never used, and the runtime image doesn't ship libgssapi; without this Npgsql
    /// probes for it on every new connection and logs an error. An explicit setting is respected.
    /// </summary>
    private static string ApplyDefaults(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (!connectionString.Contains("GSS Encryption Mode", StringComparison.OrdinalIgnoreCase)
            && !connectionString.Contains("GssEncryptionMode", StringComparison.OrdinalIgnoreCase))
        {
            builder.GssEncryptionMode = GssEncryptionMode.Disable;
        }

        return builder.ConnectionString;
    }

    public static string FromUrl(string databaseUrl)
    {
        if (!Uri.TryCreate(databaseUrl, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("postgres" or "postgresql"))
        {
            throw new InvalidOperationException("DATABASE_URL must be a postgres:// or postgresql:// URL.");
        }

        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
        };

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length == 2
                && parts[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<SslMode>(Uri.UnescapeDataString(parts[1]), ignoreCase: true, out var sslMode))
            {
                builder.SslMode = sslMode;
            }
        }

        return builder.ConnectionString;
    }
}
