namespace WarmersStore.Api.Domain;

public enum SellingUnit
{
    Piece,
    RetailBag,
}

public class Product : IAuditable
{
    public int Id { get; set; }
    public required string Slug { get; set; }
    public required LocalizedText Name { get; set; }
    public LocalizedText? ShortDescription { get; set; }
    public LocalizedText? Description { get; set; }
    public LocalizedText? UsageGuidance { get; set; }
    public LocalizedText? SafetyInfo { get; set; }

    public decimal WidthCm { get; set; }
    public decimal HeightCm { get; set; }
    public decimal? HeatMinHours { get; set; }
    public decimal? HeatMaxHours { get; set; }

    /// <summary>Null when the adhesive status has not been specified.</summary>
    public bool? IsAdhesive { get; set; }

    /// <summary>How many individual warmers the factory retail bag contains.</summary>
    public int PiecesPerRetailBag { get; set; }

    /// <summary>What one unit of quantity means when customers order this product.</summary>
    public SellingUnit SellingUnit { get; set; }
    public int PiecesPerSellingUnit { get; set; }

    /// <summary>Price per selling unit in ILS. Null until the business sets it.</summary>
    public decimal? UnitPrice { get; set; }

    public bool IsActive { get; set; }
    public bool IsCustomEligible { get; set; } = true;
    public int DisplayOrder { get; set; }

    public List<ProductImage> Images { get; set; } = [];

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public uint Version { get; set; }
}

public class ProductImage
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public required string StorageKey { get; set; }
    public string? AltText { get; set; }
    public int SortOrder { get; set; }
}
