namespace WarmersStore.Api.Domain;

/// <summary>A city used to group authorized distributors. Unrelated to delivery areas.</summary>
public class City : IAuditable
{
    public int Id { get; set; }

    /// <summary>ASCII identifier used in public URLs, e.g. /distributors?city=nablus.</summary>
    public required string Slug { get; set; }
    public required LocalizedText Name { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }

    public List<Distributor> Distributors { get; set; } = [];

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>
/// An authorized physical shop where customers buy in person. Distributors are a directory only:
/// they are never linked to the cart, checkout, delivery or orders.
/// </summary>
public class Distributor : IAuditable
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public int CityId { get; set; }
    public City City { get; set; } = null!;
    public required string Address { get; set; }
    public string? PhoneNumber { get; set; }
    public string? GoogleMapsUrl { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? ImageKey { get; set; }
    public bool IsActive { get; set; }
    public int DisplayOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public uint Version { get; set; }
}
