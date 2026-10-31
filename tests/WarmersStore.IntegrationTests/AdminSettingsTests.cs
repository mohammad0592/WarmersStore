using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Checkout;
using WarmersStore.Api.Features.CustomPackages;
using WarmersStore.Api.Features.Delivery;
using WarmersStore.Api.Features.Orders;
using WarmersStore.Api.Features.Settings;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class AdminSettingsTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static StoreSettingsRequest Settings(string? whatsApp = "059 900 0000") => new(
        "دفا", whatsApp, null, "hello@dafa.example", "نابلس", "https://facebook.com/dafa", null, null,
        "توصيل مجاني فوق 100 ₪", true, null, true, "دفا لكل يوم", null, null);

    private static async Task<IDictionary<string, string[]>> Errors(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors;
    }

    // ---- Store settings ----

    [Fact]
    public async Task StoreSettings_SaveAndShowPublicly()
    {
        var admin = await Api.AdminClientAsync();

        var saved = await (await admin.PutAsJsonAsync("/api/admin/store-settings", Settings(), ApiFixture.Json))
            .Content.ReadFromJsonAsync<AdminStoreSettingsDto>(ApiFixture.Json);

        Assert.Equal("+970599000000", saved!.WhatsAppNumber); // local number read as +970
        var store = await Api.GetJsonAsync<PublicStoreSettingsDto>("/api/store-settings");
        Assert.Equal(("+970599000000", "توصيل مجاني فوق 100 ₪", true), (store.WhatsAppNumber, store.Announcement, store.ShowDistributors));
        Assert.Equal("دفا لكل يوم", store.Homepage.HeroTitle);
        Assert.Null(store.Homepage.HeroDescription);
    }

    [Fact]
    public async Task StoreSettings_ValidateEachField()
    {
        var admin = await Api.AdminClientAsync();
        var bad = Settings("not a phone") with
        {
            StoreName = "",
            Email = "nope",
            FacebookUrl = "javascript:alert(1)",
            InstagramUrl = "http://instagram.com/x",
            Announcement = null,
            MinOrderTotal = -5,
        };

        var errors = await Errors(await admin.PutAsJsonAsync("/api/admin/store-settings", bad, ApiFixture.Json));

        Assert.Equal(["announcement", "email", "facebookUrl", "instagramUrl", "minOrderTotal", "storeName", "whatsAppNumber"], errors.Keys.Order());
    }

    [Fact]
    public async Task SettingTheWhatsAppNumber_TurnsOrderingOn()
    {
        var admin = await Api.AdminClientAsync();
        int bodyId = 0;
        await Api.WithDbAsync(async db =>
        {
            var body = await db.Products.SingleAsync(p => p.Slug == "body-warmer");
            (body.IsActive, body.UnitPrice) = (true, 6m);
            await db.SaveChangesAsync();
            bodyId = body.Id;
        });
        var order = new SubmitRequest([new("c1", CartLineKind.Custom, null, null, [new(bodyId, 2)])], null,
            new CustomerRequest("محمد", "+970599123456", "نابلس، شارع فيصل", null, null));

        var before = await Api.PostJsonAsync("/api/checkout/submit", order);
        await admin.PutAsJsonAsync("/api/admin/store-settings", Settings(), ApiFixture.Json);
        var after = await Api.PostJsonAsync("/api/checkout/submit", order);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, before.StatusCode);
        Assert.Equal(HttpStatusCode.OK, after.StatusCode);
        Assert.StartsWith("https://wa.me/970599000000?", (await after.Content.ReadFromJsonAsync<SubmitResultDto>(ApiFixture.Json))!.WhatsAppUrl);
    }

    // ---- Custom package rules ----

    [Fact]
    public async Task CustomRules_SaveReplacesRulesAndTiers_AndAreEnforced()
    {
        var admin = await Api.AdminClientAsync();
        var bodyId = await Api.WithDbAsync(db => db.Products.Where(p => p.Slug == "body-warmer").Select(p => p.Id).SingleAsync());
        var rules = new CustomRulesRequest(true, 3, 20, null, 10,
            [new(bodyId, null, 4)],
            [new(10, DiscountType.Percent, 10m, true), new(5, DiscountType.Fixed, 2m, false)]);

        var saved = await (await admin.PutAsJsonAsync("/api/admin/custom-package-rules", rules, ApiFixture.Json))
            .Content.ReadFromJsonAsync<AdminCustomRulesDto>(ApiFixture.Json);
        var publicRules = await Api.GetJsonAsync<CustomPackageRulesDto>("/api/custom-package-rules");

        Assert.Equal([5, 10], saved!.DiscountTiers.Select(t => t.MinItems));
        Assert.Equal((3, 20, 10), (publicRules.MinItems!.Value, publicRules.MaxItems!.Value, publicRules.MaxQuantityPerProduct!.Value));
        Assert.Equal([10], publicRules.DiscountTiers.Select(t => t.MinItems)); // the inactive tier isn't published
        Assert.Equal(4, Assert.Single(saved.ProductRules).MaxQty);

        // Saving again replaces, never duplicates.
        await admin.PutAsJsonAsync("/api/admin/custom-package-rules", rules with { ProductRules = [], DiscountTiers = [] }, ApiFixture.Json);
        await Api.WithDbAsync(async db =>
        {
            Assert.Equal(0, await db.ProductCustomRules.CountAsync());
            Assert.Equal(0, await db.CustomDiscountTiers.CountAsync());
        });
    }

    [Fact]
    public async Task CustomRules_Validate()
    {
        var admin = await Api.AdminClientAsync();
        var bad = new CustomRulesRequest(true, 10, 5, -1m, 0,
            [new(9999, 5, 2)],
            [new(5, DiscountType.Percent, 150m, true), new(5, DiscountType.Fixed, 1m, true)]);

        var errors = await Errors(await admin.PutAsJsonAsync("/api/admin/custom-package-rules", bad, ApiFixture.Json));

        Assert.Equal(
            ["discountTiers[0].value", "discountTiers[1].minItems", "maxItems", "maxQuantityPerProduct", "minSubtotal", "productRules[0].maxQty", "productRules[0].productId"],
            errors.Keys.Order());
    }

    // ---- Delivery ----

    [Fact]
    public async Task Delivery_PerAreaNeedsAnActiveArea_ThenShowsAreasPublicly()
    {
        var admin = await Api.AdminClientAsync();

        var tooEarly = await admin.PutAsJsonAsync("/api/admin/delivery-settings", new DeliverySettingsRequest(DeliveryMode.PerArea, null, null, null), ApiFixture.Json);
        Assert.Contains("mode", (await Errors(tooEarly)).Keys);

        await admin.PostAsJsonAsync("/api/admin/delivery-areas", new DeliveryAreaRequest("نابلس", 15m, 150m, null, true), ApiFixture.Json);
        await admin.PostAsJsonAsync("/api/admin/delivery-areas", new DeliveryAreaRequest("جنين", 25m, null, null, false), ApiFixture.Json);
        var ok = await admin.PutAsJsonAsync("/api/admin/delivery-settings", new DeliverySettingsRequest(DeliveryMode.PerArea, null, null, "التوصيل خلال يومين"), ApiFixture.Json);

        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var options = await Api.GetJsonAsync<DeliveryOptionsDto>("/api/delivery-options");
        Assert.Equal((DeliveryMode.PerArea, "التوصيل خلال يومين"), (options.Mode, options.Message));
        Assert.Equal(["نابلس"], options.Areas.Select(a => a.Name));
    }

    [Fact]
    public async Task Delivery_FlatModeRequiresAFee()
    {
        var admin = await Api.AdminClientAsync();

        var errors = await Errors(await admin.PutAsJsonAsync("/api/admin/delivery-settings", new DeliverySettingsRequest(DeliveryMode.Flat, null, null, null), ApiFixture.Json));
        var ok = await admin.PutAsJsonAsync("/api/admin/delivery-settings", new DeliverySettingsRequest(DeliveryMode.Flat, 20m, 200m, null), ApiFixture.Json);

        Assert.Contains("flatFee", errors.Keys);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(20m, (await Api.GetJsonAsync<DeliveryOptionsDto>("/api/delivery-options")).FlatFee);
    }

    // ---- Orders ----

    private async Task<string> PlaceOrderAsync(string name = "محمد أحمد")
    {
        int bodyId = 0;
        await Api.WithDbAsync(async db =>
        {
            var body = await db.Products.SingleAsync(p => p.Slug == "body-warmer");
            (body.IsActive, body.UnitPrice) = (true, 6m);
            (await db.StoreSettings.SingleAsync()).WhatsAppNumber = "+970599000000";
            await db.SaveChangesAsync();
            bodyId = body.Id;
        });
        var response = await Api.PostJsonAsync("/api/checkout/submit", new SubmitRequest(
            [new("c1", CartLineKind.Custom, null, null, [new(bodyId, 3)])], null,
            new CustomerRequest(name, "+970599123456", "نابلس، شارع فيصل", null, "رن الجرس")));
        return (await response.Content.ReadFromJsonAsync<SubmitResultDto>(ApiFixture.Json))!.Reference;
    }

    [Fact]
    public async Task Orders_ListSearchAndDetails()
    {
        var admin = await Api.AdminClientAsync();
        var first = await PlaceOrderAsync("سارة");
        var second = await PlaceOrderAsync("محمد أحمد");

        var all = await admin.GetFromJsonAsync<AdminOrderPageDto>("/api/admin/orders", ApiFixture.Json);
        var byName = await admin.GetFromJsonAsync<AdminOrderPageDto>("/api/admin/orders?q=سارة", ApiFixture.Json);
        var byPhone = await admin.GetFromJsonAsync<AdminOrderPageDto>("/api/admin/orders?q=0599123456", ApiFixture.Json);
        var byReference = await admin.GetFromJsonAsync<AdminOrderPageDto>($"/api/admin/orders?q={second[^4..]}", ApiFixture.Json);

        Assert.Equal([second, first], all!.Items.Select(o => o.Reference)); // newest first
        Assert.Equal([first], byName!.Items.Select(o => o.Reference));
        Assert.Equal(2, byPhone!.Total);
        Assert.Contains(second, byReference!.Items.Select(o => o.Reference));

        var details = await admin.GetFromJsonAsync<AdminOrderDto>($"/api/admin/orders/{all.Items[0].Id}", ApiFixture.Json);
        Assert.Equal((18m, "رن الجرس"), (details!.Total, details.Notes));
        Assert.Contains(second, details.WhatsAppMessage);
        Assert.Equal([OrderStatus.Confirmed, OrderStatus.Cancelled], details.AllowedNextStatuses);
        Assert.Equal(3, details.Items.Single().Products.Single().Quantity);
    }

    [Fact]
    public async Task Orders_StatusMovesOnlyAlongAllowedPaths()
    {
        var admin = await Api.AdminClientAsync();
        await PlaceOrderAsync();
        var id = (await admin.GetFromJsonAsync<AdminOrderPageDto>("/api/admin/orders", ApiFixture.Json))!.Items.Single().Id;

        async Task<HttpStatusCode> Move(OrderStatus status) =>
            (await admin.PatchAsJsonAsync($"/api/admin/orders/{id}/status", new { status }, ApiFixture.Json)).StatusCode;

        Assert.Equal(HttpStatusCode.Conflict, await Move(OrderStatus.Completed)); // must be confirmed first
        Assert.Equal(HttpStatusCode.OK, await Move(OrderStatus.Confirmed));
        Assert.Equal(HttpStatusCode.OK, await Move(OrderStatus.Completed));
        Assert.Equal(HttpStatusCode.Conflict, await Move(OrderStatus.Cancelled)); // completed is final

        var pending = await admin.GetFromJsonAsync<AdminOrderPageDto>("/api/admin/orders?status=PendingConfirmation", ApiFixture.Json);
        Assert.Equal(0, pending!.Total);
    }
}
