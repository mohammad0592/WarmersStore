using System.Text;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Checkout;

/// <summary>
/// Builds the Arabic order message from a validated quote, and the wa.me link that opens it.
/// Opening the link proves nothing: the customer still has to press Send in WhatsApp.
/// </summary>
public static class WhatsAppMessageBuilder
{
    public static string Build(string storeName, QuoteDto quote, CustomerInfo customer, string? reference)
    {
        var sb = new StringBuilder();

        sb.AppendLine($"*طلب جديد من {storeName}*");
        if (reference is not null)
        {
            sb.AppendLine($"رقم الطلب: {reference}");
        }
        sb.AppendLine();

        sb.AppendLine($"*الاسم:* {customer.FullName}");
        sb.AppendLine($"*رقم الواتساب:* {Ltr(customer.WhatsAppNumber)}");
        sb.AppendLine($"*العنوان:* {customer.Address}");
        if (quote.Delivery.AreaName is { } area)
        {
            sb.AppendLine($"*منطقة التوصيل:* {area}");
        }
        if (customer.DeliveryInstructions is { } instructions)
        {
            sb.AppendLine($"*تعليمات التوصيل:* {instructions}");
        }

        var readyMade = quote.Lines.Where(l => l.Kind == CartLineKind.ReadyMade).ToList();
        if (readyMade.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("*الباقات الجاهزة*");
            foreach (var line in readyMade)
            {
                sb.AppendLine($"• {line.Name} × {line.Quantity} = {CheckoutErrors.Money(line.LineTotal)}");
                sb.AppendLine($"   ({string.Join("، ", line.Items.Select(i => $"{i.ProductName} × {i.Quantity}"))})");
            }
        }

        foreach (var line in quote.Lines.Where(l => l.Kind == CartLineKind.Custom))
        {
            sb.AppendLine();
            sb.AppendLine($"*{line.Name}*");
            foreach (var item in line.Items)
            {
                sb.AppendLine($"• {item.ProductName} × {item.Quantity}{UnitSuffix(item)} = {CheckoutErrors.Money(item.Subtotal ?? 0)}");
            }
            if (line.Discount > 0)
            {
                sb.AppendLine($"خصم: -{CheckoutErrors.Money(line.Discount)}");
            }
            sb.AppendLine($"مجموع الباقة: {CheckoutErrors.Money(line.LineTotal)}");
        }

        sb.AppendLine();
        sb.AppendLine($"المجموع: {CheckoutErrors.Money(quote.Subtotal)}");
        sb.AppendLine(quote.Delivery switch
        {
            { Mode: DeliveryMode.None } => "التوصيل: يتم تأكيده عند التواصل",
            { IsFree: true } => "التوصيل: مجاني",
            { Fee: { } fee } => $"التوصيل: {CheckoutErrors.Money(fee)}",
            _ => "التوصيل: يتم تأكيده عند التواصل",
        });
        sb.AppendLine($"*الإجمالي: {CheckoutErrors.Money(quote.Total)}*");
        sb.AppendLine("طريقة الدفع: الدفع نقداً عند الاستلام");

        if (customer.Notes is { } notes)
        {
            sb.AppendLine();
            sb.AppendLine($"*ملاحظات:* {notes}");
        }

        return sb.ToString().TrimEnd();
    }

    /// <summary>https://wa.me/{digits}?text={message}; the number must be E.164.</summary>
    public static string Link(string businessNumber, string message) =>
        $"https://wa.me/{businessNumber.TrimStart('+')}?text={Uri.EscapeDataString(message)}";

    /// <summary>Spells out pieces when a unit holds more than one, e.g. " (6 قطع)".</summary>
    private static string UnitSuffix(QuoteItemDto item) =>
        item.Pieces > item.Quantity ? $" ({Pieces(item.Pieces)})" : "";

    public static string Pieces(int count) => count switch
    {
        1 => "قطعة واحدة",
        2 => "قطعتان",
        >= 3 and <= 10 => $"{count} قطع",
        _ => $"{count} قطعة",
    };

    // Keeps "+970…" from being reordered inside right-to-left text.
    private static string Ltr(string value) => $"⁦{value}⁩";
}
