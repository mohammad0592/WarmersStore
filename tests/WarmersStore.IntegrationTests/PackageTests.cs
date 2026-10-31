using System.Net;
using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Packages;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class PackageTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    [Fact]
    public async Task Packages_ExcludeInactiveAndDeleted()
    {
        await Api.WithDbAsync(async db =>
        {
            var body = await PricedActive(db, "body-warmer", 6m);
            db.Packages.AddRange(
                Package("visible", 1, (body, 1)),
                Package("inactive", 2, (body, 1), isActive: false),
                Package("deleted", 3, (body, 1), deletedAt: DateTimeOffset.UtcNow));
            await db.SaveChangesAsync();
        });

        var packages = await Api.GetJsonAsync<List<PackageDto>>("/api/packages");

        Assert.Equal(["visible"], packages.Select(p => p.Slug));
        Assert.Equal(HttpStatusCode.NotFound, (await Api.Client.GetAsync("/api/packages/deleted")).StatusCode);
    }

    [Fact]
    public async Task Package_ShowsContentsAndRegularPrice()
    {
        await Api.WithDbAsync(async db =>
        {
            var body = await PricedActive(db, "body-warmer", 6m);
            var hand = await PricedActive(db, "hand-warmer", 5m);
            db.Packages.Add(Package("weekly", 1, (body, 5), (hand, 2)));
            await db.SaveChangesAsync();
        });

        var package = await Api.GetJsonAsync<PackageDto>("/api/packages/weekly");

        Assert.Equal(49m, package.Price);
        Assert.Equal(40m, package.RegularPrice); // 5 × 6 + 2 × 5
        Assert.True(package.IsAvailable);
        Assert.Equal([("body-warmer", 5), ("hand-warmer", 2)], package.Items.Select(i => (i.ProductSlug, i.Quantity)));
        Assert.All(package.Items, i => Assert.Equal(SellingUnit.RetailBag, i.SellingUnit));
    }

    [Fact]
    public async Task Package_WithInactiveProduct_IsListedButUnavailable_AndUnpricedProductHidesRegularPrice()
    {
        await Api.WithDbAsync(async db =>
        {
            var body = await PricedActive(db, "body-warmer", 6m);
            var toe = await db.Products.SingleAsync(p => p.Slug == "toe-warmer"); // inactive, unpriced
            db.Packages.Add(Package("mixed", 1, (body, 1), (toe, 1)));
            await db.SaveChangesAsync();
        });

        var package = await Api.GetJsonAsync<PackageDto>("/api/packages/mixed");

        Assert.False(package.IsAvailable);
        Assert.Null(package.RegularPrice);
    }

    [Fact]
    public async Task DeletingProductUsedInPackage_IsRejectedByDatabase()
    {
        await Api.WithDbAsync(async db =>
        {
            var body = await PricedActive(db, "body-warmer", 6m);
            db.Packages.Add(Package("p", 1, (body, 1)));
            await db.SaveChangesAsync();
        });

        // Fresh context with no tracked package items, so the foreign key itself must refuse it.
        await Api.WithDbAsync(async db =>
        {
            db.Products.Remove(await db.Products.SingleAsync(p => p.Slug == "body-warmer"));
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        });
    }

    private static async Task<Product> PricedActive(Api.Infrastructure.Persistence.AppDbContext db, string slug, decimal price)
    {
        var product = await db.Products.SingleAsync(p => p.Slug == slug);
        product.IsActive = true;
        product.UnitPrice = price;
        return product;
    }

    private static ReadyMadePackage Package(
        string slug, int order, (Product Product, int Qty) first, (Product Product, int Qty)? second = null,
        bool isActive = true, DateTimeOffset? deletedAt = null)
    {
        var package = new ReadyMadePackage
        {
            Slug = slug,
            Name = LocalizedText.Arabic($"باقة {slug}"),
            Price = 49m,
            IsActive = isActive,
            DisplayOrder = order,
            DeletedAt = deletedAt,
        };
        package.Items.Add(new PackageItem { Product = first.Product, Quantity = first.Qty });
        if (second is { } s)
        {
            package.Items.Add(new PackageItem { Product = s.Product, Quantity = s.Qty });
        }
        return package;
    }
}
