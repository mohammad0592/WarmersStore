using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Admin;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.CustomPackages;

public sealed record AdminProductRuleDto(int ProductId, string ProductName, int? MinQty, int? MaxQty);

public sealed record AdminDiscountTierDto(int MinItems, DiscountType Type, decimal Value, bool IsActive);

public sealed record AdminCustomRulesDto(
    bool IsEnabled,
    int? MinItems,
    int? MaxItems,
    decimal? MinSubtotal,
    int? MaxQuantityPerProduct,
    IReadOnlyList<AdminProductRuleDto> ProductRules,
    IReadOnlyList<AdminDiscountTierDto> DiscountTiers);

public sealed record ProductRuleRequest(int? ProductId, int? MinQty, int? MaxQty);

public sealed record DiscountTierRequest(int? MinItems, DiscountType? Type, decimal? Value, bool IsActive);

/// <summary>The whole rule set is saved at once; empty limits mean "no rule".</summary>
public sealed record CustomRulesRequest(
    bool IsEnabled,
    int? MinItems,
    int? MaxItems,
    decimal? MinSubtotal,
    int? MaxQuantityPerProduct,
    IReadOnlyList<ProductRuleRequest>? ProductRules,
    IReadOnlyList<DiscountTierRequest>? DiscountTiers);

public static class AdminCustomPackageEndpoints
{
    public static RouteGroupBuilder MapAdminCustomPackageEndpoints(this RouteGroupBuilder admin)
    {
        var rules = admin.MapGroup("/custom-package-rules");

        rules.MapGet("/", async (AppDbContext db, CancellationToken ct) => TypedResults.Ok(await LoadAsync(db, ct)));

        rules.MapPut("/", async Task<IResult> (CustomRulesRequest r, AppDbContext db, CancellationToken ct) =>
        {
            var errors = new ValidationErrors();
            errors.Number("minItems", r.MinItems, 1, 9999, 0, required: false);
            errors.Number("maxItems", r.MaxItems, 1, 9999, 0, required: false);
            if (r.MinItems > r.MaxItems)
            {
                errors.Add("maxItems", "الحد الأعلى يجب ألّا يقل عن الحد الأدنى.");
            }
            errors.Number("minSubtotal", r.MinSubtotal, 0m, 100_000m, 2, required: false);
            errors.Number("maxQuantityPerProduct", r.MaxQuantityPerProduct, 1, 999, 0, required: false);

            var productRules = r.ProductRules ?? [];
            var productIds = await db.Products.Select(p => p.Id).ToListAsync(ct);
            var seenProducts = new HashSet<int>();
            for (var i = 0; i < productRules.Count; i++)
            {
                var rule = productRules[i];
                if (rule?.ProductId is not { } productId || !productIds.Contains(productId))
                {
                    errors.Add($"productRules[{i}].productId", "اختر منتجاً.");
                }
                else if (!seenProducts.Add(productId))
                {
                    errors.Add($"productRules[{i}].productId", "هذا المنتج له قاعدة مسبقاً.");
                }
                errors.Number($"productRules[{i}].minQty", rule?.MinQty, 1, 999, 0, required: false);
                errors.Number($"productRules[{i}].maxQty", rule?.MaxQty, 1, 999, 0, required: false);
                if (rule?.MinQty > rule?.MaxQty)
                {
                    errors.Add($"productRules[{i}].maxQty", "الحد الأعلى يجب ألّا يقل عن الحد الأدنى.");
                }
            }

            var tiers = r.DiscountTiers ?? [];
            var seenThresholds = new HashSet<int>();
            for (var i = 0; i < tiers.Count; i++)
            {
                var tier = tiers[i];
                errors.Number($"discountTiers[{i}].minItems", tier?.MinItems, 1, 9999, 0, required: true);
                if (tier?.MinItems is { } min && !seenThresholds.Add(min))
                {
                    errors.Add($"discountTiers[{i}].minItems", "يوجد خصم آخر بنفس عدد الوحدات.");
                }
                if (tier?.Type is null)
                {
                    errors.Add($"discountTiers[{i}].type", "اختر نوع الخصم.");
                }
                var maxValue = tier?.Type == DiscountType.Percent ? 100m : 100_000m;
                errors.Number($"discountTiers[{i}].value", tier?.Value, 0.01m, maxValue, 2, required: true);
            }

            if (errors.Any)
            {
                return errors.ToResult();
            }

            var settings = await db.CustomPackageSettings.SingleAsync(ct);
            settings.IsEnabled = r.IsEnabled;
            settings.MinItems = r.MinItems;
            settings.MaxItems = r.MaxItems;
            settings.MinSubtotal = r.MinSubtotal;
            settings.MaxQuantityPerProduct = r.MaxQuantityPerProduct;

            // Replace the per-product rules and tiers with what was sent; rows with no limits are dropped.
            db.ProductCustomRules.RemoveRange(await db.ProductCustomRules.ToListAsync(ct));
            db.ProductCustomRules.AddRange(productRules
                .Where(x => x.MinQty is not null || x.MaxQty is not null)
                .Select(x => new ProductCustomRule { ProductId = x.ProductId!.Value, MinQty = x.MinQty, MaxQty = x.MaxQty }));

            db.CustomDiscountTiers.RemoveRange(await db.CustomDiscountTiers.ToListAsync(ct));
            db.CustomDiscountTiers.AddRange(tiers.Select(x => new CustomDiscountTier
            {
                MinItems = x.MinItems!.Value,
                Type = x.Type!.Value,
                Value = x.Value!.Value,
                IsActive = x.IsActive,
            }));

            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(await LoadAsync(db, ct));
        });

        return admin;
    }

    private static async Task<AdminCustomRulesDto> LoadAsync(AppDbContext db, CancellationToken ct)
    {
        var s = await db.CustomPackageSettings.AsNoTracking().SingleAsync(ct);
        var productRules = (await db.ProductCustomRules.AsNoTracking().Include(r => r.Product).ToListAsync(ct))
            .OrderBy(r => r.Product.DisplayOrder)
            .Select(r => new AdminProductRuleDto(r.ProductId, r.Product.Name.Ar, r.MinQty, r.MaxQty))
            .ToList();
        var tiers = await db.CustomDiscountTiers.AsNoTracking()
            .OrderBy(t => t.MinItems)
            .Select(t => new AdminDiscountTierDto(t.MinItems, t.Type, t.Value, t.IsActive))
            .ToListAsync(ct);

        return new AdminCustomRulesDto(s.IsEnabled, s.MinItems, s.MaxItems, s.MinSubtotal, s.MaxQuantityPerProduct, productRules, tiers);
    }
}
