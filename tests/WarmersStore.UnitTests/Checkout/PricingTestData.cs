using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Checkout;

namespace WarmersStore.UnitTests.Checkout;

/// <summary>Builds pricing contexts and carts in memory for engine tests.</summary>
internal sealed class PricingTestData
{
    public Dictionary<int, Product> Products { get; } = new()
    {
        [1] = Product(1, "لاصق تدفئة الجسم", price: 6m, piecesPerUnit: 1),
        [2] = Product(2, "دفاية اليدين", price: 5m, piecesPerUnit: 2),
        [3] = Product(3, "دفاية القدم", price: 4.5m, piecesPerUnit: 2),
    };

    public Dictionary<int, ReadyMadePackage> Packages { get; } = [];
    public CustomPackageSettings CustomSettings { get; } = new();
    public Dictionary<int, ProductCustomRule> ProductRules { get; } = [];
    public List<CustomDiscountTier> Tiers { get; } = [];
    public DeliverySettings Delivery { get; } = new();
    public Dictionary<int, DeliveryArea> Areas { get; } = [];
    public StoreSettings Store { get; } = new() { WhatsAppNumber = "+970599000000" };

    public PricingTestData()
    {
        AddPackage(10, "باقة الأسبوع", 49m, (1, 5), (2, 2));
    }

    public PricingContext Context() =>
        new(Packages, Products, CustomSettings, ProductRules, Tiers, Delivery, Areas, Store);

    public QuoteDto Price(params CartLineRequest[] lines) =>
        PricingEngine.Price(lines, null, Context(), forSubmission: false);

    public ReadyMadePackage AddPackage(int id, string name, decimal price, params (int ProductId, int Qty)[] items)
    {
        var package = new ReadyMadePackage
        {
            Id = id,
            Slug = $"p{id}",
            Name = LocalizedText.Arabic(name),
            Price = price,
            IsActive = true,
            Items = items.Select(i => new PackageItem
            {
                PackageId = id,
                ProductId = i.ProductId,
                Product = Products[i.ProductId],
                Quantity = i.Qty,
            }).ToList(),
        };
        Packages[id] = package;
        return package;
    }

    public static CartLineRequest ReadyMade(int packageId, int quantity, string lineId = "r1") =>
        new(lineId, CartLineKind.ReadyMade, packageId, quantity, null);

    public static CartLineRequest Custom(string lineId, params (int ProductId, int Qty)[] items) =>
        new(lineId, CartLineKind.Custom, null, null, items.Select(i => new CustomItemRequest(i.ProductId, i.Qty)).ToList());

    private static Product Product(int id, string name, decimal price, int piecesPerUnit) => new()
    {
        Id = id,
        Slug = $"product-{id}",
        Name = LocalizedText.Arabic(name),
        UnitPrice = price,
        IsActive = true,
        IsCustomEligible = true,
        PiecesPerRetailBag = piecesPerUnit,
        SellingUnit = SellingUnit.RetailBag,
        PiecesPerSellingUnit = piecesPerUnit,
        DisplayOrder = id,
    };
}
