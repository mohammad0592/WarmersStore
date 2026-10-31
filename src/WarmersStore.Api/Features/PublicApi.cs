using WarmersStore.Api.Features.Catalog;
using WarmersStore.Api.Features.Checkout;
using WarmersStore.Api.Features.CustomPackages;
using WarmersStore.Api.Features.Delivery;
using WarmersStore.Api.Features.Distributors;
using WarmersStore.Api.Features.Packages;
using WarmersStore.Api.Features.Settings;

namespace WarmersStore.Api.Features;

public static class PublicApi
{
    /// <summary>Content language until English is added; the language-resolution point for DTOs.</summary>
    public const string Language = "ar";

    public static WebApplication MapPublicApi(this WebApplication app)
    {
        var api = app.MapGroup("/api");

        api.MapCatalogEndpoints();
        api.MapPackageEndpoints();
        api.MapCustomPackageEndpoints();
        api.MapDeliveryEndpoints();
        api.MapStoreSettingsEndpoints();
        api.MapDistributorEndpoints();
        api.MapCheckoutEndpoints();

        return app;
    }
}
