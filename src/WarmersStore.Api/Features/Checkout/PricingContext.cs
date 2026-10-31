using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Checkout;

/// <summary>Everything the pricing engine needs, loaded fresh from the database for each request.</summary>
public sealed record PricingContext(
    IReadOnlyDictionary<int, ReadyMadePackage> Packages,
    IReadOnlyDictionary<int, Product> Products,
    CustomPackageSettings CustomSettings,
    IReadOnlyDictionary<int, ProductCustomRule> ProductRules,
    IReadOnlyList<CustomDiscountTier> DiscountTiers,
    DeliverySettings Delivery,
    IReadOnlyDictionary<int, DeliveryArea> DeliveryAreas,
    StoreSettings Store)
{
    public static async Task<PricingContext> LoadAsync(
        AppDbContext db, IReadOnlyList<CartLineRequest> lines, int? deliveryAreaId, CancellationToken ct)
    {
        var packageIds = lines
            .Where(l => l.Kind == CartLineKind.ReadyMade && l.PackageId is not null)
            .Select(l => l.PackageId!.Value)
            .Distinct()
            .ToList();

        var productIds = lines
            .Where(l => l.Kind == CartLineKind.Custom)
            .SelectMany(l => l.Items ?? [])
            .Where(i => i.ProductId is not null)
            .Select(i => i.ProductId!.Value)
            .Distinct()
            .ToList();

        // Only active, non-deleted packages can be priced; anything else reads as "not found".
        var packages = await db.Packages.AsNoTracking()
            .Include(p => p.Items).ThenInclude(i => i.Product)
            .AsSplitQuery()
            .Where(p => packageIds.Contains(p.Id) && p.IsActive)
            .ToDictionaryAsync(p => p.Id, ct);

        // Inactive products are loaded too, so errors can name the product that became unavailable.
        var products = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var rules = await db.ProductCustomRules.AsNoTracking()
            .Where(r => productIds.Contains(r.ProductId))
            .ToDictionaryAsync(r => r.ProductId, ct);

        var tiers = await db.CustomDiscountTiers.AsNoTracking().Where(t => t.IsActive).ToListAsync(ct);

        var areas = deliveryAreaId is { } areaId
            ? await db.DeliveryAreas.AsNoTracking()
                .Where(a => a.Id == areaId && a.IsActive)
                .ToDictionaryAsync(a => a.Id, ct)
            : [];

        return new PricingContext(
            packages,
            products,
            await db.CustomPackageSettings.AsNoTracking().SingleAsync(ct),
            rules,
            tiers,
            await db.DeliverySettings.AsNoTracking().SingleAsync(ct),
            areas,
            await db.StoreSettings.AsNoTracking().SingleAsync(ct));
    }
}
