using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Admin;
using WarmersStore.Api.Features.Catalog;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Distributors;

public sealed record AdminCityDto(int Id, string Slug, string Name, bool IsActive, int DisplayOrder, int DistributorCount, int ActiveDistributorCount);

public sealed record CityRequest(string? Slug, string? Name, bool IsActive);

/// <summary>Cities group distributors on /distributors. They are unrelated to delivery areas.</summary>
public static class AdminCityEndpoints
{
    public static RouteGroupBuilder MapAdminCityEndpoints(this RouteGroupBuilder admin)
    {
        var cities = admin.MapGroup("/cities");

        cities.MapGet("/", async (AppDbContext db, CancellationToken ct) =>
            TypedResults.Ok(await ListAsync(db, ct)));

        cities.MapPost("/", async Task<IResult> (CityRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var city = new City { Slug = "", Name = LocalizedText.Arabic("") };
            var errors = await ApplyAsync(request, city, db, ct);
            if (errors.Any)
            {
                return errors.ToResult();
            }

            city.DisplayOrder = (await db.Cities.MaxAsync(c => (int?)c.DisplayOrder, ct) ?? 0) + 1;
            db.Cities.Add(city);
            await db.SaveChangesAsync(ct);
            return TypedResults.Created($"/api/admin/cities/{city.Id}", (await ListAsync(db, ct)).Single(c => c.Id == city.Id));
        });

        cities.MapPut("/{id:int}", async Task<IResult> (int id, CityRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var city = await db.Cities.SingleOrDefaultAsync(c => c.Id == id, ct);
            if (city is null)
            {
                return TypedResults.NotFound();
            }

            var errors = await ApplyAsync(request, city, db, ct);
            if (errors.Any)
            {
                return errors.ToResult();
            }

            await db.SaveChangesAsync(ct);
            return TypedResults.Ok((await ListAsync(db, ct)).Single(c => c.Id == id));
        });

        // A city that still has distributors can't be deleted (the database refuses too).
        cities.MapDelete("/{id:int}", async Task<IResult> (int id, AppDbContext db, CancellationToken ct) =>
        {
            var city = await db.Cities.SingleOrDefaultAsync(c => c.Id == id, ct);
            if (city is null)
            {
                return TypedResults.NotFound();
            }

            var count = await db.Distributors.CountAsync(d => d.CityId == id, ct);
            if (count > 0)
            {
                return AdminResults.Conflict($"في هذه المدينة {count} موزعين. انقلهم لمدينة أخرى أو احذفهم أولاً، أو أوقف المدينة بدلاً من حذفها.");
            }

            db.Cities.Remove(city);
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        });

        cities.MapPut("/order", async Task<IResult> (ReorderRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var all = await db.Cities.ToListAsync(ct);
            if (request.Ids is null || request.Ids.Count != all.Count || !request.Ids.Order().SequenceEqual(all.Select(c => c.Id).Order()))
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["ids"] = ["Send every city id exactly once."] });
            }

            var byId = all.ToDictionary(c => c.Id);
            for (var i = 0; i < request.Ids.Count; i++)
            {
                byId[request.Ids[i]].DisplayOrder = i + 1;
            }
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        });

        return admin;
    }

    private static async Task<List<AdminCityDto>> ListAsync(AppDbContext db, CancellationToken ct)
    {
        var rows = await db.Cities.AsNoTracking()
            .OrderBy(c => c.DisplayOrder).ThenBy(c => c.Id)
            .Select(c => new { City = c, Total = c.Distributors.Count, Active = c.Distributors.Count(d => d.IsActive) })
            .ToListAsync(ct);

        return rows.Select(r => new AdminCityDto(r.City.Id, r.City.Slug, r.City.Name.Ar, r.City.IsActive, r.City.DisplayOrder, r.Total, r.Active)).ToList();
    }

    private static async Task<ValidationErrors> ApplyAsync(CityRequest r, City city, AppDbContext db, CancellationToken ct)
    {
        var errors = new ValidationErrors();
        var slug = errors.Slug("slug", r.Slug);
        if (slug is not null && await db.Cities.AnyAsync(c => c.Slug == slug && c.Id != city.Id, ct))
        {
            errors.Add("slug", "هذا المعرّف مستخدم لمدينة أخرى.");
        }

        city.Slug = slug ?? city.Slug;
        city.Name = AdminResults.Localized(errors.Required("name", r.Name, 60), city.Name) ?? city.Name;
        city.IsActive = r.IsActive;
        return errors;
    }
}
