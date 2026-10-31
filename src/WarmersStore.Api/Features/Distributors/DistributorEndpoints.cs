using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Media;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Distributors;

public sealed record CityDto(int Id, string Slug, string Name, int DistributorCount);

public sealed record DistributorCityDto(int Id, string Slug, string Name);

public sealed record DistributorDto(
    int Id,
    string Name,
    DistributorCityDto City,
    string Address,
    string? Phone,
    string? MapUrl,
    string? ImageUrl)
{
    public static DistributorDto From(Distributor d) => new(
        d.Id,
        d.Name,
        new DistributorCityDto(d.City.Id, d.City.Slug, d.City.Name.Resolve(PublicApi.Language)),
        d.Address,
        d.PhoneNumber,
        MapLinks.Build(d.Latitude, d.Longitude, d.GoogleMapsUrl),
        MediaUrls.For(d.ImageKey));
}

/// <summary>
/// Public directory of authorized physical shops. Deliberately has no dependency on
/// packages, cart, checkout, delivery or orders.
/// </summary>
public static class DistributorEndpoints
{
    public static RouteGroupBuilder MapDistributorEndpoints(this RouteGroupBuilder api)
    {
        // Only cities a customer can actually pick: active, with at least one visible distributor.
        api.MapGet("/cities", async (AppDbContext db, CancellationToken ct) =>
        {
            var cities = await db.Cities.AsNoTracking()
                .Where(c => c.IsActive)
                .Select(c => new { City = c, Count = c.Distributors.Count(d => d.IsActive) })
                .Where(x => x.Count > 0)
                .OrderBy(x => x.City.DisplayOrder).ThenBy(x => x.City.Id)
                .ToListAsync(ct);

            return TypedResults.Ok(cities
                .Select(x => new CityDto(x.City.Id, x.City.Slug, x.City.Name.Resolve(PublicApi.Language), x.Count))
                .ToList());
        })
        .WithTags("Distributors");

        var distributors = api.MapGroup("/distributors").WithTags("Distributors");

        distributors.MapGet("/", async (int? cityId, AppDbContext db, CancellationToken ct) =>
        {
            var query = Visible(db);
            if (cityId is { } id)
            {
                query = query.Where(d => d.CityId == id);
            }

            var items = await query
                .OrderBy(d => d.City.DisplayOrder).ThenBy(d => d.CityId)
                .ThenBy(d => d.DisplayOrder).ThenBy(d => d.Id)
                .ToListAsync(ct);

            return TypedResults.Ok(items.Select(DistributorDto.From).ToList());
        });

        distributors.MapGet("/{id:int}", async Task<IResult> (int id, AppDbContext db, CancellationToken ct) =>
        {
            var distributor = await Visible(db).SingleOrDefaultAsync(d => d.Id == id, ct);

            return distributor is null ? TypedResults.NotFound() : TypedResults.Ok(DistributorDto.From(distributor));
        });

        return api;
    }

    private static IQueryable<Distributor> Visible(AppDbContext db) =>
        db.Distributors.AsNoTracking()
            .Include(d => d.City)
            .Where(d => d.IsActive && d.City.IsActive);
}
