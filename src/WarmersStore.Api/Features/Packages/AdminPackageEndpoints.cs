using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Admin;
using WarmersStore.Api.Features.Catalog;
using WarmersStore.Api.Features.Media;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Packages;

public sealed record AdminPackageItemDto(int ProductId, string ProductName, int Quantity, bool ProductActive, decimal? ProductUnitPrice);

public sealed record AdminPackageDto(
    int Id,
    string Slug,
    string Name,
    string? Description,
    string? ImageUrl,
    decimal Price,
    decimal? RegularPrice,
    bool IsActive,
    bool IsFeatured,
    int DisplayOrder,
    IReadOnlyList<AdminPackageItemDto> Items,
    uint Version);

public sealed record PackageItemRequest(int? ProductId, int? Quantity);

public sealed record PackageRequest(
    string? Slug,
    string? Name,
    string? Description,
    decimal? Price,
    bool IsActive,
    bool IsFeatured,
    IReadOnlyList<PackageItemRequest>? Items,
    uint? Version);

public static class AdminPackageEndpoints
{
    private const int MaxItems = 20;
    private const long MaxRequestBytes = 6 * 1024 * 1024;

    public static RouteGroupBuilder MapAdminPackageEndpoints(this RouteGroupBuilder admin)
    {
        var packages = admin.MapGroup("/packages");

        packages.MapGet("/", async (AppDbContext db, CancellationToken ct) =>
            TypedResults.Ok((await Query(db).OrderBy(p => p.DisplayOrder).ThenBy(p => p.Id).ToListAsync(ct)).Select(ToDto).ToList()));

        packages.MapGet("/{id:int}", async Task<IResult> (int id, AppDbContext db, CancellationToken ct) =>
            await Query(db).SingleOrDefaultAsync(p => p.Id == id, ct) is { } package
                ? TypedResults.Ok(ToDto(package))
                : TypedResults.NotFound());

        packages.MapPost("/", async Task<IResult> (PackageRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var errors = new ValidationErrors();
            var package = new ReadyMadePackage { Slug = "", Name = LocalizedText.Arabic("") };
            await ApplyAsync(request, package, db, errors, ct);
            if (errors.Any)
            {
                return errors.ToResult();
            }

            package.DisplayOrder = (await db.Packages.MaxAsync(p => (int?)p.DisplayOrder, ct) ?? 0) + 1;
            db.Packages.Add(package);
            await db.SaveChangesAsync(ct);
            return TypedResults.Created($"/api/admin/packages/{package.Id}", ToDto(await Query(db).SingleAsync(p => p.Id == package.Id, ct)));
        });

        packages.MapPut("/{id:int}", async Task<IResult> (int id, PackageRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var package = await db.Packages.Include(p => p.Items).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (package is null)
            {
                return TypedResults.NotFound();
            }

            var errors = new ValidationErrors();
            if (request.Version is null)
            {
                errors.Add("version", "Version is required.");
            }
            await ApplyAsync(request, package, db, errors, ct);
            if (errors.Any)
            {
                return errors.ToResult();
            }

            db.Entry(package).Property(p => p.Version).OriginalValue = request.Version!.Value;
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return AdminResults.StaleVersion();
            }
            return TypedResults.Ok(ToDto(await Query(db).SingleAsync(p => p.Id == id, ct)));
        });

        // Soft delete: the package disappears everywhere but stays in the database for old orders;
        // its slug becomes free for a new package.
        packages.MapDelete("/{id:int}", async Task<IResult> (int id, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var package = await db.Packages.SingleOrDefaultAsync(p => p.Id == id, ct);
            if (package is null)
            {
                return TypedResults.NotFound();
            }

            package.DeletedAt = clock.GetUtcNow();
            package.IsActive = false;
            package.IsFeatured = false;
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        });

