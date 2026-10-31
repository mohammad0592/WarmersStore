using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;
using WarmersStore.Api.Features.Distributors;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class AdminDistributorTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static async Task<T> Read<T>(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(ApiFixture.Json))!;

    private static async Task<IDictionary<string, string[]>> Errors(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors;
    }

    private static async Task<AdminCityDto> CreateCity(HttpClient admin, string slug, string name) =>
        await Read<AdminCityDto>(await admin.PostAsJsonAsync("/api/admin/cities", new CityRequest(slug, name, true), ApiFixture.Json));

    private static DistributorRequest Shop(int cityId, string name = "محل الدفا", bool active = true) => new(
        name, cityId, "شارع فيصل، بجانب البنك", "059 912 3456", "https://maps.app.goo.gl/AbC123", null, null, active, null);

    // ---- Cities ----

    [Fact]
    public async Task Cities_CreateRenameReorderAndList()
    {
        var admin = await Api.AdminClientAsync();
        var nablus = await CreateCity(admin, "nablus", "نابلس");
        var ramallah = await CreateCity(admin, "ramallah", "رام الله");

        var renamed = await Read<AdminCityDto>(await admin.PutAsJsonAsync($"/api/admin/cities/{nablus.Id}", new CityRequest("nablus", "نابلس المدينة", true), ApiFixture.Json));
        Assert.Equal("نابلس المدينة", renamed.Name);

        await admin.PutAsJsonAsync("/api/admin/cities/order", new { ids = new[] { ramallah.Id, nablus.Id } }, ApiFixture.Json);
        var list = await admin.GetFromJsonAsync<List<AdminCityDto>>("/api/admin/cities", ApiFixture.Json);
        Assert.Equal(["ramallah", "nablus"], list!.Select(c => c.Slug));
    }

    [Fact]
    public async Task Cities_ValidateNameAndUniqueSlug()
    {
        var admin = await Api.AdminClientAsync();
        await CreateCity(admin, "nablus", "نابلس");

        var errors = await Errors(await admin.PostAsJsonAsync("/api/admin/cities", new CityRequest("nablus", " ", true), ApiFixture.Json));

        Assert.Equal(["name", "slug"], errors.Keys.Order());
    }

    [Fact]
    public async Task Cities_WithDistributorsCannotBeDeleted()
    {
        var admin = await Api.AdminClientAsync();
        var used = await CreateCity(admin, "nablus", "نابلس");
        var empty = await CreateCity(admin, "jenin", "جنين");
        await admin.PostAsJsonAsync("/api/admin/distributors", Shop(used.Id), ApiFixture.Json);

        var blocked = await admin.DeleteAsync($"/api/admin/cities/{used.Id}");
        var allowed = await admin.DeleteAsync($"/api/admin/cities/{empty.Id}");

        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
        Assert.Contains("موزعين", (await blocked.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Equal(HttpStatusCode.NoContent, allowed.StatusCode);
    }

    // ---- Distributors ----

    [Fact]
    public async Task Distributors_CreateNormalizesPhone_AndAppearPublicly()
    {
        var admin = await Api.AdminClientAsync();
        var city = await CreateCity(admin, "nablus", "نابلس");

        var created = await Read<AdminDistributorDto>(await admin.PostAsJsonAsync("/api/admin/distributors", Shop(city.Id), ApiFixture.Json));

        Assert.Equal(("+970599123456", "https://maps.app.goo.gl/AbC123", "نابلس"), (created.PhoneNumber, created.MapUrl, created.CityName));
        var publicList = await Api.GetJsonAsync<List<DistributorDto>>("/api/distributors");
        Assert.Equal("محل الدفا", Assert.Single(publicList).Name);
    }

    [Fact]
    public async Task Distributors_RejectUnsafeMapLinksBadPhonesAndHalfCoordinates()
    {
        var admin = await Api.AdminClientAsync();
        var city = await CreateCity(admin, "nablus", "نابلس");
        var bad = Shop(city.Id) with
        {
            Name = "x",
            PhoneNumber = "call me",
            GoogleMapsUrl = "javascript:alert(1)",
            Latitude = 32.2215m,
            Longitude = null,
            CityId = 9999,
        };

        var errors = await Errors(await admin.PostAsJsonAsync("/api/admin/distributors", bad, ApiFixture.Json));

        Assert.Equal(["cityId", "googleMapsUrl", "longitude", "name", "phoneNumber"], errors.Keys.Order());
    }

    [Fact]
    public async Task Distributors_CannotBeActiveWithoutALocation_ButCanBeSavedInactive()
    {
        var admin = await Api.AdminClientAsync();
        var city = await CreateCity(admin, "nablus", "نابلس");
        var noLocation = Shop(city.Id) with { GoogleMapsUrl = null };

        var activeErrors = await Errors(await admin.PostAsJsonAsync("/api/admin/distributors", noLocation, ApiFixture.Json));
        var inactive = await admin.PostAsJsonAsync("/api/admin/distributors", noLocation with { IsActive = false }, ApiFixture.Json);
        var created = await Read<AdminDistributorDto>(inactive);
        var activate = await admin.PatchAsJsonAsync($"/api/admin/distributors/{created.Id}/status", new { isActive = true }, ApiFixture.Json);

        Assert.Contains("isActive", activeErrors.Keys);
        Assert.Equal(HttpStatusCode.Created, inactive.StatusCode);
        Assert.Contains("isActive", (await Errors(activate)).Keys);
    }

    [Fact]
    public async Task Distributors_CoordinatesBuildTheMapLink_AndStatusToggleHidesPublicly()
    {
        var admin = await Api.AdminClientAsync();
        var city = await CreateCity(admin, "nablus", "نابلس");
        var withCoords = Shop(city.Id) with { GoogleMapsUrl = null, Latitude = 32.2215m, Longitude = 35.2544m };

        var created = await Read<AdminDistributorDto>(await admin.PostAsJsonAsync("/api/admin/distributors", withCoords, ApiFixture.Json));
        Assert.Equal("https://www.google.com/maps/search/?api=1&query=32.2215,35.2544", created.MapUrl);

        await admin.PatchAsJsonAsync($"/api/admin/distributors/{created.Id}/status", new { isActive = false }, ApiFixture.Json);
        Assert.Empty(await Api.GetJsonAsync<List<DistributorDto>>("/api/distributors"));
    }

    [Fact]
    public async Task Distributors_UpdateUsesVersion_AndMovingCityAppendsToItsList()
    {
        var admin = await Api.AdminClientAsync();
        var nablus = await CreateCity(admin, "nablus", "نابلس");
        var hebron = await CreateCity(admin, "hebron", "الخليل");
        await admin.PostAsJsonAsync("/api/admin/distributors", Shop(hebron.Id, "محل الخليل"), ApiFixture.Json);
        var shop = await Read<AdminDistributorDto>(await admin.PostAsJsonAsync("/api/admin/distributors", Shop(nablus.Id), ApiFixture.Json));

        var moved = await Read<AdminDistributorDto>(await admin.PutAsJsonAsync($"/api/admin/distributors/{shop.Id}",
            Shop(hebron.Id) with { Version = shop.Version }, ApiFixture.Json));
        var stale = await admin.PutAsJsonAsync($"/api/admin/distributors/{shop.Id}", Shop(nablus.Id) with { Version = shop.Version }, ApiFixture.Json);

        Assert.Equal((hebron.Id, 2), (moved.CityId, moved.DisplayOrder));
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
    }

    [Fact]
    public async Task Distributors_ReorderWithinACity()
    {
        var admin = await Api.AdminClientAsync();
        var city = await CreateCity(admin, "nablus", "نابلس");
        var first = await Read<AdminDistributorDto>(await admin.PostAsJsonAsync("/api/admin/distributors", Shop(city.Id, "الأول"), ApiFixture.Json));
        var second = await Read<AdminDistributorDto>(await admin.PostAsJsonAsync("/api/admin/distributors", Shop(city.Id, "الثاني"), ApiFixture.Json));

        var ok = await admin.PutAsJsonAsync("/api/admin/distributors/order", new { cityId = city.Id, ids = new[] { second.Id, first.Id } }, ApiFixture.Json);
        var bad = await admin.PutAsJsonAsync("/api/admin/distributors/order", new { cityId = city.Id, ids = new[] { second.Id } }, ApiFixture.Json);

        Assert.Equal(HttpStatusCode.NoContent, ok.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Equal(["الثاني", "الأول"], (await Api.GetJsonAsync<List<DistributorDto>>("/api/distributors")).Select(d => d.Name));
    }

    [Fact]
    public async Task Distributors_ImageUpload_AndDeleteRemovesTheFile()
    {
        var admin = await Api.AdminClientAsync();
        var city = await CreateCity(admin, "nablus", "نابلس");
        var shop = await Read<AdminDistributorDto>(await admin.PostAsJsonAsync("/api/admin/distributors", Shop(city.Id), ApiFixture.Json));
        var png = TestImages.Encode(60, 40, SKEncodedImageFormat.Png);

        var upload = await admin.PutAsync($"/api/admin/distributors/{shop.Id}/image", TestImages.Form(png, "shop.png", "image/png"));
        var imageUrl = (await upload.Content.ReadFromJsonAsync<Dictionary<string, string>>())!["imageUrl"];
        Assert.StartsWith("/media/distributors/", imageUrl);
        Assert.Equal(imageUrl, (await Api.GetJsonAsync<List<DistributorDto>>("/api/distributors")).Single().ImageUrl);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/distributors/{shop.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Api.NewClient().GetAsync(imageUrl)).StatusCode);
        await Api.WithDbAsync(async db => Assert.Equal(0, await db.Distributors.CountAsync()));
    }
}
