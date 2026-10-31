using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Infrastructure.Persistence.Seeding;

/// <summary>
/// Data every environment needs: the single settings rows, and the four products from the
/// project brief. Products start inactive and unpriced so the admin reviews, prices and
/// activates them; nothing beyond the brief's specifications is filled in.
/// </summary>
public static class EssentialDataSeeder
{
    public static async Task SeedAsync(AppDbContext db, ILogger logger)
    {
        if (!await db.CustomPackageSettings.AnyAsync())
        {
            db.CustomPackageSettings.Add(new CustomPackageSettings());
        }

        if (!await db.DeliverySettings.AnyAsync())
        {
            db.DeliverySettings.Add(new DeliverySettings());
        }

        if (!await db.StoreSettings.AnyAsync())
        {
            db.StoreSettings.Add(new StoreSettings());
        }

        if (!await db.Products.AnyAsync())
        {
            logger.LogInformation("Seeding initial product catalog (inactive, unpriced)");
            db.Products.AddRange(InitialProducts());
        }

        await db.SaveChangesAsync();
    }

    // Selling unit defaults to the factory retail bag so bags are never split; the admin can change it.
    private static IEnumerable<Product> InitialProducts() =>
    [
        new()
        {
            Slug = "body-warmer",
            Name = LocalizedText.Arabic("لاصق تدفئة الجسم"),
            WidthCm = 10, HeightCm = 13,
            HeatMinHours = 8, HeatMaxHours = 10,
            IsAdhesive = true,
            PiecesPerRetailBag = 1,
            SellingUnit = SellingUnit.RetailBag, PiecesPerSellingUnit = 1,
            DisplayOrder = 1,
        },
        new()
        {
            Slug = "hand-warmer",
            Name = LocalizedText.Arabic("دفاية اليدين"),
            WidthCm = 5.5m, HeightCm = 9,
            HeatMinHours = 8, HeatMaxHours = 10,
            IsAdhesive = false,
            PiecesPerRetailBag = 2,
            SellingUnit = SellingUnit.RetailBag, PiecesPerSellingUnit = 2,
            DisplayOrder = 2,
        },
        new()
        {
            Slug = "foot-warmer",
            Name = LocalizedText.Arabic("دفاية القدم"),
            WidthCm = 8, HeightCm = 12,
            HeatMinHours = 3, HeatMaxHours = 4,
            IsAdhesive = null, // not specified in the brief
            PiecesPerRetailBag = 2,
            SellingUnit = SellingUnit.RetailBag, PiecesPerSellingUnit = 2,
            DisplayOrder = 3,
        },
        new()
        {
            Slug = "toe-warmer",
            Name = LocalizedText.Arabic("لاصق تدفئة أصابع القدم"),
            WidthCm = 7, HeightCm = 10,
            HeatMinHours = 7, HeatMaxHours = 8,
            IsAdhesive = true,
            PiecesPerRetailBag = 2,
            SellingUnit = SellingUnit.RetailBag, PiecesPerSellingUnit = 2,
            DisplayOrder = 4,
        },
    ];
}
