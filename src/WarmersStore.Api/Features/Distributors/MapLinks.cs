using System.Globalization;

namespace WarmersStore.Api.Features.Distributors;

/// <summary>Builds the outbound "open in Google Maps" link for a distributor.</summary>
public static class MapLinks
{
    /// <summary>
    /// Coordinates win when present because they always point at the exact spot; otherwise the
    /// stored (admin-validated) Google Maps URL is used as-is. The server never fetches either.
    /// </summary>
    public static string? Build(decimal? latitude, decimal? longitude, string? googleMapsUrl)
    {
        if (latitude is { } lat && longitude is { } lng)
        {
            return string.Create(CultureInfo.InvariantCulture,
                $"https://www.google.com/maps/search/?api=1&query={lat},{lng}");
        }

        return string.IsNullOrWhiteSpace(googleMapsUrl) ? null : googleMapsUrl;
    }
}
