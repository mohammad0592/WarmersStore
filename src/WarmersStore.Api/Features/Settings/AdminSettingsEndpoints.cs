using System.Net.Mail;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WarmersStore.Api.Common;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Admin;
using WarmersStore.Api.Features.Media;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Settings;

public sealed record AdminStoreSettingsDto(
    string StoreName,
    string? LogoUrl,
    string? WhatsAppNumber,
    string? Phone,
    string? Email,
    string? Address,
    string? FacebookUrl,
    string? InstagramUrl,
    string? TikTokUrl,
    string? Announcement,
    bool AnnouncementActive,
    decimal? MinOrderTotal,
    bool ShowDistributors,
    string? HeroTitle,
    string? HeroDescription,
    string? WhereToFindText);

public sealed record StoreSettingsRequest(
    string? StoreName,
    string? WhatsAppNumber,
    string? Phone,
    string? Email,
    string? Address,
    string? FacebookUrl,
    string? InstagramUrl,
    string? TikTokUrl,
    string? Announcement,
    bool AnnouncementActive,
    decimal? MinOrderTotal,
    bool ShowDistributors,
    string? HeroTitle,
    string? HeroDescription,
    string? WhereToFindText);

public static class AdminSettingsEndpoints
{
    private const long MaxRequestBytes = 6 * 1024 * 1024;

    public static RouteGroupBuilder MapAdminSettingsEndpoints(this RouteGroupBuilder admin)
    {
        var settings = admin.MapGroup("/store-settings");

        settings.MapGet("/", async (AppDbContext db, CancellationToken ct) =>
            TypedResults.Ok(ToDto(await db.StoreSettings.AsNoTracking().SingleAsync(ct))));

        settings.MapPut("/", async Task<IResult> (StoreSettingsRequest r, AppDbContext db, CancellationToken ct) =>
        {
            var s = await db.StoreSettings.SingleAsync(ct);
            var errors = new ValidationErrors();

            var storeName = errors.Required("storeName", r.StoreName, 80);

            // The number customers' orders go to. A local number ("059…") is read as +970.
            string? whatsApp = null;
            if (!string.IsNullOrWhiteSpace(r.WhatsAppNumber))
            {
                whatsApp = PhoneNumbers.NormalizeWithDefaultCountry(r.WhatsAppNumber, "+970");
                if (whatsApp is null)
                {
                    errors.Add("whatsAppNumber", "رقم واتساب غير صالح. مثال: 059 123 4567 أو ‎+970 59 123 4567.");
                }
            }

            string? phone = null;
            if (!string.IsNullOrWhiteSpace(r.Phone))
            {
                phone = PhoneNumbers.NormalizeWithDefaultCountry(r.Phone, "+970");
                if (phone is null)
                {
                    errors.Add("phone", "رقم هاتف غير صالح.");
                }
            }

            var email = errors.Optional("email", r.Email, 200);
            if (email is not null && !MailAddress.TryCreate(email, out _))
            {
                errors.Add("email", "بريد إلكتروني غير صالح.");
            }

            var address = errors.Optional("address", r.Address, 300);
            var facebook = SocialUrl(errors, "facebookUrl", r.FacebookUrl);
            var instagram = SocialUrl(errors, "instagramUrl", r.InstagramUrl);
            var tikTok = SocialUrl(errors, "tikTokUrl", r.TikTokUrl);

            var announcement = errors.Optional("announcement", r.Announcement, 200);
            if (r.AnnouncementActive && announcement is null)
            {
                errors.Add("announcement", "اكتب نص الإعلان قبل تفعيله.");
            }

            errors.Number("minOrderTotal", r.MinOrderTotal, 0m, 100_000m, 2, required: false);

            var heroTitle = errors.Optional("heroTitle", r.HeroTitle, 80);
            var heroDescription = errors.Optional("heroDescription", r.HeroDescription, 300);
            var whereToFind = errors.Optional("whereToFindText", r.WhereToFindText, 300);

            if (errors.Any)
            {
                return errors.ToResult();
            }

            s.StoreName = storeName!;
            s.WhatsAppNumber = whatsApp;
            s.Phone = phone;
            s.Email = email;
            s.Address = address;
            s.FacebookUrl = facebook;
            s.InstagramUrl = instagram;
            s.TikTokUrl = tikTok;
            s.Announcement = AdminResults.Localized(announcement, s.Announcement);
            s.AnnouncementActive = r.AnnouncementActive;
            s.MinOrderTotal = r.MinOrderTotal;
            s.ShowDistributors = r.ShowDistributors;
            s.Homepage = heroTitle is null && heroDescription is null && whereToFind is null
                ? null
                : new HomepageContent { HeroTitle = heroTitle, HeroDescription = heroDescription, WhereToFindText = whereToFind };

            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(ToDto(s));
        });

        settings.MapPut("/logo", async Task<IResult> (
                IFormFile? file, AppDbContext db, IImageStorage storage, IOptions<MediaOptions> media, CancellationToken ct) =>
            {
                var processed = await ImageProcessor.ProcessAsync(file, media.Value.MaxUploadBytes, ct);
                if (processed.Error is not null)
                {
                    return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = [processed.Error] });
                }

                string key;
                await using (processed.Webp)
                {
                    key = await storage.SaveAsync("branding", processed.Webp!, ct);
                }

                var s = await db.StoreSettings.SingleAsync(ct);
                var previous = s.LogoKey;
                s.LogoKey = key;
                await db.SaveChangesAsync(ct);
                await storage.DeleteAsync(previous, ct);
                return TypedResults.Ok(new { logoUrl = MediaUrls.For(key) });
            })
            .DisableAntiforgery() // protected by the X-Dafa-Admin header + SameSite cookie instead
            .WithMetadata(new RequestSizeLimitAttribute(MaxRequestBytes));

        settings.MapDelete("/logo", async (AppDbContext db, IImageStorage storage, CancellationToken ct) =>
        {
            var s = await db.StoreSettings.SingleAsync(ct);
            var previous = s.LogoKey;
            s.LogoKey = null;
            await db.SaveChangesAsync(ct);
            await storage.DeleteAsync(previous, ct);
            return TypedResults.NoContent();
        });

        return admin;
    }

    /// <summary>Social profile links must be absolute https URLs.</summary>
    private static string? SocialUrl(ValidationErrors errors, string key, string? value)
    {
        var url = errors.Optional(key, value, 300);
        if (url is not null && !(Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && uri.UserInfo.Length == 0))
        {
            errors.Add(key, "استخدم رابطاً كاملاً يبدأ بـ https://");
        }
        return url;
    }

    private static AdminStoreSettingsDto ToDto(StoreSettings s) => new(
        s.StoreName, MediaUrls.For(s.LogoKey), s.WhatsAppNumber, s.Phone, s.Email, s.Address,
        s.FacebookUrl, s.InstagramUrl, s.TikTokUrl, s.Announcement?.Ar, s.AnnouncementActive, s.MinOrderTotal,
        s.ShowDistributors, s.Homepage?.HeroTitle, s.Homepage?.HeroDescription, s.Homepage?.WhereToFindText);
}
