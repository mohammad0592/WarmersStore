namespace WarmersStore.Api.Domain;

public class ReadyMadePackage : IAuditable
{
    public int Id { get; set; }
    public required string Slug { get; set; }
    public required LocalizedText Name { get; set; }
    public LocalizedText? Description { get; set; }
    public string? ImageKey { get; set; }

    /// <summary>Package price in ILS.</summary>
    public decimal Price { get; set; }

    public bool IsActive { get; set; }
    public bool IsFeatured { get; set; }
    public int DisplayOrder { get; set; }

    /// <summary>Soft delete, so future order records can still refer to the package.</summary>
    public DateTimeOffset? DeletedAt { get; set; }

    public List<PackageItem> Items { get; set; } = [];

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public uint Version { get; set; }
}

public class PackageItem
{
    public int PackageId { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    /// <summary>Quantity in the product's selling units.</summary>
    public int Quantity { get; set; }
}
