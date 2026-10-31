using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Infrastructure.Persistence.Seeding;

/// <summary>
/// Development-only placeholder data so the storefront has something to show.
/// Every price, package and distributor here is illustrative, not a business decision.
/// Distributors are fictional and visibly marked; their map links point at the city, not a shop.
/// </summary>
public static class SampleDataSeeder
{
    public const string SampleMarker = "(بيانات تجريبية)";

    public static async Task SeedAsync(AppDbContext db, ILogger logger)
    {
        if (await db.Packages.IgnoreQueryFilters().AnyAsync() || await db.Cities.AnyAsync())
        {
            return;
        }

        logger.LogInformation("Seeding development sample data");

        var products = await db.Products.ToDictionaryAsync(p => p.Slug);
        SetSampleProduct(products, "body-warmer", 6m);
        SetSampleProduct(products, "hand-warmer", 5m);
        SetSampleProduct(products, "foot-warmer", 6m);
        SetSampleProduct(products, "toe-warmer", 5m);

        db.Packages.AddRange(
            SamplePackage("daily", "باقة اليوم", 10m, 1, featured: false,
                (products["body-warmer"], 1), (products["hand-warmer"], 1)),
            SamplePackage("weekly", "باقة الأسبوع", 49m, 2, featured: true,
                (products["body-warmer"], 5), (products["hand-warmer"], 2), (products["toe-warmer"], 1)),
            SamplePackage("family", "باقة العائلة", 99m, 3, featured: true,
                (products["body-warmer"], 8), (products["hand-warmer"], 3),
                (products["foot-warmer"], 2), (products["toe-warmer"], 2)));

        var nablus = SampleCity("nablus", "نابلس", 1);
        var ramallah = SampleCity("ramallah", "رام الله", 2);
        var hebron = SampleCity("hebron", "الخليل", 3);
        var jenin = SampleCity("jenin", "جنين", 4); // no distributors: exercises the empty state
        db.Cities.AddRange(nablus, ramallah, hebron, jenin);

        db.Distributors.AddRange(
            SampleDistributor(nablus, 1, "موزع تجريبي ١", "+970590000001"),
            SampleDistributor(nablus, 2, "موزع تجريبي ٢", null),
            SampleDistributor(ramallah, 1, "موزع تجريبي ٣", "+970590000003"),
            SampleDistributor(hebron, 1, "موزع تجريبي ٤", null),
            SampleDistributor(hebron, 2, "موزع تجريبي ٥ (غير مفعّل)", null, isActive: false));

        var store = await db.StoreSettings.SingleAsync();
        store.ShowDistributors = true;

        await db.SaveChangesAsync();
    }

    private static void SetSampleProduct(Dictionary<string, Product> products, string slug, decimal price)
    {
        var product = products[slug];
        product.UnitPrice = price;
        product.IsActive = true;
        product.ShortDescription ??= LocalizedText.Arabic($"وصف تجريبي للمنتج {SampleMarker}");
    }

    private static ReadyMadePackage SamplePackage(
        string slug, string name, decimal price, int order, bool featured, params (Product Product, int Quantity)[] items) =>
        new()
        {
            Slug = slug,
            Name = LocalizedText.Arabic(name),
            Description = LocalizedText.Arabic($"محتوى وسعر تجريبيان {SampleMarker}"),
            Price = price,
            IsActive = true,
            IsFeatured = featured,
            DisplayOrder = order,
            Items = items.Select(i => new PackageItem { Product = i.Product, ProductId = i.Product.Id, Quantity = i.Quantity }).ToList(),
        };

    private static City SampleCity(string slug, string name, int order) =>
        new() { Slug = slug, Name = LocalizedText.Arabic(name), DisplayOrder = order };

    private static Distributor SampleDistributor(City city, int order, string name, string? phone, bool isActive = true) =>
        new()
        {
            City = city,
            Name = $"{name} {SampleMarker}",
            Address = $"عنوان تجريبي، {city.Name.Ar} {SampleMarker}",
            PhoneNumber = phone,
            GoogleMapsUrl = $"https://www.google.com/maps/search/?api=1&query={Uri.EscapeDataString(city.Name.Ar)}",
            IsActive = isActive,
            DisplayOrder = order,
        };
}
