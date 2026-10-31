using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Media;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Packages;

public sealed record PackageItemDto(
    int ProductId,
    string ProductSlug,
    string ProductName,
    int Quantity,
    SellingUnit SellingUnit,
    int PiecesPerSellingUnit,
    string? ImageUrl);

public sealed record PackageDto(
    int Id,
    string Slug,
    string Name,
    string? Description,
    string? ImageUrl,
    decimal Price,
    decimal? RegularPrice,
    bool IsFeatured,
    bool IsAvailable,
    IReadOnlyList<PackageItemDto> Items)
{
    public static PackageDto From(ReadyMadePackage p)
    {
        var items = p.Items.OrderBy(i => i.Product.DisplayOrder).ThenBy(i => i.ProductId).ToList();

        return new(
            p.Id,
            p.Slug,
            p.Name.Resolve(PublicApi.Language),
            p.Description?.Resolve(PublicApi.Language),
            MediaUrls.For(p.ImageKey),
            p.Price,
            ComputeRegularPrice(items),
            p.IsFeatured,
            // A package can only be ordered while every product in it is active.
            IsAvailable: items.Count > 0 && items.All(i => i.Product.IsActive),
            items.Select(i => new PackageItemDto(
                i.ProductId,
                i.Product.Slug,
                i.Product.Name.Resolve(PublicApi.Language),
                i.Quantity,
                i.Product.SellingUnit,
                i.Product.PiecesPerSellingUnit,
                MediaUrls.For(i.Product.Images.OrderBy(img => img.SortOrder).FirstOrDefault()?.StorageKey)))
            .ToList());
    }

    /// <summary>What the contents would cost bought individually; null if any product is unpriced.</summary>
    public static decimal? ComputeRegularPrice(IEnumerable<PackageItem> items)
    {
        decimal total = 0;
        foreach (var item in items)
        {
            if (item.Product.UnitPrice is not { } unitPrice)
            {
                return null;
            }
            total += unitPrice * item.Quantity;
        }
        return total;
    }
}

public static class PackageEndpoints
{
    public static RouteGroupBuilder MapPackageEndpoints(this RouteGroupBuilder api)
    {
        var packages = api.MapGroup("/packages").WithTags("Packages");

        packages.MapGet("/", async (AppDbContext db, CancellationToken ct) =>
        {
            var items = await PublicPackages(db)
                .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Id)
                .ToListAsync(ct);

            return TypedResults.Ok(items.Select(PackageDto.From).ToList());
        });

        packages.MapGet("/{slug}", async Task<IResult> (string slug, AppDbContext db, CancellationToken ct) =>
        {
            var package = await PublicPackages(db).SingleOrDefaultAsync(p => p.Slug == slug, ct);

            return package is null ? TypedResults.NotFound() : TypedResults.Ok(PackageDto.From(package));
        });

        return api;
    }

    // Deleted packages are excluded by the global query filter.
    private static IQueryable<ReadyMadePackage> PublicPackages(AppDbContext db) =>
        db.Packages.AsNoTracking()
            .Include(p => p.Items).ThenInclude(i => i.Product).ThenInclude(p => p.Images)
            .AsSplitQuery()
            .Where(p => p.IsActive);
}
