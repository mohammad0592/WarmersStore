using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Delivery;

public sealed record DeliveryAreaDto(int Id, string Name, decimal Fee, decimal? FreeDeliveryThreshold, string? Note);

/// <summary>Delivery for online orders. Areas are only listed when fees are charged per area.</summary>
public sealed record DeliveryOptionsDto(
    DeliveryMode Mode,
    decimal? FlatFee,
    decimal? FreeDeliveryThreshold,
    string? Message,
    IReadOnlyList<DeliveryAreaDto> Areas);

public static class DeliveryEndpoints
{
    public static RouteGroupBuilder MapDeliveryEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/delivery-options", async (AppDbContext db, CancellationToken ct) =>
        {
            var settings = await db.DeliverySettings.AsNoTracking().SingleAsync(ct);

            List<DeliveryAreaDto> areas = [];
            if (settings.Mode == DeliveryMode.PerArea)
            {
                var activeAreas = await db.DeliveryAreas.AsNoTracking()
                    .Where(a => a.IsActive)
                    .OrderBy(a => a.DisplayOrder).ThenBy(a => a.Id)
                    .ToListAsync(ct);

                areas = activeAreas
                    .Select(a => new DeliveryAreaDto(
                        a.Id,
                        a.Name.Resolve(PublicApi.Language),
                        a.Fee,
                        a.FreeDeliveryThreshold,
                        a.Note?.Resolve(PublicApi.Language)))
                    .ToList();
            }

            return TypedResults.Ok(new DeliveryOptionsDto(
                settings.Mode,
                settings.Mode == DeliveryMode.Flat ? settings.FlatFee : null,
                settings.FreeDeliveryThreshold,
                settings.Message?.Resolve(PublicApi.Language),
                areas));
        })
        .WithTags("Delivery");

        return api;
    }
}
