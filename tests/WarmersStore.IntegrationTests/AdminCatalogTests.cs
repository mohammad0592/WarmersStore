using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Catalog;
using WarmersStore.Api.Features.Packages;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class AdminCatalogTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static ProductRequest NewProduct(string slug = "neck-warmer", bool active = false, decimal? price = null) => new(
        slug, "دفاية الرقبة", "وصف قصير", null, null, null,
        WidthCm: 9.5m, HeightCm: 12m, HeatMinHours: 6m, HeatMaxHours: 8m, IsAdhesive: true,
        PiecesPerRetailBag: 2, SellingUnit: SellingUnit.RetailBag, UnitPrice: price,
        IsActive: active, IsCustomEligible: true, Version: null);

    private static async Task<T> Read<T>(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(ApiFixture.Json))!;

    private static async Task<IDictionary<string, string[]>> Errors(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors;
    }

    // ---- Products ----

    [Fact]
    public async Task Products_CreateUpdateAndPublish()
    {
        var admin = await Api.AdminClientAsync();

        var created = await Read<AdminProductDto>(await admin.PostAsJsonAsync("/api/admin/products", NewProduct(), ApiFixture.Json));
        Assert.Equal((2, false), (created.PiecesPerSellingUnit, created.IsActive));
        Assert.Equal(5, created.DisplayOrder); // after the 4 seeded products

        var update = NewProduct(active: true, price: 7.5m) with { Name = "دفاية الرقبة الجديدة", SellingUnit = SellingUnit.Piece, Version = created.Version };
        var updated = await Read<AdminProductDto>(await admin.PutAsJsonAsync($"/api/admin/products/{created.Id}", update, ApiFixture.Json));

        Assert.Equal(("دفاية الرقبة الجديدة", 1, 7.5m, true), (updated.Name, updated.PiecesPerSellingUnit, updated.UnitPrice!.Value, updated.IsActive));
        var publicProduct = await Api.GetJsonAsync<ProductDto>("/api/products/neck-warmer");
        Assert.Equal("دفاية الرقبة الجديدة", publicProduct.Name);
        Assert.True(publicProduct.AvailableForCustom);
    }

    [Fact]
    public async Task Products_ValidationReportsEachField()
    {
        var admin = await Api.AdminClientAsync();
        var bad = NewProduct("Bad Slug!", active: true) with { Name = " ", WidthCm = 0, HeatMinHours = 9, HeatMaxHours = 8, SellingUnit = null, UnitPrice = null };

        var errors = await Errors(await admin.PostAsJsonAsync("/api/admin/products", bad, ApiFixture.Json));

        Assert.Equal(["heatMaxHours", "name", "sellingUnit", "slug", "unitPrice", "widthCm"], errors.Keys.Order());
        Assert.Contains("لا يمكن تفعيل منتج بدون سعر.", errors["unitPrice"]);
    }

    [Fact]
    public async Task Products_SlugsAreUnique()
    {
        var admin = await Api.AdminClientAsync();

        var errors = await Errors(await admin.PostAsJsonAsync("/api/admin/products", NewProduct("hand-warmer"), ApiFixture.Json));

        Assert.Equal("هذا المعرّف مستخدم لمنتج آخر.", Assert.Single(errors["slug"]));
    }

    [Fact]
    public async Task Products_StaleVersionIsRejected()
    {
        var admin = await Api.AdminClientAsync();
        var created = await Read<AdminProductDto>(await admin.PostAsJsonAsync("/api/admin/products", NewProduct(), ApiFixture.Json));
        var first = NewProduct() with { Name = "تعديل أول", Version = created.Version };
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/products/{created.Id}", first, ApiFixture.Json)).StatusCode);

        // A second editor still holding the original version.
        var second = await admin.PutAsJsonAsync($"/api/admin/products/{created.Id}", first with { Name = "تعديل ثانٍ" }, ApiFixture.Json);

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        await Api.WithDbAsync(async db => Assert.Equal("تعديل أول", (await db.Products.SingleAsync(p => p.Id == created.Id)).Name.Ar));
    }

    [Fact]
    public async Task Products_InAPackageCannotBeDeleted_OthersCan()
    {
        var admin = await Api.AdminClientAsync();
        var products = await admin.GetFromJsonAsync<List<AdminProductDto>>("/api/admin/products", ApiFixture.Json);
        var body = products!.Single(p => p.Slug == "body-warmer");
        var foot = products!.Single(p => p.Slug == "foot-warmer");
        await admin.PostAsJsonAsync("/api/admin/packages", new PackageRequest("p", "باقة", null, 10m, false, false, [new(body.Id, 1)], null), ApiFixture.Json);

        var blocked = await admin.DeleteAsync($"/api/admin/products/{body.Id}");
        var allowed = await admin.DeleteAsync($"/api/admin/products/{foot.Id}");

        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
        Assert.Contains("باقة", (await blocked.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Equal(HttpStatusCode.NoContent, allowed.StatusCode);
    }

    [Fact]
    public async Task Products_Reorder()
    {
        var admin = await Api.AdminClientAsync();
        var ids = (await admin.GetFromJsonAsync<List<AdminProductDto>>("/api/admin/products", ApiFixture.Json))!.Select(p => p.Id).ToList();
        ids.Reverse();

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync("/api/admin/products/order", new { ids }, ApiFixture.Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync("/api/admin/products/order", new { ids = ids.Take(2) }, ApiFixture.Json)).StatusCode);

        var reordered = await admin.GetFromJsonAsync<List<AdminProductDto>>("/api/admin/products", ApiFixture.Json);
        Assert.Equal(ids, reordered!.Select(p => p.Id));
    }

    // ---- Images ----

    [Fact]
    public async Task ProductImages_AreReencodedToWebp_Resized_AndServed()
    {
        var admin = await Api.AdminClientAsync();
        var productId = (await admin.GetFromJsonAsync<List<AdminProductDto>>("/api/admin/products", ApiFixture.Json))!.First().Id;
        var jpeg = TestImages.Encode(3000, 2000, SKEncodedImageFormat.Jpeg);

        var response = await admin.PostAsync($"/api/admin/products/{productId}/images",
            TestImages.Form(jpeg, "../../evil name.php", "image/jpeg", "صورة المنتج"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var image = await Read<AdminProductImageDto>(response);
        Assert.Matches(@"^/media/products/[0-9a-f]{32}\.webp$", image.Url); // nothing from the uploaded name

        var served = await Api.NewClient().GetAsync(image.Url);
        Assert.Equal(HttpStatusCode.OK, served.StatusCode);
        Assert.Equal("image/webp", served.Content.Headers.ContentType?.MediaType);
        Assert.Contains("immutable", served.Headers.CacheControl!.ToString());
        Assert.Equal((1600, 1067, SKEncodedImageFormat.Webp), TestImages.Inspect(await served.Content.ReadAsByteArrayAsync()));

        var product = await admin.GetFromJsonAsync<AdminProductDto>($"/api/admin/products/{productId}", ApiFixture.Json);
        Assert.Equal(("صورة المنتج", image.Url), (product!.Images.Single().AltText, product.Images.Single().Url));
    }

    [Theory]
    [InlineData("not an image at all", "photo.png", "image/png")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>", "photo.svg", "image/svg+xml")]
    [InlineData("GIF89a....", "photo.gif", "image/gif")]
    public async Task ProductImages_RejectFilesThatAreNotJpegPngOrWebp(string content, string name, string type)
    {
        var admin = await Api.AdminClientAsync();
        var productId = (await admin.GetFromJsonAsync<List<AdminProductDto>>("/api/admin/products", ApiFixture.Json))!.First().Id;

        var response = await admin.PostAsync($"/api/admin/products/{productId}/images", TestImages.Form(Encoding.UTF8.GetBytes(content), name, type));

        var errors = await Errors(response);
        Assert.Contains("file", errors.Keys);
        await Api.WithDbAsync(async db => Assert.Equal(0, await db.ProductImages.CountAsync()));
    }

    [Fact]
    public async Task ProductImages_RejectOversizedFiles()
    {
        var admin = await Api.AdminClientAsync();
        var productId = (await admin.GetFromJsonAsync<List<AdminProductDto>>("/api/admin/products", ApiFixture.Json))!.First().Id;
        var huge = new byte[5 * 1024 * 1024 + 1];

        var response = await admin.PostAsync($"/api/admin/products/{productId}/images", TestImages.Form(huge, "big.jpg", "image/jpeg"));

        Assert.Contains("file", (await Errors(response)).Keys);
    }

    [Fact]
    public async Task ProductImages_DeleteRemovesTheFile_AndOrderIsFirstIsPrimary()
    {
        var admin = await Api.AdminClientAsync();
        var productId = (await admin.GetFromJsonAsync<List<AdminProductDto>>("/api/admin/products", ApiFixture.Json))!.First().Id;
        var png = TestImages.Encode(40, 40, SKEncodedImageFormat.Png);
        var first = await Read<AdminProductImageDto>(await admin.PostAsync($"/api/admin/products/{productId}/images", TestImages.Form(png, "a.png", "image/png")));
        var second = await Read<AdminProductImageDto>(await admin.PostAsync($"/api/admin/products/{productId}/images", TestImages.Form(png, "b.png", "image/png")));

        await admin.PutAsJsonAsync($"/api/admin/products/{productId}/images/order", new { ids = new[] { second.Id, first.Id } }, ApiFixture.Json);
        var product = await admin.GetFromJsonAsync<AdminProductDto>($"/api/admin/products/{productId}", ApiFixture.Json);
        Assert.Equal([second.Id, first.Id], product!.Images.Select(i => i.Id));

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/products/{productId}/images/{second.Id}")).StatusCode);
        Assert.False(File.Exists(Path.Combine(Api.MediaRoot, second.Url["/media/".Length..])));
        Assert.Equal(HttpStatusCode.NotFound, (await Api.NewClient().GetAsync(second.Url)).StatusCode);
    }

    [Fact]
    public async Task Media_NeverFallsBackToTheSpa()
    {
        var response = await Api.NewClient().GetAsync("/media/products/missing.webp");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- Packages ----

    [Fact]
    public async Task Packages_CreateWithContents_UpdateAndSoftDelete()
    {
        var admin = await Api.AdminClientAsync();
        var products = (await admin.GetFromJsonAsync<List<AdminProductDto>>("/api/admin/products", ApiFixture.Json))!;
        var (body, hand) = (products.Single(p => p.Slug == "body-warmer"), products.Single(p => p.Slug == "hand-warmer"));

        var created = await Read<AdminPackageDto>(await admin.PostAsJsonAsync("/api/admin/packages",
            new PackageRequest("weekly", "باقة الأسبوع", "وصف", 49m, true, true, [new(body.Id, 5), new(hand.Id, 2)], null), ApiFixture.Json));
        Assert.Equal([(body.Id, 5), (hand.Id, 2)], created.Items.Select(i => (i.ProductId, i.Quantity)));

        var update = new PackageRequest("weekly", "باقة الأسبوع", null, 45m, true, false, [new(hand.Id, 3)], created.Version);
        var updated = await Read<AdminPackageDto>(await admin.PutAsJsonAsync($"/api/admin/packages/{created.Id}", update, ApiFixture.Json));
        Assert.Equal((45m, false), (updated.Price, updated.IsFeatured));
        Assert.Equal([(hand.Id, 3)], updated.Items.Select(i => (i.ProductId, i.Quantity)));

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/packages/{created.Id}")).StatusCode);
        Assert.Empty((await admin.GetFromJsonAsync<List<AdminPackageDto>>("/api/admin/packages", ApiFixture.Json))!);
        await Api.WithDbAsync(async db => Assert.NotNull((await db.Packages.IgnoreQueryFilters().SingleAsync()).DeletedAt));

        // The slug is free again for a new package.
        var reuse = await admin.PostAsJsonAsync("/api/admin/packages",
            new PackageRequest("weekly", "باقة جديدة", null, 40m, false, false, [new(body.Id, 1)], null), ApiFixture.Json);
        Assert.Equal(HttpStatusCode.Created, reuse.StatusCode);
    }

    [Fact]
    public async Task Packages_ValidateContents()
    {
        var admin = await Api.AdminClientAsync();
        var bodyId = (await admin.GetFromJsonAsync<List<AdminProductDto>>("/api/admin/products", ApiFixture.Json))!.First().Id;

        var empty = await Errors(await admin.PostAsJsonAsync("/api/admin/packages",
            new PackageRequest("x", "باقة", null, 10m, false, false, [], null), ApiFixture.Json));
        var bad = await Errors(await admin.PostAsJsonAsync("/api/admin/packages",
            new PackageRequest("x", "باقة", null, -1m, false, false, [new(bodyId, 1), new(bodyId, 2), new(9999, 0)], null), ApiFixture.Json));

        Assert.Contains("items", empty.Keys);
        Assert.Equal(["items[1].productId", "items[2].productId", "items[2].quantity", "price"], bad.Keys.Order());
    }

    [Fact]
    public async Task PackageImage_ReplacingDeletesTheOldFile()
    {
        var admin = await Api.AdminClientAsync();
        var bodyId = (await admin.GetFromJsonAsync<List<AdminProductDto>>("/api/admin/products", ApiFixture.Json))!.First().Id;
        var package = await Read<AdminPackageDto>(await admin.PostAsJsonAsync("/api/admin/packages",
            new PackageRequest("img", "باقة", null, 10m, false, false, [new(bodyId, 1)], null), ApiFixture.Json));
        var png = TestImages.Encode(50, 50, SKEncodedImageFormat.Png);

        var first = (await (await admin.PutAsync($"/api/admin/packages/{package.Id}/image", TestImages.Form(png, "a.png", "image/png")))
            .Content.ReadFromJsonAsync<Dictionary<string, string>>())!["imageUrl"];
        var second = (await (await admin.PutAsync($"/api/admin/packages/{package.Id}/image", TestImages.Form(png, "b.png", "image/png")))
            .Content.ReadFromJsonAsync<Dictionary<string, string>>())!["imageUrl"];

        Assert.NotEqual(first, second);
        Assert.Equal(HttpStatusCode.NotFound, (await Api.NewClient().GetAsync(first)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Api.NewClient().GetAsync(second)).StatusCode);
    }
}
