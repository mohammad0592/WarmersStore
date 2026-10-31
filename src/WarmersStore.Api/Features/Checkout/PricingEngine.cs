using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Checkout;

/// <summary>
/// Prices a cart from current database values and checks every configured rule.
/// Pure and deterministic: no I/O, so each rule is unit-tested directly.
/// Expects a cart that already passed <see cref="CheckoutRequestValidator.ValidateCart"/>.
/// </summary>
public static class PricingEngine
{
    /// <param name="forSubmission">
    /// Quotes for the cart page tolerate a missing delivery area; a submission doesn't.
    /// </param>
    public static QuoteDto Price(
        IReadOnlyList<CartLineRequest> cart, int? deliveryAreaId, PricingContext context, bool forSubmission)
    {
        var lines = new List<QuoteLineDto>(cart.Count);
        var customNumber = 0;

        foreach (var line in cart)
        {
            lines.Add(line.Kind == CartLineKind.ReadyMade
                ? PriceReadyMade(line, context)
                : PriceCustom(line, ++customNumber, context));
        }

        var errors = new List<CheckoutError>();
        if (lines.Count == 0)
        {
            errors.Add(CheckoutErrors.CartEmpty());
        }

        var subtotal = lines.Sum(l => l.LineTotal);
        var discountTotal = lines.Sum(l => l.Discount);

        if (lines.Count > 0 && context.Store.MinOrderTotal is { } minOrder && subtotal < minOrder)
        {
            errors.Add(CheckoutErrors.MinOrderTotal(minOrder));
        }

        var delivery = PriceDelivery(subtotal, deliveryAreaId, context, forSubmission, errors);

        return new QuoteDto(
            lines,
            subtotal,
            discountTotal,
            delivery,
            subtotal + (delivery.Fee ?? 0),
            errors,
            IsValid: errors.Count == 0 && lines.All(l => l.Errors.Count == 0));
    }

    private static QuoteLineDto PriceReadyMade(CartLineRequest line, PricingContext context)
    {
        var quantity = line.Quantity!.Value;

        if (!context.Packages.TryGetValue(line.PackageId!.Value, out var package))
        {
            return new QuoteLineDto(line.LineId!, CartLineKind.ReadyMade, line.PackageId, null, quantity, null,
                0, 0, 0, 0, [], [CheckoutErrors.PackageNotFound()]);
        }

        var contents = package.Items
            .OrderBy(i => i.Product.DisplayOrder).ThenBy(i => i.ProductId)
            .Select(i => new QuoteItemDto(
                i.ProductId,
                i.Product.Name.Resolve(PublicApi.Language),
                i.Quantity,
                i.Product.SellingUnit,
                i.Quantity * i.Product.PiecesPerSellingUnit,
                UnitPrice: null,
                Subtotal: null))
            .ToList();

        List<CheckoutError> errors = package.Items.Count == 0 || package.Items.Any(i => !i.Product.IsActive)
            ? [CheckoutErrors.PackageUnavailable()]
            : [];

        var subtotal = package.Price * quantity;

        return new QuoteLineDto(
            line.LineId!,
            CartLineKind.ReadyMade,
            package.Id,
            package.Name.Resolve(PublicApi.Language),
            quantity,
            package.Price,
            TotalUnits: package.Items.Sum(i => i.Quantity) * quantity,
            subtotal,
            Discount: 0,
            LineTotal: subtotal,
            contents,
            errors);
    }

