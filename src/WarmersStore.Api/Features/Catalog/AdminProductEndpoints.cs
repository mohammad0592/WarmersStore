using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Admin;
using WarmersStore.Api.Features.Media;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Catalog;

public sealed record AdminProductImageDto(int Id, string Url, string? AltText);

public sealed record AdminProductDto(
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
    bool IsActive,
    bool IsCustomEligible,
    int DisplayOrder,
    IReadOnlyList<string> UsedInPackages,
    IReadOnlyList<AdminProductImageDto> Images,
    uint Version);

/// <param name="Version">Required on update: the version the form was loaded with.</param>
public sealed record ProductRequest(
    string? Slug,
    string? Name,
    string? ShortDescription,
    string? Description,
    string? UsageGuidance,
    string? SafetyInfo,
    decimal? WidthCm,
    decimal? HeightCm,
    decimal? HeatMinHours,
    decimal? HeatMaxHours,
    bool? IsAdhesive,
    int? PiecesPerRetailBag,
    SellingUnit? SellingUnit,
    decimal? UnitPrice,
    bool IsActive,
    bool IsCustomEligible,
    uint? Version);

public sealed record ReorderRequest(IReadOnlyList<int>? Ids);

public static class AdminProductEndpoints
{
    private const long MaxRequestBytes = 6 * 1024 * 1024;

    public static RouteGroupBuilder MapAdminProductEndpoints(this RouteGroupBuilder admin)
    {
        var products = admin.MapGroup("/products");

        products.MapGet("/", async (AppDbContext db, CancellationToken ct) =>
        {
            var all = await Query(db).OrderBy(p => p.DisplayOrder).ThenBy(p => p.Id).ToListAsync(ct);
            var packages = await PackageNamesAsync(db, all.Select(p => p.Id).ToList(), ct);
            return TypedResults.Ok(all.Select(p => ToDto(p, packages.GetValueOrDefault(p.Id) ?? [])).ToList());
        });

        products.MapGet("/{id:int}", async Task<IResult> (int id, AppDbContext db, CancellationToken ct) =>
            await Query(db).SingleOrDefaultAsync(p => p.Id == id, ct) is { } product
                ? TypedResults.Ok(ToDto(product, await PackageNamesAsync(db, id, ct)))
                : TypedResults.NotFound());

        products.MapPost("/", async Task<IResult> (ProductRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var errors = new ValidationErrors();
            var product = new Product { Slug = "", Name = LocalizedText.Arabic("") };
            Apply(request, product, errors);
            await CheckSlugAsync(db, product.Slug, null, errors, ct);
            if (errors.Any)
            {
                return errors.ToResult();
            }

            product.DisplayOrder = (await db.Products.MaxAsync(p => (int?)p.DisplayOrder, ct) ?? 0) + 1;
            db.Products.Add(product);
            await db.SaveChangesAsync(ct);
            return TypedResults.Created($"/api/admin/products/{product.Id}", ToDto(product, []));
        });

        products.MapPut("/{id:int}", async Task<IResult> (int id, ProductRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var product = await db.Products.Include(p => p.Images).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (product is null)
            {
                return TypedResults.NotFound();
            }

            var errors = new ValidationErrors();
            if (request.Version is null)
            {
                errors.Add("version", "Version is required.");
            }
            Apply(request, product, errors);
            await CheckSlugAsync(db, product.Slug, id, errors, ct);
            if (errors.Any)
            {
                return errors.ToResult();
            }

            db.Entry(product).Property(p => p.Version).OriginalValue = request.Version!.Value;
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return AdminResults.StaleVersion();
            }
            return TypedResults.Ok(ToDto(product, await PackageNamesAsync(db, id, ct)));
        });

        products.MapDelete("/{id:int}", async Task<IResult> (int id, AppDbContext db, IImageStorage storage, CancellationToken ct) =>
        {
            var product = await db.Products.Include(p => p.Images).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (product is null)
            {
                return TypedResults.NotFound();
            }

            var packages = await PackageNamesAsync(db, id, ct);
            if (packages.Count > 0)
            {
                return AdminResults.Conflict(
                    $"المنتج موجود في باقات ({string.Join("، ", packages)}). أوقف تفعيله بدل حذفه، أو احذفه من الباقات أولاً.");
            }

            var keys = product.Images.Select(i => i.StorageKey).ToList();
            db.Products.Remove(product);
            await db.SaveChangesAsync(ct);
            foreach (var key in keys)
            {
                await storage.DeleteAsync(key, ct);
            }
            return TypedResults.NoContent();
        });

