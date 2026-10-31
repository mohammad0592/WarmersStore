using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Checkout;
using static WarmersStore.UnitTests.Checkout.PricingTestData;

namespace WarmersStore.UnitTests.Checkout;

public class PricingEngineTests
{
    private readonly PricingTestData _data = new();

    private static void AssertSingleError(QuoteLineDto line, string code) =>
        Assert.Equal(code, Assert.Single(line.Errors).Code);

    // ---- Ready-made packages ----

    [Fact]
    public void ReadyMade_UsesDatabasePriceTimesQuantity()
    {
        var quote = _data.Price(ReadyMade(10, 3));

        var line = Assert.Single(quote.Lines);
        Assert.Equal(49m, line.UnitPrice);
        Assert.Equal(147m, line.LineTotal);
        Assert.Equal(21, line.TotalUnits); // (5 + 2) × 3
        Assert.Equal(147m, quote.Total);
        Assert.True(quote.IsValid);
    }

    [Fact]
    public void ReadyMade_ListsContentsWithPieces()
    {
        var line = _data.Price(ReadyMade(10, 1)).Lines.Single();

        Assert.Equal([(1, 5, 5), (2, 2, 4)], line.Items.Select(i => (i.ProductId, i.Quantity, i.Pieces)));
    }

    [Fact]
    public void ReadyMade_UnknownOrInactivePackage_IsNotFound()
    {
        // Inactive or deleted packages are never loaded into the context, so both read as unknown.
        var quote = _data.Price(ReadyMade(999, 1));

        AssertSingleError(quote.Lines[0], "package_not_found");
        Assert.Equal(0m, quote.Total);
        Assert.False(quote.IsValid);
    }

    [Fact]
    public void ReadyMade_WithInactiveProduct_IsUnavailable()
    {
        _data.Products[2].IsActive = false;

        var quote = _data.Price(ReadyMade(10, 1));

        AssertSingleError(quote.Lines[0], "package_unavailable");
        Assert.False(quote.IsValid);
    }

    [Fact]
    public void MultipleDifferentPackagesAndCustomLines_AreSummed()
    {
        _data.AddPackage(11, "باقة اليوم", 10m, (1, 1), (2, 1));

        var quote = _data.Price(
            ReadyMade(10, 2, "a"),
            ReadyMade(11, 1, "b"),
            Custom("c", (1, 2)),
            Custom("d", (3, 1)));

        Assert.Equal(["a", "b", "c", "d"], quote.Lines.Select(l => l.LineId));
        Assert.Equal(98m + 10m + 12m + 4.5m, quote.Subtotal);
        Assert.Equal(["باقة مخصّصة 1", "باقة مخصّصة 2"], quote.Lines.Skip(2).Select(l => l.Name));
    }

    // ---- Custom packages ----

    [Fact]
    public void Custom_PricesEachProductFromDatabase()
    {
        var line = _data.Price(Custom("c", (1, 3), (3, 2))).Lines.Single();

        Assert.Equal([18m, 9m], line.Items.Select(i => i.Subtotal!.Value));
        Assert.Equal(27m, line.Subtotal);
        Assert.Equal(27m, line.LineTotal);
        Assert.Equal(5, line.TotalUnits);
        Assert.Empty(line.Errors);
    }

    [Fact]
    public void Custom_WithNoRulesConfigured_AcceptsAnyQuantity()
    {
        var quote = _data.Price(Custom("c", (1, 1)), Custom("big", (2, 900)));

        Assert.True(quote.IsValid);
    }

    [Fact]
    public void Custom_WhenDisabled_IsRejected()
    {
        _data.CustomSettings.IsEnabled = false;

        AssertSingleError(_data.Price(Custom("c", (1, 1))).Lines[0], "custom_disabled");
    }

    [Theory]
    [InlineData(false, true, true)]  // inactive
    [InlineData(true, false, true)]  // not eligible for custom packages
    [InlineData(true, true, false)]  // no price set
    public void Custom_UnavailableProduct_IsRejected(bool active, bool eligible, bool priced)
    {
        var product = _data.Products[1];
        product.IsActive = active;
        product.IsCustomEligible = eligible;
        product.UnitPrice = priced ? 6m : null;

        var line = _data.Price(Custom("c", (1, 1), (2, 1))).Lines.Single();

        var error = Assert.Single(line.Errors);
        Assert.Equal("product_unavailable", error.Code);
        Assert.Equal(1, error.Params!["productId"]);
        Assert.Equal(5m, line.Subtotal); // only the available product is priced
    }

