using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Checkout;

// ---- Requests ----
// The cart sends only identifiers and quantities. Any price a client sends is ignored:
// these contracts have nowhere to put one, and every amount is recalculated from the database.

public enum CartLineKind
{
    ReadyMade,
    Custom,
}

public sealed record CustomItemRequest(int? ProductId, int? Quantity);

/// <param name="LineId">Client-generated id, echoed back so errors map to the right cart line.</param>
/// <param name="Quantity">Ready-made lines only: how many of the package.</param>
/// <param name="Items">Custom lines only: the chosen products and quantities.</param>
public sealed record CartLineRequest(
    string? LineId,
    CartLineKind? Kind,
    int? PackageId,
    int? Quantity,
    IReadOnlyList<CustomItemRequest>? Items);

public sealed record QuoteRequest(IReadOnlyList<CartLineRequest>? Lines, int? DeliveryAreaId);

public sealed record CustomerRequest(
    string? FullName,
    string? WhatsAppNumber,
    string? Address,
    string? DeliveryInstructions,
    string? Notes);

/// <param name="SubmissionId">
/// Optional client-generated key for this checkout attempt. Resending the same key returns the
/// order already created instead of creating another (double taps, flaky mobile networks).
/// </param>
public sealed record SubmitRequest(
    IReadOnlyList<CartLineRequest>? Lines,
    int? DeliveryAreaId,
    CustomerRequest? Customer,
    Guid? SubmissionId = null);

// ---- Responses ----

/// <summary>A business-rule problem the customer can fix. <c>Message</c> is display-ready Arabic.</summary>
public sealed record CheckoutError(string Code, string Message, IReadOnlyDictionary<string, object>? Params = null);

public sealed record QuoteItemDto(
    int ProductId,
    string? ProductName,
    int Quantity,
    SellingUnit? SellingUnit,
    int Pieces,
    decimal? UnitPrice,
    decimal? Subtotal);

public sealed record QuoteLineDto(
    string LineId,
    CartLineKind Kind,
    int? PackageId,
    string? Name,
    int Quantity,
    decimal? UnitPrice,
    int TotalUnits,
    decimal Subtotal,
    decimal Discount,
    decimal LineTotal,
    IReadOnlyList<QuoteItemDto> Items,
    IReadOnlyList<CheckoutError> Errors);

/// <param name="Fee">Null when the fee can't be known yet (per-area delivery with no area chosen).</param>
public sealed record DeliveryQuoteDto(DeliveryMode Mode, int? AreaId, string? AreaName, decimal? Fee, bool IsFree);

/// <param name="Subtotal">Sum of line totals, after custom-package discounts.</param>
/// <param name="Total">Subtotal plus the delivery fee when it is known.</param>
public sealed record QuoteDto(
    IReadOnlyList<QuoteLineDto> Lines,
    decimal Subtotal,
    decimal DiscountTotal,
    DeliveryQuoteDto Delivery,
    decimal Total,
    IReadOnlyList<CheckoutError> Errors,
    bool IsValid);

/// <param name="Reference">The saved order's reference (PendingConfirmation until an admin confirms it).</param>
public sealed record SubmitResultDto(string Reference, QuoteDto Quote, string Message, string WhatsAppUrl);
