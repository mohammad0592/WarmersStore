namespace WarmersStore.Api.Domain;

/// <summary>
/// An order starts as PendingConfirmation when the customer is sent to WhatsApp. Opening WhatsApp
/// doesn't prove the message was sent, so only an admin moves it to Confirmed (or Cancelled).
/// </summary>
public enum OrderStatus
{
    PendingConfirmation,
    Confirmed,
    Cancelled,
    Completed,
}

public enum OrderItemKind
{
    ReadyMade,
    Custom,
}

/// <summary>
/// An online order as priced by the server at submission time. Everything is a snapshot (names,
/// prices, delivery area), so later catalog edits never change a past order. Distributors are
/// never involved: they sell in their shops, outside this system.
/// </summary>
public class Order : IAuditable
{
    public int Id { get; set; }

    /// <summary>Customer-facing reference, e.g. DF-261031-7K3Q. Included in the WhatsApp message.</summary>
    public required string Reference { get; set; }

    public OrderStatus Status { get; set; } = OrderStatus.PendingConfirmation;
    public DateTimeOffset StatusChangedAt { get; set; }

    /// <summary>Client-generated key so a double-tapped submit creates one order, not two.</summary>
    public Guid? SubmissionId { get; set; }

    public required string CustomerName { get; set; }
    public required string CustomerWhatsApp { get; set; }
    public required string Address { get; set; }
    public string? DeliveryInstructions { get; set; }
    public string? Notes { get; set; }

    public DeliveryMode DeliveryMode { get; set; }
    public int? DeliveryAreaId { get; set; }
    public string? DeliveryAreaName { get; set; }

    public decimal Subtotal { get; set; }
    public decimal DiscountTotal { get; set; }

    /// <summary>Zero when delivery isn't charged; the amount otherwise.</summary>
    public decimal DeliveryFee { get; set; }
    public decimal Total { get; set; }

    /// <summary>The exact text the customer was handed to send, for comparing with what arrives.</summary>
    public required string WhatsAppMessage { get; set; }

    public List<OrderItem> Items { get; set; } = [];

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public uint Version { get; set; }
}

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int Position { get; set; }
    public OrderItemKind Kind { get; set; }

    /// <summary>The ready-made package's id at the time; a snapshot, not a foreign key.</summary>
    public int? PackageId { get; set; }
    public required string Name { get; set; }
    public int Quantity { get; set; }
    public decimal? UnitPrice { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal LineTotal { get; set; }

    public List<OrderItemProduct> Products { get; set; } = [];
}

/// <summary>A product inside an order line: package contents, or a custom package's choices.</summary>
public class OrderItemProduct
{
    public int Id { get; set; }
    public int OrderItemId { get; set; }
    public int ProductId { get; set; }
    public required string ProductName { get; set; }
    public int Quantity { get; set; }
    public int Pieces { get; set; }
    public decimal? UnitPrice { get; set; }
    public decimal? Subtotal { get; set; }
}
