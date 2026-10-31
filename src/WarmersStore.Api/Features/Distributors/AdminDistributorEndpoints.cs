using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WarmersStore.Api.Common;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Admin;
using WarmersStore.Api.Features.Media;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Distributors;

public sealed record AdminDistributorDto(
    int Id,
    string Name,
    int CityId,
    string CityName,
    string Address,
    string? PhoneNumber,
    string? GoogleMapsUrl,
    decimal? Latitude,
    decimal? Longitude,
    string? MapUrl,
    string? ImageUrl,
    bool IsActive,
    int DisplayOrder,
    uint Version);

public sealed record DistributorRequest(
    string? Name,
    int? CityId,
    string? Address,
    string? PhoneNumber,
    string? GoogleMapsUrl,
    decimal? Latitude,
    decimal? Longitude,
    bool IsActive,
    uint? Version);

public sealed record DistributorStatusRequest(bool IsActive);

public sealed record DistributorOrderRequest(int? CityId, IReadOnlyList<int>? Ids);

/// <summary>
/// Manage authorized shops. Like the public directory, this has no link to the cart, checkout,
/// delivery or orders: distributors are physical shops where customers buy in person.
/// </summary>
public static class AdminDistributorEndpoints
{
    private const long MaxRequestBytes = 6 * 1024 * 1024;

    public static RouteGroupBuilder MapAdminDistributorEndpoints(this RouteGroupBuilder admin)
    {
        var distributors = admin.MapGroup("/distributors");

        distributors.MapGet("/", async (int? cityId, bool? active, AppDbContext db, CancellationToken ct) =>
        {
            var query = Query(db);
            if (cityId is { } city)
            {
                query = query.Where(d => d.CityId == city);
            }
            if (active is { } isActive)
            {
                query = query.Where(d => d.IsActive == isActive);
            }

            var items = await query
                .OrderBy(d => d.City.DisplayOrder).ThenBy(d => d.CityId).ThenBy(d => d.DisplayOrder).ThenBy(d => d.Id)
                .ToListAsync(ct);
            return TypedResults.Ok(items.Select(ToDto).ToList());
        });

        distributors.MapGet("/{id:int}", async Task<IResult> (int id, AppDbContext db, CancellationToken ct) =>
            await Query(db).SingleOrDefaultAsync(d => d.Id == id, ct) is { } distributor
                ? TypedResults.Ok(ToDto(distributor))
                : TypedResults.NotFound());

        distributors.MapPost("/", async Task<IResult> (DistributorRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var distributor = new Distributor { Name = "", Address = "" };
            var errors = await ApplyAsync(request, distributor, db, ct);
            if (errors.Any)
            {
                return errors.ToResult();
            }

            distributor.DisplayOrder = (await db.Distributors.Where(d => d.CityId == distributor.CityId)
                .MaxAsync(d => (int?)d.DisplayOrder, ct) ?? 0) + 1;
            db.Distributors.Add(distributor);
            await db.SaveChangesAsync(ct);
            return TypedResults.Created($"/api/admin/distributors/{distributor.Id}", ToDto(await Query(db).SingleAsync(d => d.Id == distributor.Id, ct)));
        });

        distributors.MapPut("/{id:int}", async Task<IResult> (int id, DistributorRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var distributor = await db.Distributors.SingleOrDefaultAsync(d => d.Id == id, ct);
            if (distributor is null)
            {
                return TypedResults.NotFound();
            }

            var previousCity = distributor.CityId;
            var errors = await ApplyAsync(request, distributor, db, ct);
            if (request.Version is null)
            {
                errors.Add("version", "Version is required.");
            }
            if (errors.Any)
            {
                return errors.ToResult();
            }

            if (distributor.CityId != previousCity)
            {
                // Moving to another city puts the shop at the end of that city's list.
                distributor.DisplayOrder = (await db.Distributors.Where(d => d.CityId == distributor.CityId && d.Id != id)
                    .MaxAsync(d => (int?)d.DisplayOrder, ct) ?? 0) + 1;
            }

            db.Entry(distributor).Property(d => d.Version).OriginalValue = request.Version!.Value;
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return AdminResults.StaleVersion();
            }
            return TypedResults.Ok(ToDto(await Query(db).SingleAsync(d => d.Id == id, ct)));
        });

