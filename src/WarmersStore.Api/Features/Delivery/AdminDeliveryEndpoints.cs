using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Admin;
using WarmersStore.Api.Features.Catalog;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Delivery;

public sealed record AdminDeliverySettingsDto(DeliveryMode Mode, decimal? FlatFee, decimal? FreeDeliveryThreshold, string? Message);

public sealed record DeliverySettingsRequest(DeliveryMode? Mode, decimal? FlatFee, decimal? FreeDeliveryThreshold, string? Message);

public sealed record AdminDeliveryAreaDto(int Id, string Name, decimal Fee, decimal? FreeDeliveryThreshold, string? Note, bool IsActive, int DisplayOrder);

public sealed record DeliveryAreaRequest(string? Name, decimal? Fee, decimal? FreeDeliveryThreshold, string? Note, bool IsActive);

/// <summary>Delivery for online orders only; distributors never deliver.</summary>
public static class AdminDeliveryEndpoints
{
    public static RouteGroupBuilder MapAdminDeliveryEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGet("/delivery-settings", async (AppDbContext db, CancellationToken ct) =>
            TypedResults.Ok(ToDto(await db.DeliverySettings.AsNoTracking().SingleAsync(ct))));

        admin.MapPut("/delivery-settings", async Task<IResult> (DeliverySettingsRequest r, AppDbContext db, CancellationToken ct) =>
        {
            var errors = new ValidationErrors();
            if (r.Mode is null)
            {
                errors.Add("mode", "اختر طريقة احتساب التوصيل.");
            }
            errors.Number("flatFee", r.FlatFee, 0m, 10_000m, 2, required: r.Mode == DeliveryMode.Flat);
            errors.Number("freeDeliveryThreshold", r.FreeDeliveryThreshold, 0m, 100_000m, 2, required: false);
            var message = errors.Optional("message", r.Message, 300);
            if (r.Mode == DeliveryMode.PerArea && !await db.DeliveryAreas.AnyAsync(a => a.IsActive, ct))
            {
                errors.Add("mode", "أضف منطقة توصيل فعّالة واحدة على الأقل قبل اختيار التوصيل حسب المنطقة.");
            }
            if (errors.Any)
            {
                return errors.ToResult();
            }

            var s = await db.DeliverySettings.SingleAsync(ct);
            s.Mode = r.Mode!.Value;
            s.FlatFee = r.FlatFee;
            s.FreeDeliveryThreshold = r.FreeDeliveryThreshold;
            s.Message = AdminResults.Localized(message, s.Message);
            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(ToDto(s));
        });

        var areas = admin.MapGroup("/delivery-areas");

        areas.MapGet("/", async (AppDbContext db, CancellationToken ct) => TypedResults.Ok(await ListAsync(db, ct)));

        areas.MapPost("/", async Task<IResult> (DeliveryAreaRequest r, AppDbContext db, CancellationToken ct) =>
        {
            var area = new DeliveryArea { Name = LocalizedText.Arabic("") };
            var errors = Apply(r, area);
            if (errors.Any)
            {
                return errors.ToResult();
            }

            area.DisplayOrder = (await db.DeliveryAreas.MaxAsync(a => (int?)a.DisplayOrder, ct) ?? 0) + 1;
            db.DeliveryAreas.Add(area);
            await db.SaveChangesAsync(ct);
            return TypedResults.Created($"/api/admin/delivery-areas/{area.Id}", ToDto(area));
        });

        areas.MapPut("/{id:int}", async Task<IResult> (int id, DeliveryAreaRequest r, AppDbContext db, CancellationToken ct) =>
        {
            var area = await db.DeliveryAreas.SingleOrDefaultAsync(a => a.Id == id, ct);
            if (area is null)
            {
                return TypedResults.NotFound();
            }

            var errors = Apply(r, area);
            if (errors.Any)
            {
                return errors.ToResult();
            }
            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(ToDto(area));
        });

        // Orders keep a copy of the area's name, so deleting an area never changes past orders.
        areas.MapDelete("/{id:int}", async Task<IResult> (int id, AppDbContext db, CancellationToken ct) =>
        {
            var area = await db.DeliveryAreas.SingleOrDefaultAsync(a => a.Id == id, ct);
            if (area is null)
            {
                return TypedResults.NotFound();
            }

            db.DeliveryAreas.Remove(area);
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        });

        areas.MapPut("/order", async Task<IResult> (ReorderRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var all = await db.DeliveryAreas.ToListAsync(ct);
            if (request.Ids is null || request.Ids.Count != all.Count || !request.Ids.Order().SequenceEqual(all.Select(a => a.Id).Order()))
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["ids"] = ["Send every area id exactly once."] });
            }

            var byId = all.ToDictionary(a => a.Id);
            for (var i = 0; i < request.Ids.Count; i++)
            {
                byId[request.Ids[i]].DisplayOrder = i + 1;
            }
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        });

        return admin;
    }

    private static ValidationErrors Apply(DeliveryAreaRequest r, DeliveryArea area)
    {
        var errors = new ValidationErrors();
        var name = errors.Required("name", r.Name, 120);
        errors.Number("fee", r.Fee, 0m, 10_000m, 2, required: true);
        errors.Number("freeDeliveryThreshold", r.FreeDeliveryThreshold, 0m, 100_000m, 2, required: false);
        var note = errors.Optional("note", r.Note, 200);
        if (!errors.Any)
        {
            area.Name = AdminResults.Localized(name, area.Name)!;
            area.Fee = r.Fee!.Value;
            area.FreeDeliveryThreshold = r.FreeDeliveryThreshold;
            area.Note = AdminResults.Localized(note, area.Note);
            area.IsActive = r.IsActive;
        }
        return errors;
    }

    private static async Task<List<AdminDeliveryAreaDto>> ListAsync(AppDbContext db, CancellationToken ct) =>
        (await db.DeliveryAreas.AsNoTracking().OrderBy(a => a.DisplayOrder).ThenBy(a => a.Id).ToListAsync(ct)).Select(ToDto).ToList();

    private static AdminDeliverySettingsDto ToDto(DeliverySettings s) => new(s.Mode, s.FlatFee, s.FreeDeliveryThreshold, s.Message?.Ar);

    private static AdminDeliveryAreaDto ToDto(DeliveryArea a) =>
        new(a.Id, a.Name.Ar, a.Fee, a.FreeDeliveryThreshold, a.Note?.Ar, a.IsActive, a.DisplayOrder);
}
