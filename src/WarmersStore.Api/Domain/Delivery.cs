namespace WarmersStore.Api.Domain;

public enum DeliveryMode
{
    /// <summary>No delivery fee is charged or shown.</summary>
    None,
    Flat,
    PerArea,
}

/// <summary>Single-row delivery settings for online orders. Distributors never use these.</summary>
public class DeliverySettings
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;
    public DeliveryMode Mode { get; set; } = DeliveryMode.None;
    public decimal? FlatFee { get; set; }
    public decimal? FreeDeliveryThreshold { get; set; }
    public LocalizedText? Message { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class DeliveryArea : IAuditable
{
    public int Id { get; set; }
    public required LocalizedText Name { get; set; }
    public decimal Fee { get; set; }
    public decimal? FreeDeliveryThreshold { get; set; }
    public LocalizedText? Note { get; set; }
    public bool IsActive { get; set; }
    public int DisplayOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
