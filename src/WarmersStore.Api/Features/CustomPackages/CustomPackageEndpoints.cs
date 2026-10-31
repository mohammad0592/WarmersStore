using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.CustomPackages;

public sealed record ProductRuleDto(int ProductId, int? MinQty, int? MaxQty);

public sealed record DiscountTierDto(int MinItems, DiscountType Type, decimal Value);

/// <summary>The rules the builder must respect. Null limits mean the rule is not configured.</summary>
public sealed record CustomPackageRulesDto(
    bool IsEnabled,
    int? MinItems,
    int? MaxItems,
    decimal? MinSubtotal,
    IReadOnlyList<ProductRuleDto> ProductRules,
    IReadOnlyList<DiscountTierDto> DiscountTiers);

public static class CustomPackageEndpoints
{
    public static RouteGroupBuilder MapCustomPackageEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/custom-package-rules", async (AppDbContext db, CancellationToken ct) =>
        {
            var settings = await db.CustomPackageSettings.AsNoTracking().SingleAsync(ct);

            var productRules = await db.ProductCustomRules.AsNoTracking()
                .Where(r => r.Product.IsActive && (r.MinQty != null || r.MaxQty != null))
                .OrderBy(r => r.ProductId)
                .Select(r => new ProductRuleDto(r.ProductId, r.MinQty, r.MaxQty))
                .ToListAsync(ct);

            var tiers = await db.CustomDiscountTiers.AsNoTracking()
                .Where(t => t.IsActive)
                .OrderBy(t => t.MinItems)
                .Select(t => new DiscountTierDto(t.MinItems, t.Type, t.Value))
                .ToListAsync(ct);

            return TypedResults.Ok(new CustomPackageRulesDto(
                settings.IsEnabled, settings.MinItems, settings.MaxItems, settings.MinSubtotal, productRules, tiers));
        })
        .WithTags("Custom packages");

        return api;
    }
}
