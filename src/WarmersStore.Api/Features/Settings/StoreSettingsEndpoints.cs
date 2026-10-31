using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Features.Media;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Settings;

public sealed record SocialLinksDto(string? Facebook, string? Instagram, string? TikTok);

/// <summary>The public subset of store settings. Admin-only fields must never be added here.</summary>
public sealed record PublicStoreSettingsDto(
    string StoreName,
    string? LogoUrl,
    string? WhatsAppNumber,
    string? Phone,
    string? Email,
    string? Address,
    SocialLinksDto Social,
    string? Announcement,
    decimal? MinOrderTotal,
    bool ShowDistributors,
    HomepageTextDto Homepage);

/// <summary>Admin-edited homepage text; null fields mean "use the site's default wording".</summary>
public sealed record HomepageTextDto(string? HeroTitle, string? HeroDescription, string? WhereToFindText);

public static class StoreSettingsEndpoints
{
    public static RouteGroupBuilder MapStoreSettingsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/store-settings", async (AppDbContext db, CancellationToken ct) =>
        {
            var s = await db.StoreSettings.AsNoTracking().SingleAsync(ct);

            return TypedResults.Ok(new PublicStoreSettingsDto(
                s.StoreName,
                MediaUrls.For(s.LogoKey),
                s.WhatsAppNumber,
                s.Phone,
                s.Email,
                s.Address,
                new SocialLinksDto(s.FacebookUrl, s.InstagramUrl, s.TikTokUrl),
                s.AnnouncementActive ? s.Announcement?.Resolve(PublicApi.Language) : null,
                s.MinOrderTotal,
                s.ShowDistributors,
                new HomepageTextDto(s.Homepage?.HeroTitle, s.Homepage?.HeroDescription, s.Homepage?.WhereToFindText)));
        })
        .WithTags("Store settings");

        return api;
    }
}
