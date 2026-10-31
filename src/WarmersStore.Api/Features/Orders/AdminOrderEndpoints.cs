using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Admin;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Orders;

public sealed record AdminOrderSummaryDto(
    int Id,
    string Reference,
    OrderStatus Status,
    string CustomerName,
    string CustomerWhatsApp,
    decimal Total,
    int ItemCount,
    DateTimeOffset CreatedAt);

public sealed record AdminOrderPageDto(IReadOnlyList<AdminOrderSummaryDto> Items, int Total, int Page, int PageSize);

public sealed record AdminOrderProductDto(string ProductName, int Quantity, int Pieces, decimal? UnitPrice, decimal? Subtotal);

public sealed record AdminOrderItemDto(
    OrderItemKind Kind,
    string Name,
    int Quantity,
    decimal? UnitPrice,
    decimal Subtotal,
    decimal Discount,
    decimal LineTotal,
    IReadOnlyList<AdminOrderProductDto> Products);

public sealed record AdminOrderDto(
    int Id,
    string Reference,
    OrderStatus Status,
    DateTimeOffset StatusChangedAt,
    DateTimeOffset CreatedAt,
    string CustomerName,
    string CustomerWhatsApp,
    string Address,
    string? DeliveryInstructions,
    string? Notes,
    DeliveryMode DeliveryMode,
    string? DeliveryAreaName,
    decimal Subtotal,
    decimal DiscountTotal,
    decimal DeliveryFee,
    decimal Total,
    string WhatsAppMessage,
    IReadOnlyList<OrderStatus> AllowedNextStatuses,
    IReadOnlyList<AdminOrderItemDto> Items);

public sealed record OrderStatusRequest(OrderStatus? Status);

/// <summary>
/// Orders are only ever confirmed by a person: after the customer's WhatsApp message arrives,
/// an admin compares it with the saved order and moves it on.
/// </summary>
public static class AdminOrderEndpoints
{
    private const int PageSize = 25;

    /// <summary>Allowed moves. Cancelled and Completed are final.</summary>
    public static IReadOnlyList<OrderStatus> NextStatuses(OrderStatus status) => status switch
    {
        OrderStatus.PendingConfirmation => [OrderStatus.Confirmed, OrderStatus.Cancelled],
        OrderStatus.Confirmed => [OrderStatus.Completed, OrderStatus.Cancelled],
        _ => [],
    };

    public static RouteGroupBuilder MapAdminOrderEndpoints(this RouteGroupBuilder admin)
    {
        var orders = admin.MapGroup("/orders");

        // Newest first; filter by status and search by reference, phone or name.
        orders.MapGet("/", async (OrderStatus? status, string? q, int? page, AppDbContext db, CancellationToken ct) =>
        {
            var query = db.Orders.AsNoTracking();
            if (status is { } s)
            {
                query = query.Where(o => o.Status == s);
            }
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                var digits = new string(term.Where(char.IsAsciiDigit).ToArray());
                query = query.Where(o =>
                    EF.Functions.ILike(o.Reference, $"%{term}%")
                    || EF.Functions.ILike(o.CustomerName, $"%{term}%")
                    || (digits.Length >= 4 && o.CustomerWhatsApp.Contains(digits)));
            }

            var current = Math.Max(1, page ?? 1);
            var total = await query.CountAsync(ct);
            var items = await query
                .OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id)
                .Skip((current - 1) * PageSize).Take(PageSize)
                .Select(o => new AdminOrderSummaryDto(o.Id, o.Reference, o.Status, o.CustomerName, o.CustomerWhatsApp, o.Total, o.Items.Count, o.CreatedAt))
                .ToListAsync(ct);

            return TypedResults.Ok(new AdminOrderPageDto(items, total, current, PageSize));
        });

        orders.MapGet("/{id:int}", async Task<IResult> (int id, AppDbContext db, CancellationToken ct) =>
            await LoadAsync(db, id, ct) is { } order ? TypedResults.Ok(ToDto(order)) : TypedResults.NotFound());

        orders.MapPatch("/{id:int}/status", async Task<IResult> (int id, OrderStatusRequest request, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var order = await db.Orders.SingleOrDefaultAsync(o => o.Id == id, ct);
            if (order is null)
            {
                return TypedResults.NotFound();
            }
            if (request.Status is not { } next || !NextStatuses(order.Status).Contains(next))
            {
                return AdminResults.Conflict("لا يمكن نقل الطلب إلى هذه الحالة من حالته الحالية.");
            }

            order.Status = next;
            order.StatusChangedAt = clock.GetUtcNow();
            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(ToDto((await LoadAsync(db, id, ct))!));
        });

        return admin;
    }

    private static Task<Order?> LoadAsync(AppDbContext db, int id, CancellationToken ct) =>
        db.Orders.AsNoTracking()
            .Include(o => o.Items).ThenInclude(i => i.Products)
            .AsSplitQuery()
            .SingleOrDefaultAsync(o => o.Id == id, ct);

    private static AdminOrderDto ToDto(Order o) => new(
        o.Id, o.Reference, o.Status, o.StatusChangedAt, o.CreatedAt, o.CustomerName, o.CustomerWhatsApp, o.Address,
        o.DeliveryInstructions, o.Notes, o.DeliveryMode, o.DeliveryAreaName, o.Subtotal, o.DiscountTotal, o.DeliveryFee,
        o.Total, o.WhatsAppMessage, NextStatuses(o.Status),
        o.Items.OrderBy(i => i.Position).Select(i => new AdminOrderItemDto(
            i.Kind, i.Name, i.Quantity, i.UnitPrice, i.Subtotal, i.Discount, i.LineTotal,
            i.Products.OrderBy(p => p.Id).Select(p => new AdminOrderProductDto(p.ProductName, p.Quantity, p.Pieces, p.UnitPrice, p.Subtotal)).ToList()))
            .ToList());
}
