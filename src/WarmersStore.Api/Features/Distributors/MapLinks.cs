using System.Globalization;

namespace WarmersStore.Api.Features.Distributors;

/// <summary>Builds and validates the outbound "open in Google Maps" link for a distributor.</summary>
public static class MapLinks
{
    // Hosts that serve Google Maps; for the google.* hosts the path must start with /maps.
    private static readonly HashSet<string> GoogleHosts =
        ["google.com", "www.google.com", "google.ps", "www.google.ps", "google.co.il", "www.google.co.il"];

    /// <summary>
    /// Only https Google Maps links are stored: full links (google.com/maps, maps.google.com) and
    /// share links (maps.app.goo.gl, goo.gl/maps). Anything else (http, javascript:, look-alike
    /// domains, credentials in the URL) is refused. The server never fetches these links.
    /// </summary>
    public static bool IsAllowedGoogleMapsUrl(string url)
    {
        if (url.Length > 500 || !Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps || !uri.IsDefaultPort || uri.UserInfo.Length > 0)
        {
            return false;
        }

        var host = uri.IdnHost.ToLowerInvariant();
        var path = uri.AbsolutePath;
        return host == "maps.google.com"
            || host == "maps.app.goo.gl"
            || (host == "goo.gl" && path.StartsWith("/maps", StringComparison.Ordinal))
            || (GoogleHosts.Contains(host) && path.StartsWith("/maps", StringComparison.Ordinal));
    }

    /// <summary>
    /// Coordinates win when present because they always point at the exact spot; otherwise the
    /// stored (admin-validated) Google Maps URL is used as-is. The server never fetches either.
    /// </summary>
    public static string? Build(decimal? latitude, decimal? longitude, string? googleMapsUrl)
    {
        if (latitude is { } lat && longitude is { } lng)
        {
            // "0.######" drops the trailing zeros numeric(9,6) adds (32.221500 → 32.2215).
            return string.Create(CultureInfo.InvariantCulture,
                $"https://www.google.com/maps/search/?api=1&query={lat:0.######},{lng:0.######}");
        }

        return string.IsNullOrWhiteSpace(googleMapsUrl) ? null : googleMapsUrl;
    }
}
