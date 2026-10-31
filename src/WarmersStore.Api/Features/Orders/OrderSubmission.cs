using Microsoft.EntityFrameworkCore;
using Npgsql;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Checkout;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Orders;

public sealed record SavedOrder(string Reference, string Message);

/// <summary>Saves a validated, server-priced quote as a PendingConfirmation order.</summary>
public static class OrderSubmission
{
    private const int MaxReferenceAttempts = 5;

    /// <summary>A previous submission with the same key, if the customer tapped send twice.</summary>
    public static async Task<SavedOrder?> FindExistingAsync(AppDbContext db, Guid? submissionId, CancellationToken ct) =>
        submissionId is { } id
            ? await db.Orders.AsNoTracking()
                .Where(o => o.SubmissionId == id)
                .Select(o => new SavedOrder(o.Reference, o.WhatsAppMessage))
                .SingleOrDefaultAsync(ct)
            : null;

    public static async Task<SavedOrder> SaveAsync(
        AppDbContext db,
        QuoteDto quote,
        CustomerInfo customer,
        string storeName,
        Guid? submissionId,
        TimeProvider clock,
        CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            var now = clock.GetUtcNow();
            var reference = OrderReference.Create(now);
            var message = WhatsAppMessageBuilder.Build(storeName, quote, customer, reference);
            db.Orders.Add(ToOrder(quote, customer, reference, message, submissionId, now));

            try
            {
                await db.SaveChangesAsync(ct);
                return new SavedOrder(reference, message);
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex, "ix_orders_reference") && attempt < MaxReferenceAttempts)
            {
                db.ChangeTracker.Clear(); // same reference generated twice today: try another
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex, "ix_orders_submission_id"))
            {
                // Two identical submissions raced; the other one won. Return its order.
                db.ChangeTracker.Clear();
                return (await FindExistingAsync(db, submissionId, ct))!;
            }
        }
    }

    private static Order ToOrder(
        QuoteDto quote, CustomerInfo customer, string reference, string message, Guid? submissionId, DateTimeOffset now) =>
        new()
        {
            Reference = reference,
            Status = OrderStatus.PendingConfirmation,
            StatusChangedAt = now,
            SubmissionId = submissionId,
            CustomerName = customer.FullName,
            CustomerWhatsApp = customer.WhatsAppNumber,
            Address = customer.Address,
            DeliveryInstructions = customer.DeliveryInstructions,
            Notes = customer.Notes,
            DeliveryMode = quote.Delivery.Mode,
            DeliveryAreaId = quote.Delivery.AreaId,
            DeliveryAreaName = quote.Delivery.AreaName,
            Subtotal = quote.Subtotal,
            DiscountTotal = quote.DiscountTotal,
            DeliveryFee = quote.Delivery.Fee ?? 0,
            Total = quote.Total,
            WhatsAppMessage = message,
            Items = quote.Lines.Select((line, index) => new OrderItem
            {
                Position = index + 1,
                Kind = line.Kind == CartLineKind.ReadyMade ? OrderItemKind.ReadyMade : OrderItemKind.Custom,
                PackageId = line.PackageId,
                Name = line.Name ?? "",
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                Subtotal = line.Subtotal,
                Discount = line.Discount,
                LineTotal = line.LineTotal,
                Products = line.Items.Select(item => new OrderItemProduct
                {
                    ProductId = item.ProductId,
                    ProductName = item.ProductName ?? "",
                    Quantity = item.Quantity,
                    Pieces = item.Pieces,
                    UnitPrice = item.UnitPrice,
                    Subtotal = item.Subtotal,
                }).ToList(),
            }).ToList(),
        };

    private static bool IsUniqueViolation(DbUpdateException ex, string constraint) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg
        && pg.ConstraintName == constraint;
}