    [Fact]
    public void Custom_UnknownProduct_IsRejected()
    {
        AssertSingleError(_data.Price(Custom("c", (404, 1))).Lines[0], "product_not_found");
    }

    [Theory]
    [InlineData(4, "custom_min_items")]
    [InlineData(5, null)]
    [InlineData(10, null)]
    [InlineData(11, "custom_max_items")]
    public void Custom_TotalUnitLimits(int units, string? expectedError)
    {
        _data.CustomSettings.MinItems = 5;
        _data.CustomSettings.MaxItems = 10;

        var line = _data.Price(Custom("c", (1, units))).Lines.Single();

        Assert.Equal(expectedError, line.Errors.SingleOrDefault()?.Code);
    }

    [Fact]
    public void Custom_MinSubtotal_IsCheckedBeforeDiscount()
    {
        _data.CustomSettings.MinSubtotal = 30m;
        _data.Tiers.Add(new CustomDiscountTier { MinItems = 1, Type = DiscountType.Fixed, Value = 5m, IsActive = true });

        var atThreshold = _data.Price(Custom("c", (1, 5))).Lines.Single(); // 30 before, 25 after discount
        var below = _data.Price(Custom("c", (1, 4))).Lines.Single();       // 24

        Assert.Empty(atThreshold.Errors);
        Assert.Equal(25m, atThreshold.LineTotal);
        AssertSingleError(below, "custom_min_subtotal");
    }

    [Fact]
    public void Custom_PerProductLimits()
    {
        _data.ProductRules[1] = new ProductCustomRule { ProductId = 1, MinQty = 2, MaxQty = 4 };

        AssertSingleError(_data.Price(Custom("c", (1, 1))).Lines[0], "product_min_qty");
        Assert.Empty(_data.Price(Custom("c", (1, 4))).Lines[0].Errors);
        AssertSingleError(_data.Price(Custom("c", (1, 5))).Lines[0], "product_max_qty");
    }

    [Theory]
    [InlineData(null, 6, 6)]  // only the global limit
    [InlineData(4, 6, 4)]     // the product rule is stricter
    [InlineData(8, 6, 6)]     // the global limit is stricter
    public void Custom_MaxPerProduct_UsesTheStricterLimit(int? productMax, int globalMax, int effectiveMax)
    {
        _data.CustomSettings.MaxQuantityPerProduct = globalMax;
        if (productMax is not null)
        {
            _data.ProductRules[1] = new ProductCustomRule { ProductId = 1, MaxQty = productMax };
        }

        Assert.Empty(_data.Price(Custom("c", (1, effectiveMax))).Lines[0].Errors);
        var error = Assert.Single(_data.Price(Custom("c", (1, effectiveMax + 1))).Lines[0].Errors);
        Assert.Equal("product_max_qty", error.Code);
        Assert.Equal(effectiveMax, error.Params!["max"]);
    }

    [Fact]
    public void Custom_RulesApplyPerPackage_NotAcrossPackages()
    {
        _data.CustomSettings.MaxItems = 5;

        var quote = _data.Price(Custom("a", (1, 5)), Custom("b", (1, 5)));

        Assert.True(quote.IsValid);
    }

    // ---- Discounts ----

    [Fact]
    public void Discount_HighestReachedTierApplies()
    {
        _data.Tiers.AddRange(
        [
            new() { MinItems = 5, Type = DiscountType.Fixed, Value = 2m, IsActive = true },
            new() { MinItems = 10, Type = DiscountType.Percent, Value = 10m, IsActive = true },
        ]);

        Assert.Equal(0m, _data.Price(Custom("c", (1, 4))).Lines[0].Discount);
        Assert.Equal(2m, _data.Price(Custom("c", (1, 9))).Lines[0].Discount);
        Assert.Equal(6m, _data.Price(Custom("c", (1, 10))).Lines[0].Discount); // 10% of 60

        var quote = _data.Price(Custom("c", (1, 10)));
        Assert.Equal(54m, quote.Subtotal);
        Assert.Equal(6m, quote.DiscountTotal);
    }

    [Fact]
    public void Discount_PercentRoundsToNearestAgoraHalfAwayFromZero()
    {
        var tiers = new[] { new CustomDiscountTier { MinItems = 1, Type = DiscountType.Percent, Value = 12.5m, IsActive = true } };

        Assert.Equal(0.69m, PricingEngine.Discount(5.5m, 1, tiers));   // 0.6875
        Assert.Equal(0.56m, PricingEngine.Discount(4.5m, 1, tiers));   // 0.5625
        Assert.Equal(0.13m, PricingEngine.Discount(1m, 1, tiers));     // 0.125 → up
    }

