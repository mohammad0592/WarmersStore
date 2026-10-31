namespace WarmersStore.Api.Domain;

/// <summary>Single-row settings for the custom package builder. Null limits mean "no rule".</summary>
public class CustomPackageSettings
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;
    public bool IsEnabled { get; set; } = true;
    public int? MinItems { get; set; }
    public int? MaxItems { get; set; }
    public decimal? MinSubtotal { get; set; }

    /// <summary>Upper limit for any single product in a custom package; per-product rules can be stricter.</summary>
    public int? MaxQuantityPerProduct { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>Optional per-product quantity limits inside a custom package.</summary>
public class ProductCustomRule
{
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int? MinQty { get; set; }
    public int? MaxQty { get; set; }
}

public enum DiscountType
{
    Percent,
    Fixed,
}

/// <summary>Quantity-based discount for a custom package. No tiers exist until the admin adds them.</summary>
public class CustomDiscountTier
{
    public int Id { get; set; }
    public int MinItems { get; set; }
    public DiscountType Type { get; set; }
    public decimal Value { get; set; }
    public bool IsActive { get; set; }
}
