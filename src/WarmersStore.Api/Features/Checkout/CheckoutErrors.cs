using System.Globalization;

namespace WarmersStore.Api.Features.Checkout;

/// <summary>
/// Business-rule errors returned with a quote. Codes are stable for the frontend; messages are
/// ready-to-show Arabic so the WhatsApp flow and the UI say the same thing.
/// </summary>
public static class CheckoutErrors
{
    public static CheckoutError PackageNotFound() =>
        new("package_not_found", "هذه الباقة لم تعد متوفرة.");

    public static CheckoutError PackageUnavailable() =>
        new("package_unavailable", "هذه الباقة غير متوفرة حالياً.");

    public static CheckoutError CustomDisabled() =>
        new("custom_disabled", "تصميم الباقات المخصّصة غير متاح حالياً.");

    public static CheckoutError ProductNotFound(int productId) =>
        new("product_not_found", "أحد المنتجات في الباقة لم يعد متوفراً.", Params(("productId", productId)));

    public static CheckoutError ProductUnavailable(int productId, string name) =>
        new("product_unavailable", $"«{name}» غير متوفر حالياً للباقات المخصّصة.",
            Params(("productId", productId), ("name", name)));

    public static CheckoutError ProductMinQuantity(int productId, string name, int min) =>
        new("product_min_qty", $"الحد الأدنى من «{name}» هو {min}.",
            Params(("productId", productId), ("name", name), ("min", min)));

    public static CheckoutError ProductMaxQuantity(int productId, string name, int max) =>
        new("product_max_qty", $"الحد الأقصى من «{name}» هو {max}.",
            Params(("productId", productId), ("name", name), ("max", max)));

    public static CheckoutError CustomMinItems(int min) =>
        new("custom_min_items", $"يجب ألّا يقل عدد الوحدات في الباقة عن {min}.", Params(("min", min)));

    public static CheckoutError CustomMaxItems(int max) =>
        new("custom_max_items", $"يجب ألّا يزيد عدد الوحدات في الباقة عن {max}.", Params(("max", max)));

    public static CheckoutError CustomMinSubtotal(decimal min) =>
        new("custom_min_subtotal", $"يجب ألّا يقل مجموع الباقة المخصّصة عن {Money(min)}.", Params(("min", min)));

    public static CheckoutError CartEmpty() =>
        new("cart_empty", "السلة فارغة.");

    public static CheckoutError MinOrderTotal(decimal min) =>
        new("min_order_total", $"الحد الأدنى للطلب {Money(min)}.", Params(("min", min)));

    public static CheckoutError DeliveryAreaRequired() =>
        new("delivery_area_required", "اختر منطقة التوصيل.");

    public static CheckoutError DeliveryAreaInvalid() =>
        new("delivery_area_invalid", "منطقة التوصيل المختارة غير متوفرة.");

    public static CheckoutError OrderingUnavailable() =>
        new("ordering_unavailable", "استقبال الطلبات غير متاح حالياً، حاول لاحقاً.");

    /// <summary>"49 ₪" for whole amounts, "12.50 ₪" otherwise.</summary>
    public static string Money(decimal amount) =>
        (amount == decimal.Truncate(amount)
            ? amount.ToString("0", CultureInfo.InvariantCulture)
            : amount.ToString("0.00", CultureInfo.InvariantCulture)) + " ₪";

    private static Dictionary<string, object> Params(params (string Key, object Value)[] values) =>
        values.ToDictionary(v => v.Key, v => v.Value);
}