        distributors.MapPatch("/{id:int}/status", async Task<IResult> (int id, DistributorStatusRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var distributor = await db.Distributors.SingleOrDefaultAsync(d => d.Id == id, ct);
            if (distributor is null)
            {
                return TypedResults.NotFound();
            }
            if (request.IsActive && !HasLocation(distributor))
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["isActive"] = [NeedsLocation] });
            }

            distributor.IsActive = request.IsActive;
            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(ToDto(await Query(db).SingleAsync(d => d.Id == id, ct)));
        });

        // Hard delete: nothing references a distributor (orders never do), so it can go entirely.
        distributors.MapDelete("/{id:int}", async Task<IResult> (int id, AppDbContext db, IImageStorage storage, CancellationToken ct) =>
        {
            var distributor = await db.Distributors.SingleOrDefaultAsync(d => d.Id == id, ct);
            if (distributor is null)
            {
                return TypedResults.NotFound();
            }

            var image = distributor.ImageKey;
            db.Distributors.Remove(distributor);
            await db.SaveChangesAsync(ct);
            await storage.DeleteAsync(image, ct);
            return TypedResults.NoContent();
        });

        distributors.MapPut("/order", async Task<IResult> (DistributorOrderRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var inCity = await db.Distributors.Where(d => d.CityId == request.CityId).ToListAsync(ct);
            if (request.Ids is null || inCity.Count == 0 || request.Ids.Count != inCity.Count
                || !request.Ids.Order().SequenceEqual(inCity.Select(d => d.Id).Order()))
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["ids"] = ["Send every distributor id of the city exactly once."] });
            }

            var byId = inCity.ToDictionary(d => d.Id);
            for (var i = 0; i < request.Ids.Count; i++)
            {
                byId[request.Ids[i]].DisplayOrder = i + 1;
            }
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        });

        distributors.MapPut("/{id:int}/image", async Task<IResult> (
                int id, IFormFile? file, AppDbContext db, IImageStorage storage, IOptions<MediaOptions> media, CancellationToken ct) =>
            {
                var distributor = await db.Distributors.SingleOrDefaultAsync(d => d.Id == id, ct);
                if (distributor is null)
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
                    key = await storage.SaveAsync("distributors", processed.Webp!, ct);
                }

                var previous = distributor.ImageKey;
                distributor.ImageKey = key;
                await db.SaveChangesAsync(ct);
                await storage.DeleteAsync(previous, ct);
                return TypedResults.Ok(new { imageUrl = MediaUrls.For(key) });
            })
            .DisableAntiforgery() // protected by the X-Dafa-Admin header + SameSite cookie instead
            .WithMetadata(new RequestSizeLimitAttribute(MaxRequestBytes));

        distributors.MapDelete("/{id:int}/image", async Task<IResult> (int id, AppDbContext db, IImageStorage storage, CancellationToken ct) =>
        {
            var distributor = await db.Distributors.SingleOrDefaultAsync(d => d.Id == id, ct);
            if (distributor is null)
            {
                return TypedResults.NotFound();
            }

            var previous = distributor.ImageKey;
            distributor.ImageKey = null;
            await db.SaveChangesAsync(ct);
            await storage.DeleteAsync(previous, ct);
            return TypedResults.NoContent();
        });

        return admin;
    }

    private const string NeedsLocation = "أضف رابط خرائط Google أو الإحداثيات قبل تفعيل الموزع، لأن زر الموقع هو الإجراء الرئيسي في صفحته.";

    private static IQueryable<Distributor> Query(AppDbContext db) => db.Distributors.AsNoTracking().Include(d => d.City);

    private static bool HasLocation(Distributor d) =>
        !string.IsNullOrEmpty(d.GoogleMapsUrl) || (d.Latitude is not null && d.Longitude is not null);

    private static async Task<ValidationErrors> ApplyAsync(DistributorRequest r, Distributor d, AppDbContext db, CancellationToken ct)
    {
        var errors = new ValidationErrors();

        var name = errors.Required("name", r.Name, 120);
        if (name is { Length: < 2 })
        {
            errors.Add("name", "الاسم قصير جداً.");
        }
        var address = errors.Required("address", r.Address, 300);
        if (address is { Length: < 5 })
        {
            errors.Add("address", "اكتب العنوان بالتفصيل.");
        }

        if (r.CityId is not { } cityId || !await db.Cities.AnyAsync(c => c.Id == cityId, ct))
        {
            errors.Add("cityId", "اختر المدينة.");
        }

        string? phone = null;
        if (!string.IsNullOrWhiteSpace(r.PhoneNumber))
        {
            // Shops are in Palestine, so a local number ("059…", "09…") is read as +970.
            phone = PhoneNumbers.NormalizeWithDefaultCountry(r.PhoneNumber, "+970");
            if (phone is null)
            {
                errors.Add("phoneNumber", "رقم هاتف غير صالح. مثال: 059 123 4567 أو ‎+972 52 123 4567.");
            }
        }

        var mapsUrl = string.IsNullOrWhiteSpace(r.GoogleMapsUrl) ? null : r.GoogleMapsUrl.Trim();
        if (mapsUrl is not null && !MapLinks.IsAllowedGoogleMapsUrl(mapsUrl))
        {
            errors.Add("googleMapsUrl", "الصق رابطاً من خرائط Google يبدأ بـ https، مثل https://maps.app.goo.gl/…");
        }

        if ((r.Latitude is null) != (r.Longitude is null))
        {
            errors.Add(r.Latitude is null ? "latitude" : "longitude", "أدخل خط العرض وخط الطول معاً، أو اتركهما فارغين.");
        }
        errors.Number("latitude", r.Latitude, -90m, 90m, 6, required: false);
        errors.Number("longitude", r.Longitude, -180m, 180m, 6, required: false);

        if (r.IsActive && mapsUrl is null && (r.Latitude is null || r.Longitude is null))
        {
            errors.Add("isActive", NeedsLocation);
        }

        if (!errors.Any)
        {
            d.Name = name!;
            d.Address = address!;
            d.CityId = r.CityId!.Value;
            d.PhoneNumber = phone;
            d.GoogleMapsUrl = mapsUrl;
            d.Latitude = r.Latitude;
            d.Longitude = r.Longitude;
            d.IsActive = r.IsActive;
        }
        return errors;
    }

    private static AdminDistributorDto ToDto(Distributor d) => new(
        d.Id, d.Name, d.CityId, d.City.Name.Ar, d.Address, d.PhoneNumber, d.GoogleMapsUrl, d.Latitude, d.Longitude,
        MapLinks.Build(d.Latitude, d.Longitude, d.GoogleMapsUrl), MediaUrls.For(d.ImageKey), d.IsActive, d.DisplayOrder, d.Version);
}
