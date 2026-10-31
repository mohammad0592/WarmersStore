using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Checkout;
using static WarmersStore.UnitTests.Checkout.PricingTestData;

namespace WarmersStore.UnitTests.Checkout;

public class WhatsAppMessageBuilderTests
{
    private static readonly CustomerInfo Customer =
        new("محمد أحمد", "+970599123456", "نابلس، شارع فيصل", "بعد الساعة 5", "رن الجرس");

    private readonly PricingTestData _data = new();

    [Fact]
    public void Message_ContainsCustomerOrderTotalsAndPaymentMethod()
    {
        _data.Delivery.Mode = DeliveryMode.Flat;
        _data.Delivery.FlatFee = 20m;
        var quote = _data.Price(ReadyMade(10, 2), Custom("c", (1, 3), (2, 1)));

        var message = WhatsAppMessageBuilder.Build("دفا", quote, Customer, reference: null);

        Assert.StartsWith("*طلب جديد من دفا*", message);
        Assert.Contains("*الاسم:* محمد أحمد", message);
        Assert.Contains("+970599123456", message);
        Assert.Contains("*العنوان:* نابلس، شارع فيصل", message);
        Assert.Contains("*تعليمات التوصيل:* بعد الساعة 5", message);
        Assert.Contains("• باقة الأسبوع × 2 = 98 ₪", message);
        Assert.Contains("(لاصق تدفئة الجسم × 5، دفاية اليدين × 2)", message);
        Assert.Contains("*باقة مخصّصة 1*", message);
        Assert.Contains("• لاصق تدفئة الجسم × 3 = 18 ₪", message);
        Assert.Contains("• دفاية اليدين × 1 (قطعتان) = 5 ₪", message);
        Assert.Contains("المجموع: 121 ₪", message);
        Assert.Contains("التوصيل: 20 ₪", message);
        Assert.Contains("*الإجمالي: 141 ₪*", message);
        Assert.Contains("الدفع نقداً عند الاستلام", message);
        Assert.Contains("*ملاحظات:* رن الجرس", message);
        Assert.DoesNotContain("رقم الطلب", message);
    }

    [Fact]
    public void Message_IncludesReferenceAndDiscount_WhenPresent()
    {
        _data.Tiers.Add(new CustomDiscountTier { MinItems = 1, Type = DiscountType.Fixed, Value = 2.5m, IsActive = true });
        var quote = _data.Price(Custom("c", (1, 2)));

        var message = WhatsAppMessageBuilder.Build("دفا", quote, Customer with { Notes = null }, "DF-261031-7K3Q");

        Assert.Contains("رقم الطلب: DF-261031-7K3Q", message);
        Assert.Contains("خصم: -2.50 ₪", message);
        Assert.Contains("مجموع الباقة: 9.50 ₪", message);
        Assert.DoesNotContain("ملاحظات", message);
    }

    [Fact]
    public void Message_FreeDelivery_IsSaidPlainly()
    {
        _data.Delivery.Mode = DeliveryMode.Flat;
        _data.Delivery.FlatFee = 20m;
        _data.Delivery.FreeDeliveryThreshold = 10m;

        var message = WhatsAppMessageBuilder.Build("دفا", _data.Price(ReadyMade(10, 1)), Customer, null);

        Assert.Contains("التوصيل: مجاني", message);
    }

    [Fact]
    public void Link_UsesDigitsOnlyAndEncodesTheWholeMessage()
    {
        var link = WhatsAppMessageBuilder.Link("+970599000000", "طلب & *جديد*\nسطر?");

        Assert.StartsWith("https://wa.me/970599000000?text=", link);
        var text = link[(link.IndexOf("text=", StringComparison.Ordinal) + 5)..];
        Assert.DoesNotContain("&", text);
        Assert.DoesNotContain("?", text);
        Assert.Equal("طلب & *جديد*\nسطر?", Uri.UnescapeDataString(text));
    }

    [Theory]
    [InlineData(1, "قطعة واحدة")]
    [InlineData(2, "قطعتان")]
    [InlineData(6, "6 قطع")]
    [InlineData(10, "10 قطع")]
    [InlineData(12, "12 قطعة")]
    public void Pieces_UseArabicNumberAgreement(int count, string expected) =>
        Assert.Equal(expected, WhatsAppMessageBuilder.Pieces(count));
}
