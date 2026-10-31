using System.Net;
using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Distributors;
using WarmersStore.Api.Infrastructure.Persistence;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class DistributorTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    [Fact]
    public async Task Cities_ListOnlyActiveCitiesWithActiveDistributors_WithCounts()
    {
        await SeedDirectoryAsync();

        var cities = await Api.GetJsonAsync<List<CityDto>>("/api/cities");

        // "b" has only an inactive distributor, "empty" has none, "hidden" is inactive.
        Assert.Equal([("a", 2), ("c", 1)], cities.Select(c => (c.Slug, c.DistributorCount)));
    }

    [Fact]
    public async Task Distributors_ListVisibleOnes_OrderedByCityThenDisplayOrder()
    {
        await SeedDirectoryAsync();

        var all = await Api.GetJsonAsync<List<DistributorDto>>("/api/distributors");

        Assert.Equal(["A1", "A2", "C1"], all.Select(d => d.Name));
    }

    [Fact]
    public async Task Distributors_FilterByCity()
    {
        var ids = await SeedDirectoryAsync();

        var inA = await Api.GetJsonAsync<List<DistributorDto>>($"/api/distributors?cityId={ids["a"]}");
        var inEmpty = await Api.GetJsonAsync<List<DistributorDto>>($"/api/distributors?cityId={ids["empty"]}");

        Assert.Equal(["A1", "A2"], inA.Select(d => d.Name));
        Assert.All(inA, d => Assert.Equal("a", d.City.Slug));
        Assert.Empty(inEmpty);
    }

    [Fact]
    public async Task Distributor_ById_HiddenWhenInactiveOrCityInactive()
    {
        await SeedDirectoryAsync();

        int inactiveId = 0, hiddenCityId = 0, visibleId = 0;
        await Api.WithDbAsync(async db =>
        {
            inactiveId = (await db.Distributors.SingleAsync(d => d.Name == "B-inactive")).Id;
            hiddenCityId = (await db.Distributors.SingleAsync(d => d.Name == "Hidden-city")).Id;
            visibleId = (await db.Distributors.SingleAsync(d => d.Name == "C1")).Id;
        });

        Assert.Equal(HttpStatusCode.NotFound, (await Api.Client.GetAsync($"/api/distributors/{inactiveId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Api.Client.GetAsync($"/api/distributors/{hiddenCityId}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Api.Client.GetAsync($"/api/distributors/{visibleId}")).StatusCode);
    }

    [Fact]
    public async Task Distributor_MapUrl_PrefersCoordinatesOverStoredLink()
    {
        await SeedDirectoryAsync();

        var all = await Api.GetJsonAsync<List<DistributorDto>>("/api/distributors");

        Assert.Equal("https://www.google.com/maps/search/?api=1&query=32.2215,35.2544",
            all.Single(d => d.Name == "A1").MapUrl);
        Assert.Equal("https://maps.app.goo.gl/example", all.Single(d => d.Name == "A2").MapUrl);
        Assert.Null(all.Single(d => d.Name == "C1").MapUrl);
    }

    [Fact]
    public async Task Distributor_HalfFilledCoordinates_AreRejectedByDatabase()
    {
        await Api.WithDbAsync(async db =>
        {
            var city = new City { Slug = "x", Name = LocalizedText.Arabic("x") };
            db.Distributors.Add(new Distributor { City = city, Name = "n", Address = "a", Latitude = 32m });

            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        });
    }

    [Fact]
    public async Task DeletingCityWithDistributors_IsRejectedByDatabase()
    {
        await SeedDirectoryAsync();

        await Api.WithDbAsync(async db =>
        {
            db.Cities.Remove(await db.Cities.SingleAsync(c => c.Slug == "a"));
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        });
    }

    /// <summary>Seeds a small directory covering every visibility case; returns city ids by slug.</summary>
    private async Task<Dictionary<string, int>> SeedDirectoryAsync()
    {
        Dictionary<string, int> ids = [];
        await Api.WithDbAsync(async db =>
        {
            var a = City(db, "a", 1);
            var b = City(db, "b", 2);
            var c = City(db, "c", 3);
            var empty = City(db, "empty", 4);
            var hidden = City(db, "hidden", 5, isActive: false);

            db.Distributors.AddRange(
                new Distributor { City = a, Name = "A2", Address = "addr", DisplayOrder = 2, IsActive = true,
                    GoogleMapsUrl = "https://maps.app.goo.gl/example" },
                new Distributor { City = a, Name = "A1", Address = "addr", DisplayOrder = 1, IsActive = true,
                    Latitude = 32.2215m, Longitude = 35.2544m, GoogleMapsUrl = "https://maps.app.goo.gl/ignored" },
                new Distributor { City = b, Name = "B-inactive", Address = "addr", IsActive = false },
                new Distributor { City = c, Name = "C1", Address = "addr", IsActive = true },
                new Distributor { City = hidden, Name = "Hidden-city", Address = "addr", IsActive = true });

            await db.SaveChangesAsync();
            ids = new[] { a, b, c, empty, hidden }.ToDictionary(x => x.Slug, x => x.Id);
        });
        return ids;
    }

    private static City City(AppDbContext db, string slug, int order, bool isActive = true)
    {
        var city = new City { Slug = slug, Name = LocalizedText.Arabic(slug), DisplayOrder = order, IsActive = isActive };
        db.Cities.Add(city);
        return city;
    }
}