        packages.MapPut("/order", async Task<IResult> (ReorderRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var all = await db.Packages.ToListAsync(ct);
            if (request.Ids is null || request.Ids.Count != all.Count || !request.Ids.Order().SequenceEqual(all.Select(p => p.Id).Order()))
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["ids"] = ["Send every package id exactly once."] });
            }

            var byId = all.ToDictionary(p => p.Id);
            for (var i = 0; i < request.Ids.Count; i++)
            {
                byId[request.Ids[i]].DisplayOrder = i + 1;
            }
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        });

        packages.MapPut("/{id:int}/image", async Task<IResult> (
                int id, IFormFile? file, AppDbContext db, IImageStorage storage, IOptions<MediaOptions> media, CancellationToken ct) =>
            {
                var package = await db.Packages.SingleOrDefaultAsync(p => p.Id == id, ct);
                if (package is null)
                {
                    return TypedResults.NotFound();
                }

                var processed = await ImageProcessor.ProcessAsync(file, media.Value.MaxUploadBytes, ct);
                if (processed.Error is not null)
                {
                    return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = [processed.Error] });
                }

                string key;
                await using (processed.Webp)
                {
                    key = await storage.SaveAsync("packages", processed.Webp!, ct);
                }

                var previous = package.ImageKey;
                package.ImageKey = key;
                await db.SaveChangesAsync(ct);
                await storage.DeleteAsync(previous, ct);
                return TypedResults.Ok(new { imageUrl = MediaUrls.For(key) });
            })
            .DisableAntiforgery() // protected by the X-Dafa-Admin header + SameSite cookie instead
            .WithMetadata(new RequestSizeLimitAttribute(MaxRequestBytes));

        packages.MapDelete("/{id:int}/image", async Task<IResult> (int id, AppDbContext db, IImageStorage storage, CancellationToken ct) =>
        {
            var package = await db.Packages.SingleOrDefaultAsync(p => p.Id == id, ct);
            if (package is null)
            {
                return TypedResults.NotFound();
            }

            var previous = package.ImageKey;
            package.ImageKey = null;
            await db.SaveChangesAsync(ct);
            await storage.DeleteAsync(previous, ct);
            return TypedResults.NoContent();
        });

        return admin;
    }

    private static IQueryable<ReadyMadePackage> Query(AppDbContext db) =>
        db.Packages.AsNoTracking().Include(p => p.Items).ThenInclude(i => i.Product);

    private static async Task ApplyAsync(PackageRequest r, ReadyMadePackage p, AppDbContext db, ValidationErrors errors, CancellationToken ct)
    {
        var slug = errors.Slug("slug", r.Slug);
        if (slug is not null && await db.Packages.AnyAsync(x => x.Slug == slug && x.Id != p.Id, ct))
        {
            errors.Add("slug", "هذا المعرّف مستخدم لباقة أخرى.");
        }
        p.Slug = slug ?? p.Slug;
        p.Name = AdminResults.Localized(errors.Required("name", r.Name, 120), p.Name) ?? p.Name;
        p.Description = AdminResults.Localized(errors.Optional("description", r.Description, 1000), p.Description);

        errors.Number("price", r.Price, 0m, 100_000m, 2, required: true);
        p.Price = r.Price ?? p.Price;
        p.IsActive = r.IsActive;
        p.IsFeatured = r.IsFeatured;

        var items = r.Items ?? [];
        if (items.Count == 0)
        {
            errors.Add("items", "أضف منتجاً واحداً على الأقل للباقة.");
            return;
        }
        if (items.Count > MaxItems)
        {
            errors.Add("items", $"الحد الأقصى {MaxItems} منتجاً في الباقة.");
            return;
        }

        var productIds = items.Where(i => i?.ProductId is not null).Select(i => i.ProductId!.Value).ToList();
        var existing = await db.Products.Where(x => productIds.Contains(x.Id)).Select(x => x.Id).ToListAsync(ct);
        var seen = new HashSet<int>();
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            if (item?.ProductId is not { } productId || !existing.Contains(productId))
            {
                errors.Add($"items[{i}].productId", "اختر منتجاً.");
            }
            else if (!seen.Add(productId))
            {
                errors.Add($"items[{i}].productId", "هذا المنتج مضاف مسبقاً، عدّل كميته بدلاً من تكراره.");
            }
            errors.Number($"items[{i}].quantity", item?.Quantity, 1, 999, 0, required: true);
        }
        if (errors.Any)
        {
            return;
        }

        // Replace the contents: remove what's gone, update quantities, add new products.
        var requested = items.ToDictionary(i => i.ProductId!.Value, i => i.Quantity!.Value);
        p.Items.RemoveAll(i => !requested.ContainsKey(i.ProductId));
        foreach (var (productId, quantity) in requested)
        {
            var current = p.Items.FirstOrDefault(i => i.ProductId == productId);
            if (current is null)
            {
                p.Items.Add(new PackageItem { ProductId = productId, Quantity = quantity });
            }
            else
            {
                current.Quantity = quantity;
            }
        }
    }

    private static AdminPackageDto ToDto(ReadyMadePackage p) => new(
        p.Id,
        p.Slug,
        p.Name.Ar,
        p.Description?.Ar,
        MediaUrls.For(p.ImageKey),
        p.Price,
        PackageDto.ComputeRegularPrice(p.Items),
        p.IsActive,
        p.IsFeatured,
        p.DisplayOrder,
        p.Items.OrderBy(i => i.Product.DisplayOrder)
            .Select(i => new AdminPackageItemDto(i.ProductId, i.Product.Name.Ar, i.Quantity, i.Product.IsActive, i.Product.UnitPrice))
            .ToList(),
        p.Version);
}
