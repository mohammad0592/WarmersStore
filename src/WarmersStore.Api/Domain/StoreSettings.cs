namespace WarmersStore.Api.Domain;

/// <summary>Single-row store-wide settings.</summary>
public class StoreSettings
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;
    public string StoreName { get; set; } = "دفا";
    public string? LogoKey { get; set; }

    /// <summary>E.164 number orders are sent to. Checkout stays unavailable until it is set.</summary>
    public string? WhatsAppNumber { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }

    public string? FacebookUrl { get; set; }
    public string? InstagramUrl { get; set; }
    public string? TikTokUrl { get; set; }

    public LocalizedText? Announcement { get; set; }
    public bool AnnouncementActive { get; set; }

    public decimal? MinOrderTotal { get; set; }

    /// <summary>Shows the distributors nav link and homepage section.</summary>
    public bool ShowDistributors { get; set; }

    /// <summary>Editable homepage text; anything left empty falls back to the site's default wording.</summary>
    public HomepageContent? Homepage { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class HomepageContent
{
    public string? HeroTitle { get; set; }
    public string? HeroDescription { get; set; }
    public string? WhereToFindText { get; set; }
}