    [Fact]
    public void Discount_NeverExceedsSubtotal()
    {
        var tiers = new[] { new CustomDiscountTier { MinItems = 1, Type = DiscountType.Fixed, Value = 100m, IsActive = true } };

        Assert.Equal(6m, PricingEngine.Discount(6m, 1, tiers));
    }

    [Fact]
    public void Discount_DoesNotApplyToReadyMadePackages()
    {
        _data.Tiers.Add(new CustomDiscountTier { MinItems = 1, Type = DiscountType.Fixed, Value = 5m, IsActive = true });

        Assert.Equal(0m, _data.Price(ReadyMade(10, 5)).DiscountTotal);
    }

    // ---- Order-level rules and delivery ----

    [Fact]
    public void EmptyCart_IsInvalid()
    {
        var quote = _data.Price();

        Assert.Equal("cart_empty", Assert.Single(quote.Errors).Code);
        Assert.False(quote.IsValid);
    }

    [Fact]
    public void MinOrderTotal_IsCheckedAgainstSubtotalAfterDiscounts()
    {
        _data.Store.MinOrderTotal = 50m;

        Assert.Equal("min_order_total", Assert.Single(_data.Price(ReadyMade(10, 1)).Errors).Code); // 49
        Assert.Empty(_data.Price(ReadyMade(10, 2)).Errors);
    }

    [Fact]
    public void Delivery_NoneMode_ChargesNothing()
    {
        var delivery = _data.Price(ReadyMade(10, 1)).Delivery;

        Assert.Equal(DeliveryMode.None, delivery.Mode);
        Assert.Equal(0m, delivery.Fee);
    }

    [Fact]
    public void Delivery_FlatFee_WithFreeThreshold()
    {
        _data.Delivery.Mode = DeliveryMode.Flat;
        _data.Delivery.FlatFee = 20m;
        _data.Delivery.FreeDeliveryThreshold = 98m;

        var paid = _data.Price(ReadyMade(10, 1));
        var free = _data.Price(ReadyMade(10, 2));

        Assert.Equal(20m, paid.Delivery.Fee);
        Assert.Equal(69m, paid.Total);
        Assert.True(free.Delivery.IsFree);
        Assert.Equal(98m, free.Total);
    }

    [Fact]
    public void Delivery_PerArea_UsesAreaFeeAndThresholds()
    {
        _data.Delivery.Mode = DeliveryMode.PerArea;
        _data.Delivery.FreeDeliveryThreshold = 200m;
        _data.Areas[1] = new DeliveryArea { Id = 1, Name = LocalizedText.Arabic("نابلس"), Fee = 15m, IsActive = true };
        _data.Areas[2] = new DeliveryArea { Id = 2, Name = LocalizedText.Arabic("رام الله"), Fee = 25m, FreeDeliveryThreshold = 49m, IsActive = true };

        var nablus = PricingEngine.Price([ReadyMade(10, 1)], 1, _data.Context(), forSubmission: true);
        var ramallah = PricingEngine.Price([ReadyMade(10, 1)], 2, _data.Context(), forSubmission: true);

        Assert.Equal((15m, "نابلس", 64m), (nablus.Delivery.Fee!.Value, nablus.Delivery.AreaName, nablus.Total));
        Assert.True(ramallah.Delivery.IsFree); // the area's own threshold wins over the global one
        Assert.True(nablus.IsValid && ramallah.IsValid);
    }

    [Fact]
    public void Delivery_PerArea_AreaRequiredOnlyForSubmission()
    {
        _data.Delivery.Mode = DeliveryMode.PerArea;

        var quote = PricingEngine.Price([ReadyMade(10, 1)], null, _data.Context(), forSubmission: false);
        var submit = PricingEngine.Price([ReadyMade(10, 1)], null, _data.Context(), forSubmission: true);

        Assert.True(quote.IsValid);
        Assert.Null(quote.Delivery.Fee);
        Assert.Equal(49m, quote.Total);
        Assert.Equal("delivery_area_required", Assert.Single(submit.Errors).Code);
    }

    [Fact]
    public void Delivery_PerArea_UnknownOrInactiveArea_IsRejected()
    {
        _data.Delivery.Mode = DeliveryMode.PerArea;

        var quote = PricingEngine.Price([ReadyMade(10, 1)], 77, _data.Context(), forSubmission: false);

        Assert.Equal("delivery_area_invalid", Assert.Single(quote.Errors).Code);
    }
}
