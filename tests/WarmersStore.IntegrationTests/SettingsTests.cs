using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.CustomPackages;
using WarmersStore.Api.Features.Delivery;
using WarmersStore.Api.Features.Settings;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class SettingsTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    [Fact]
    public async Task Defaults_HaveNoBusinessRulesConfigured()
    {
        var store = await Api.GetJsonAsync<PublicStoreSettingsDto>("/api/store-settings");
        var rules = await Api.GetJsonAsync<CustomPackageRulesDto>("/api/custom-package-rules");
        var delivery = await Api.GetJsonAsync<DeliveryOptionsDto>("/api/delivery-options");

        Assert.Equal("دفا", store.StoreName);
        Assert.Null(store.WhatsAppNumber);
        Assert.False(store.ShowDistributors);

        Assert.True(rules.IsEnabled);
        Assert.Null(rules.MinItems);
        Assert.Null(rules.MaxItems);
        Assert.Null(rules.MinSubtotal);
        Assert.Empty(rules.DiscountTiers);

        Assert.Equal(DeliveryMode.None, delivery.Mode);
        Assert.Empty(delivery.Areas);
    }

    [Fact]
    public async Task Announcement_IsOnlyPublishedWhenActive()
    {
        await Api.WithDbAsync(async db =>
        {
            var s = await db.StoreSettings.SingleAsync();
            s.Announcement = LocalizedText.Arabic("عرض الشتاء");
            await db.SaveChangesAsync();
        });
        Assert.Null((await Api.GetJsonAsync<PublicStoreSettingsDto>("/api/store-settings")).Announcement);

        await Api.WithDbAsync(async db =>
        {
            (await db.StoreSettings.SingleAsync()).AnnouncementActive = true;
            await db.SaveChangesAsync();
        });
        Assert.Equal("عرض الشتاء", (await Api.GetJsonAsync<PublicStoreSettingsDto>("/api/store-settings")).Announcement);
    }

    [Fact]
    public async Task Delivery_AreasAreListedOnlyInPerAreaMode()
    {
        await Api.WithDbAsync(async db =>
        {
            var s = await db.DeliverySettings.SingleAsync();
            s.Mode = DeliveryMode.Flat;
            s.FlatFee = 20m;
            db.DeliveryAreas.AddRange(
                new DeliveryArea { Name = LocalizedText.Arabic("منطقة ١"), Fee = 15m, IsActive = true, DisplayOrder = 1 },
                new DeliveryArea { Name = LocalizedText.Arabic("منطقة ٢"), Fee = 30m, IsActive = false });
            await db.SaveChangesAsync();
        });

        var flat = await Api.GetJsonAsync<DeliveryOptionsDto>("/api/delivery-options");
        Assert.Equal(20m, flat.FlatFee);
        Assert.Empty(flat.Areas);

        await Api.WithDbAsync(async db =>
        {
            (await db.DeliverySettings.SingleAsync()).Mode = DeliveryMode.PerArea;
            await db.SaveChangesAsync();
        });

        var perArea = await Api.GetJsonAsync<DeliveryOptionsDto>("/api/delivery-options");
        Assert.Null(perArea.FlatFee);
        Assert.Equal(["منطقة ١"], perArea.Areas.Select(a => a.Name));
    }

    [Fact]
    public async Task CustomRules_PublishOnlyActiveTiersAndConfiguredProductRules()
    {
        await Api.WithDbAsync(async db =>
        {
            var body = await db.Products.SingleAsync(p => p.Slug == "body-warmer");
            body.IsActive = true;
            db.ProductCustomRules.Add(new ProductCustomRule { Product = body, MaxQty = 10 });
            db.CustomDiscountTiers.AddRange(
                new CustomDiscountTier { MinItems = 20, Type = DiscountType.Percent, Value = 10m, IsActive = true },
                new CustomDiscountTier { MinItems = 10, Type = DiscountType.Fixed, Value = 5m, IsActive = true },
                new CustomDiscountTier { MinItems = 5, Type = DiscountType.Fixed, Value = 1m, IsActive = false });
            await db.SaveChangesAsync();
        });

        var rules = await Api.GetJsonAsync<CustomPackageRulesDto>("/api/custom-package-rules");

        Assert.Equal([10, 20], rules.DiscountTiers.Select(t => t.MinItems));
        Assert.Equal(10, Assert.Single(rules.ProductRules).MaxQty);
    }

    [Fact]
    public async Task Singletons_RejectASecondRow()
    {
        await Api.WithDbAsync(async db =>
        {
            await Assert.ThrowsAnyAsync<Exception>(() =>
                db.Database.ExecuteSqlRawAsync("INSERT INTO store_settings (id, store_name, announcement_active, show_distributors, updated_at) VALUES (2, 'x', false, false, now())"));
        });
    }
}