        products.MapPut("/order", async Task<IResult> (ReorderRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var all = await db.Products.ToListAsync(ct);
            if (request.Ids is null || request.Ids.Count != all.Count || !request.Ids.Order().SequenceEqual(all.Select(p => p.Id).Order()))
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["ids"] = ["Send every product id exactly once."] });
            }

            var byId = all.ToDictionary(p => p.Id);
            for (var i = 0; i < request.Ids.Count; i++)
            {
                byId[request.Ids[i]].DisplayOrder = i + 1;
            }
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        });

        // ---- Images ----

        products.MapPost("/{id:int}/images", async Task<IResult> (
                int id, IFormFile? file, [FromForm] string? altText,
                AppDbContext db, IImageStorage storage, IOptions<MediaOptions> media, CancellationToken ct) =>
            {
                var product = await db.Products.Include(p => p.Images).SingleOrDefaultAsync(p => p.Id == id, ct);
                if (product is null)
                {
                    return TypedResults.NotFound();
                }
                if (product.Images.Count >= 10)
                {
                    return ImageError("الحد الأقصى 10 صور للمنتج.");
                }

                var processed = await ImageProcessor.ProcessAsync(file, media.Value.MaxUploadBytes, ct);
                if (processed.Error is not null)
                {
                    return ImageError(processed.Error);
                }

                string key;
                await using (processed.Webp)
                {
                    key = await storage.SaveAsync("products", processed.Webp!, ct);
                }

                var image = new ProductImage
                {
                    StorageKey = key,
                    AltText = string.IsNullOrWhiteSpace(altText) ? null : altText.Trim()[..Math.Min(altText.Trim().Length, 200)],
                    SortOrder = (product.Images.Max(i => (int?)i.SortOrder) ?? 0) + 1,
                };
                product.Images.Add(image);
                await db.SaveChangesAsync(ct);
                return TypedResults.Created(MediaUrls.For(key), new AdminProductImageDto(image.Id, MediaUrls.For(key)!, image.AltText));
            })
            .DisableAntiforgery() // protected by the X-Dafa-Admin header + SameSite cookie instead
            .WithMetadata(new RequestSizeLimitAttribute(MaxRequestBytes));

        products.MapDelete("/{id:int}/images/{imageId:int}", async Task<IResult> (
            int id, int imageId, AppDbContext db, IImageStorage storage, CancellationToken ct) =>
        {
            var image = await db.ProductImages.SingleOrDefaultAsync(i => i.Id == imageId && i.ProductId == id, ct);
            if (image is null)
            {
                return TypedResults.NotFound();
            }

            db.ProductImages.Remove(image);
            await db.SaveChangesAsync(ct);
            await storage.DeleteAsync(image.StorageKey, ct);
            return TypedResults.NoContent();
        });

        products.MapPut("/{id:int}/images/order", async Task<IResult> (int id, ReorderRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var images = await db.ProductImages.Where(i => i.ProductId == id).ToListAsync(ct);
            if (request.Ids is null || request.Ids.Count != images.Count || !request.Ids.Order().SequenceEqual(images.Select(i => i.Id).Order()))
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["ids"] = ["Send every image id exactly once."] });
            }

            var byId = images.ToDictionary(i => i.Id);
            for (var i = 0; i < request.Ids.Count; i++)
            {
                byId[request.Ids[i]].SortOrder = i + 1;
            }
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        });

        return admin;
    }

    private static IQueryable<Product> Query(AppDbContext db) =>
        db.Products.AsNoTracking().Include(p => p.Images);

    /// <summary>Names of the (non-deleted) packages each product is part of.</summary>
    private static async Task<Dictionary<int, List<string>>> PackageNamesAsync(AppDbContext db, IReadOnlyCollection<int> productIds, CancellationToken ct)
    {
        var rows = await db.PackageItems.AsNoTracking()
            .Where(i => productIds.Contains(i.ProductId))
            .Join(db.Packages, i => i.PackageId, p => p.Id, (i, p) => new { i.ProductId, Package = p }) // query filter hides deleted packages
            .ToListAsync(ct);

        return rows
            .GroupBy(r => r.ProductId)
            .ToDictionary(g => g.Key, g => g.Select(r => r.Package.Name.Ar).Order().ToList());
    }

    private static async Task<List<string>> PackageNamesAsync(AppDbContext db, int productId, CancellationToken ct) =>
        (await PackageNamesAsync(db, [productId], ct)).GetValueOrDefault(productId) ?? [];

    private static IResult ImageError(string message) =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = [message] });

    private static void Apply(ProductRequest r, Product p, ValidationErrors errors)
    {
        p.Slug = errors.Slug("slug", r.Slug) ?? p.Slug;
        p.Name = AdminResults.Localized(errors.Required("name", r.Name, 120), p.Name) ?? p.Name;
        p.ShortDescription = AdminResults.Localized(errors.Optional("shortDescription", r.ShortDescription, 300), p.ShortDescription);
        p.Description = AdminResults.Localized(errors.Optional("description", r.Description, 3000), p.Description);
        p.UsageGuidance = AdminResults.Localized(errors.Optional("usageGuidance", r.UsageGuidance, 3000), p.UsageGuidance);
        p.SafetyInfo = AdminResults.Localized(errors.Optional("safetyInfo", r.SafetyInfo, 3000), p.SafetyInfo);

        errors.Number("widthCm", r.WidthCm, 0.1m, 100m, 1, required: true);
        errors.Number("heightCm", r.HeightCm, 0.1m, 100m, 1, required: true);
        errors.Number("heatMinHours", r.HeatMinHours, 0.5m, 72m, 1, required: false);
        errors.Number("heatMaxHours", r.HeatMaxHours, 0.5m, 72m, 1, required: false);
        if (r.HeatMinHours > r.HeatMaxHours)
        {
            errors.Add("heatMaxHours", "أقصى مدة يجب ألّا تقل عن أقل مدة.");
        }
        errors.Number("piecesPerRetailBag", r.PiecesPerRetailBag, 1, 100, 0, required: true);
        errors.Number("unitPrice", r.UnitPrice, 0m, 10_000m, 2, required: false);
        if (r.SellingUnit is null)
        {
            errors.Add("sellingUnit", "هذا الحقل مطلوب.");
        }
        if (r.IsActive && r.UnitPrice is null)
        {
            errors.Add("unitPrice", "لا يمكن تفعيل منتج بدون سعر.");
        }

        p.WidthCm = r.WidthCm ?? p.WidthCm;
        p.HeightCm = r.HeightCm ?? p.HeightCm;
        p.HeatMinHours = r.HeatMinHours;
        p.HeatMaxHours = r.HeatMaxHours;
        p.IsAdhesive = r.IsAdhesive;
        p.PiecesPerRetailBag = r.PiecesPerRetailBag ?? p.PiecesPerRetailBag;
        p.SellingUnit = r.SellingUnit ?? p.SellingUnit;
        // One unit is either a single warmer or the whole factory bag; bags are never split.
        p.PiecesPerSellingUnit = p.SellingUnit == SellingUnit.Piece ? 1 : p.PiecesPerRetailBag;
        p.UnitPrice = r.UnitPrice;
        p.IsActive = r.IsActive;
        p.IsCustomEligible = r.IsCustomEligible;
    }

    private static async Task CheckSlugAsync(AppDbContext db, string slug, int? exceptId, ValidationErrors errors, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(slug) && await db.Products.AnyAsync(p => p.Slug == slug && p.Id != exceptId, ct))
        {
            errors.Add("slug", "هذا المعرّف مستخدم لمنتج آخر.");
        }
    }

    private static AdminProductDto ToDto(Product p, IReadOnlyList<string> packages) => new(
        p.Id, p.Slug, p.Name.Ar, p.ShortDescription?.Ar, p.Description?.Ar, p.UsageGuidance?.Ar, p.SafetyInfo?.Ar,
        p.WidthCm, p.HeightCm, p.HeatMinHours, p.HeatMaxHours, p.IsAdhesive, p.PiecesPerRetailBag,
        p.SellingUnit, p.PiecesPerSellingUnit, p.UnitPrice, p.IsActive, p.IsCustomEligible, p.DisplayOrder,
        packages,
        p.Images.OrderBy(i => i.SortOrder).Select(i => new AdminProductImageDto(i.Id, MediaUrls.For(i.StorageKey)!, i.AltText)).ToList(),
        p.Version);
}