    private static QuoteLineDto PriceCustom(CartLineRequest line, int number, PricingContext context)
    {
        var settings = context.CustomSettings;
        var errors = new List<CheckoutError>();
        var items = new List<QuoteItemDto>();

        if (!settings.IsEnabled)
        {
            errors.Add(CheckoutErrors.CustomDisabled());
        }

        foreach (var request in line.Items!)
        {
            var productId = request.ProductId!.Value;
            var quantity = request.Quantity!.Value;

            if (!context.Products.TryGetValue(productId, out var product))
            {
                errors.Add(CheckoutErrors.ProductNotFound(productId));
                items.Add(new QuoteItemDto(productId, null, quantity, null, 0, null, null));
                continue;
            }

            var name = product.Name.Resolve(PublicApi.Language);
            var pieces = quantity * product.PiecesPerSellingUnit;

            if (!product.IsActive || !product.IsCustomEligible || product.UnitPrice is not { } unitPrice)
            {
                errors.Add(CheckoutErrors.ProductUnavailable(productId, name));
                items.Add(new QuoteItemDto(productId, name, quantity, product.SellingUnit, pieces, null, null));
                continue;
            }

            context.ProductRules.TryGetValue(productId, out var rule);
            if (rule?.MinQty is { } min && quantity < min)
            {
                errors.Add(CheckoutErrors.ProductMinQuantity(productId, name, min));
            }

            if (EffectiveMax(rule?.MaxQty, settings.MaxQuantityPerProduct) is { } max && quantity > max)
            {
                errors.Add(CheckoutErrors.ProductMaxQuantity(productId, name, max));
            }

            items.Add(new QuoteItemDto(productId, name, quantity, product.SellingUnit, pieces, unitPrice, unitPrice * quantity));
        }

        var totalUnits = items.Sum(i => i.Quantity);
        var subtotal = items.Sum(i => i.Subtotal ?? 0);

        if (settings.MinItems is { } minItems && totalUnits < minItems)
        {
            errors.Add(CheckoutErrors.CustomMinItems(minItems));
        }

        if (settings.MaxItems is { } maxItems && totalUnits > maxItems)
        {
            errors.Add(CheckoutErrors.CustomMaxItems(maxItems));
        }

        // Compared before discounts: the threshold is about what the customer picked.
        if (settings.MinSubtotal is { } minSubtotal && subtotal < minSubtotal)
        {
            errors.Add(CheckoutErrors.CustomMinSubtotal(minSubtotal));
        }

        var discount = Discount(subtotal, totalUnits, context.DiscountTiers);

        return new QuoteLineDto(
            line.LineId!,
            CartLineKind.Custom,
            PackageId: null,
            Name: $"باقة مخصّصة {number}",
            Quantity: 1,
            UnitPrice: null,
            totalUnits,
            subtotal,
            discount,
            subtotal - discount,
            items,
            errors);
    }

    private static int? EffectiveMax(int? productMax, int? globalMax) =>
        (productMax, globalMax) switch
        {
            ({ } p, { } g) => Math.Min(p, g),
            ({ } p, null) => p,
            (null, { } g) => g,
            _ => null,
        };

    /// <summary>
    /// The tier with the highest threshold the package reaches applies. Percentages round to the
    /// nearest agora (half away from zero); a discount never exceeds the subtotal.
    /// </summary>
    public static decimal Discount(decimal subtotal, int totalUnits, IReadOnlyList<CustomDiscountTier> tiers)
    {
        var tier = tiers
            .Where(t => t.IsActive && t.MinItems <= totalUnits)
            .OrderByDescending(t => t.MinItems)
            .ThenByDescending(t => AmountFor(t, subtotal))
            .FirstOrDefault();

        return tier is null ? 0 : AmountFor(tier, subtotal);
    }

    private static decimal AmountFor(CustomDiscountTier tier, decimal subtotal)
    {
        var amount = tier.Type == DiscountType.Percent
            ? Math.Round(subtotal * tier.Value / 100m, 2, MidpointRounding.AwayFromZero)
            : tier.Value;
        return Math.Min(amount, subtotal);
    }

    private static DeliveryQuoteDto PriceDelivery(
        decimal subtotal, int? areaId, PricingContext context, bool forSubmission, List<CheckoutError> errors)
    {
        var settings = context.Delivery;

        switch (settings.Mode)
        {
            case DeliveryMode.Flat:
            {
                var free = settings.FreeDeliveryThreshold is { } threshold && subtotal >= threshold;
                var fee = free ? 0 : settings.FlatFee ?? 0;
                return new DeliveryQuoteDto(settings.Mode, null, null, fee, fee == 0);
            }

            case DeliveryMode.PerArea:
            {
                if (areaId is null)
                {
                    if (forSubmission)
                    {
                        errors.Add(CheckoutErrors.DeliveryAreaRequired());
                    }
                    return new DeliveryQuoteDto(settings.Mode, null, null, null, false);
                }

                if (!context.DeliveryAreas.TryGetValue(areaId.Value, out var area))
                {
                    errors.Add(CheckoutErrors.DeliveryAreaInvalid());
                    return new DeliveryQuoteDto(settings.Mode, areaId, null, null, false);
                }

                var threshold = area.FreeDeliveryThreshold ?? settings.FreeDeliveryThreshold;
                var fee = threshold is { } t && subtotal >= t ? 0 : area.Fee;
                return new DeliveryQuoteDto(settings.Mode, area.Id, area.Name.Resolve(PublicApi.Language), fee, fee == 0);
            }

            default:
                return new DeliveryQuoteDto(DeliveryMode.None, null, null, 0, false);
        }
    }
}
