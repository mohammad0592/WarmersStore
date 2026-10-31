using WarmersStore.Api.Features.Checkout;
using static WarmersStore.UnitTests.Checkout.PricingTestData;

namespace WarmersStore.UnitTests.Checkout;

public class CheckoutRequestValidatorTests
{
    [Fact]
    public void ValidCart_HasNoErrors() =>
        Assert.Empty(CheckoutRequestValidator.ValidateCart([ReadyMade(1, 2, "a"), Custom("b", (1, 1), (2, 3))]));

    [Fact]
    public void EmptyCart_IsStructurallyValid_TheEngineReportsIt() =>
        Assert.Empty(CheckoutRequestValidator.ValidateCart([]));

    public static TheoryData<string, CartLineRequest[]> MalformedCarts => new()
    {
        { "lines[1].lineId", [ReadyMade(1, 1, "same"), ReadyMade(2, 1, "same")] },
        { "lines[0].lineId", [new CartLineRequest(null, CartLineKind.ReadyMade, 1, 1, null)] },
        { "lines[0].kind", [new CartLineRequest("a", null, 1, 1, null)] },
        { "lines[0].quantity", [ReadyMade(1, 0)] },
        { "lines[0].quantity", [ReadyMade(1, -3)] },
        { "lines[0].quantity", [ReadyMade(1, 1000)] },
        { "lines[0].packageId", [new CartLineRequest("a", CartLineKind.ReadyMade, null, 1, null)] },
        { "lines[0].items", [new CartLineRequest("a", CartLineKind.Custom, null, null, [])] },
        { "lines[0]", [new CartLineRequest("a", CartLineKind.Custom, 5, null, [new CustomItemRequest(1, 1)])] },
        { "lines[0].items[1].productId", [Custom("a", (1, 1), (1, 2))] },
        { "lines[0].items[0].quantity", [Custom("a", (1, 0))] },
    };

    [Theory]
    [MemberData(nameof(MalformedCarts))]
    public void MalformedCart_IsRejected(string expectedKey, CartLineRequest[] lines) =>
        Assert.Contains(expectedKey, CheckoutRequestValidator.ValidateCart(lines).Keys);

    [Fact]
    public void TooManyLines_IsRejected()
    {
        var lines = Enumerable.Range(0, CheckoutRequestValidator.MaxLines + 1).Select(i => ReadyMade(1, 1, $"l{i}")).ToList();

        Assert.Contains("lines", CheckoutRequestValidator.ValidateCart(lines).Keys);
    }

    [Fact]
    public void NullLines_IsRejected() =>
        Assert.Contains("lines", CheckoutRequestValidator.ValidateCart(null).Keys);

    [Theory]
    [InlineData("+970599123456", "+970599123456")]
    [InlineData("  +970 59-912 3456 ", "+970599123456")]
    [InlineData("00970599123456", "+970599123456")]
    [InlineData("+٩٧٠٥٩٩١٢٣٤٥٦", "+970599123456")]
    [InlineData("+972 (52) 123-4567", "+972521234567")]
    [InlineData("+44 7700 900123", "+447700900123")]
    public void Phone_IsNormalizedToE164(string input, string expected) =>
        Assert.Equal(expected, CheckoutRequestValidator.NormalizePhone(input));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("0599123456")]      // no country code
    [InlineData("+0599123456")]     // country codes don't start with 0
    [InlineData("+97059912345678901")]
    [InlineData("+970 59x 123456")]
    public void Phone_InvalidIsRejected(string? input) =>
        Assert.Null(CheckoutRequestValidator.NormalizePhone(input));

    [Theory]
    [InlineData("059 912 3456", "+970599123456")]
    [InlineData("09-234-5678", "+97092345678")]
    [InlineData("٠٥٩٩١٢٣٤٥٦", "+970599123456")]
    [InlineData("+972 52 123 4567", "+972521234567")] // international numbers are kept
    [InlineData("0044 7700 900123", "+447700900123")]
    [InlineData("599123456", null)]                    // no leading 0 and no country code
    [InlineData("0", null)]
    public void PhoneWithDefaultCountry_ReadsLocalNumbersAsPalestinian(string input, string? expected) =>
        Assert.Equal(expected, WarmersStore.Api.Common.PhoneNumbers.NormalizeWithDefaultCountry(input, "+970"));

    [Fact]
    public void Customer_IsTrimmedAndNormalized()
    {
        var (customer, errors) = CheckoutRequestValidator.ValidateCustomer(new CustomerRequest(
            "  محمد \n أحمد ", "+970 599 123 456", "نابلس،\tشارع فيصل ", "\r\n", "رن الجرس\r\n\r\n\r\n\r\nمرتين\u0007"));

        Assert.Empty(errors);
        Assert.Equal("محمد أحمد", customer!.FullName);
        Assert.Equal("+970599123456", customer.WhatsAppNumber);
        Assert.Equal("نابلس، شارع فيصل", customer.Address);
        Assert.Null(customer.DeliveryInstructions);
        Assert.Equal("رن الجرس\n\nمرتين", customer.Notes);
    }

    [Fact]
    public void Customer_MissingRequiredFields_AreReportedPerField()
    {
        var (customer, errors) = CheckoutRequestValidator.ValidateCustomer(new CustomerRequest(" ", "123", "", null, new string('x', 501)));

        Assert.Null(customer);
        Assert.Equal(
            ["customer.address", "customer.fullName", "customer.notes", "customer.whatsAppNumber"],
            errors.Keys.Order());
    }
}
