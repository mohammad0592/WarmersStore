using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Media;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Catalog;

public sealed record ProductImageDto(string Url, string? Alt);

public sealed record ProductDto(
    int Id,
    string Slug,
    string Name,
    string? ShortDescription,
    string? Description,
    string? UsageGuidance,
    string? SafetyInfo,
    decimal WidthCm,
    decimal HeightCm,
    decimal? HeatMinHours,
    decimal? HeatMaxHours,
    bool? IsAdhesive,
    int PiecesPerRetailBag,
    SellingUnit SellingUnit,
    int PiecesPerSellingUnit,
    decimal? UnitPrice,
    bool AvailableForCustom,
    IReadOnlyList<ProductImageDto> Images)
{
    public static ProductDto From(Product p) => new(
        p.Id,
        p.Slug,
        p.Name.Resolve(PublicApi.Language),
        p.ShortDescription?.Resolve(PublicApi.Language),
        p.Description?.Resolve(PublicApi.Language),
        p.UsageGuidance?.Resolve(PublicApi.Language),
        p.SafetyInfo?.Resolve(PublicApi.Language),
        p.WidthCm,
        p.HeightCm,
        p.HeatMinHours,
        p.HeatMaxHours,
        p.IsAdhesive,
        p.PiecesPerRetailBag,
        p.SellingUnit,
        p.PiecesPerSellingUnit,
        p.UnitPrice,
        AvailableForCustom: p.IsActive && p.IsCustomEligible && p.UnitPrice is not null,
        p.Images.OrderBy(i => i.SortOrder).Select(i => new ProductImageDto(MediaUrls.For(i.StorageKey)!, i.AltText)).ToList());
}

public static class CatalogEndpoints
{
    public static RouteGroupBuilder MapCatalogEndpoints(this RouteGroupBuilder api)
    {
        var products = api.MapGroup("/products").WithTags("Products");

        products.MapGet("/", async (AppDbContext db, CancellationToken ct) =>
        {
            var items = await db.Products.AsNoTracking()
                .Include(p => p.Images)
                .Where(p => p.IsActive)
                .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Id)
                .ToListAsync(ct);

            return TypedResults.Ok(items.Select(ProductDto.From).ToList());
        });

        products.MapGet("/{slug}", async Task<IResult> (string slug, AppDbContext db, CancellationToken ct) =>
        {
            var product = await db.Products.AsNoTracking()
                .Include(p => p.Images)
                .SingleOrDefaultAsync(p => p.Slug == slug && p.IsActive, ct);

            return product is null ? TypedResults.NotFound() : TypedResults.Ok(ProductDto.From(product));
        });

        return api;
    }
}
