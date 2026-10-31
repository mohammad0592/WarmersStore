using System.Net;
using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Catalog;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class CatalogTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    [Fact]
    public async Task EssentialSeed_ProductsStartInactive_SoNothingIsPublic()
    {
        var products = await Api.GetJsonAsync<List<ProductDto>>("/api/products");

        Assert.Empty(products);
    }

    [Fact]
    public async Task Products_ListsOnlyActive_InDisplayOrder()
    {
        await Api.WithDbAsync(async db =>
        {
            var all = await db.Products.ToDictionaryAsync(p => p.Slug);
            all["toe-warmer"].IsActive = true;
            all["toe-warmer"].DisplayOrder = 1;
            all["hand-warmer"].IsActive = true;
            all["hand-warmer"].DisplayOrder = 2;
            await db.SaveChangesAsync();
        });

        var products = await Api.GetJsonAsync<List<ProductDto>>("/api/products");

        Assert.Equal(["toe-warmer", "hand-warmer"], products.Select(p => p.Slug));
        var hand = products[1];
        Assert.Equal("دفاية اليدين", hand.Name);
        Assert.Equal(5.5m, hand.WidthCm);
        Assert.Equal(2, hand.PiecesPerRetailBag);
        Assert.False(hand.IsAdhesive);
    }

    [Fact]
    public async Task Product_AdhesiveUnspecified_IsNull()
    {
        await Activate("foot-warmer");

        var foot = await Api.GetJsonAsync<ProductDto>("/api/products/foot-warmer");

        Assert.Null(foot.IsAdhesive);
    }

    [Fact]
    public async Task Product_BySlug_InactiveOrUnknown_Returns404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await Api.Client.GetAsync("/api/products/body-warmer")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Api.Client.GetAsync("/api/products/no-such")).StatusCode);
    }

    [Theory]
    [InlineData(null, true, false)]
    [InlineData(6.0, false, false)]
    [InlineData(6.0, true, true)]
    public async Task AvailableForCustom_RequiresPriceAndEligibility(double? price, bool eligible, bool expected)
    {
        await Api.WithDbAsync(async db =>
        {
            var product = await db.Products.SingleAsync(p => p.Slug == "body-warmer");
            product.IsActive = true;
            product.UnitPrice = (decimal?)price;
            product.IsCustomEligible = eligible;
            await db.SaveChangesAsync();
        });

        var product = await Api.GetJsonAsync<ProductDto>("/api/products/body-warmer");

        Assert.Equal(expected, product.AvailableForCustom);
    }

    [Fact]
    public async Task Product_Images_AreOrderedWithPublicUrls()
    {
        await Api.WithDbAsync(async db =>
        {
            var product = await db.Products.SingleAsync(p => p.Slug == "body-warmer");
            product.IsActive = true;
            product.Images.Add(new ProductImage { StorageKey = "products/b.webp", SortOrder = 2 });
            product.Images.Add(new ProductImage { StorageKey = "products/a.webp", SortOrder = 1, AltText = "صورة" });
            await db.SaveChangesAsync();
        });

        var product = await Api.GetJsonAsync<ProductDto>("/api/products/body-warmer");

        Assert.Equal(["/media/products/a.webp", "/media/products/b.webp"], product.Images.Select(i => i.Url));
    }

    private Task Activate(string slug) => Api.WithDbAsync(async db =>
    {
        (await db.Products.SingleAsync(p => p.Slug == slug)).IsActive = true;
        await db.SaveChangesAsync();
    });
}
