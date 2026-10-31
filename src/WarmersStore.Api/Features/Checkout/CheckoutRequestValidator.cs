using System.Text.RegularExpressions;
using WarmersStore.Api.Common;

namespace WarmersStore.Api.Features.Checkout;

/// <summary>A customer's details after trimming and normalization; safe to put in a message.</summary>
public sealed record CustomerInfo(
    string FullName,
    string WhatsAppNumber,
    string Address,
    string? DeliveryInstructions,
    string? Notes);

/// <summary>
/// Structural validation: shapes the UI can never produce (missing ids, duplicate lines, absurd
/// quantities) are rejected with 400. Business rules are the pricing engine's job, not this one's.
/// </summary>
public static partial class CheckoutRequestValidator
{
    public const int MaxLines = 30;
    public const int MaxItemsPerCustomLine = 20;
    public const int MaxQuantity = 999;
    public const int MaxLineIdLength = 64;

    public static Dictionary<string, string[]> ValidateCart(IReadOnlyList<CartLineRequest>? lines)
    {
        var errors = new Dictionary<string, string[]>();
        void Add(string key, string message) => errors[key] = [.. errors.GetValueOrDefault(key, []), message];

        if (lines is null)
        {
            Add("lines", "Lines are required.");
            return errors;
        }

        if (lines.Count > MaxLines)
        {
            Add("lines", $"At most {MaxLines} lines are allowed.");
            return errors;
        }

        var lineIds = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var key = $"lines[{i}]";

            if (line is null)
            {
                Add(key, "Line is required.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(line.LineId) || line.LineId.Length > MaxLineIdLength)
            {
                Add($"{key}.lineId", $"A line id of 1-{MaxLineIdLength} characters is required.");
            }
            else if (!lineIds.Add(line.LineId))
            {
                Add($"{key}.lineId", "Line ids must be unique.");
            }

            switch (line.Kind)
            {
                case CartLineKind.ReadyMade:
                    if (line.PackageId is not > 0)
                    {
                        Add($"{key}.packageId", "A package id is required.");
                    }
                    if (line.Quantity is not (>= 1 and <= MaxQuantity))
                    {
                        Add($"{key}.quantity", $"Quantity must be between 1 and {MaxQuantity}.");
                    }
                    if (line.Items is { Count: > 0 })
                    {
                        Add($"{key}.items", "Ready-made lines can't have items.");
                    }
                    break;

                case CartLineKind.Custom:
                    if (line.PackageId is not null || line.Quantity is not null)
                    {
                        Add(key, "Custom lines take items only.");
                    }
                    ValidateCustomItems(line.Items, key, Add);
                    break;

                default:
                    Add($"{key}.kind", "Kind must be ReadyMade or Custom.");
                    break;
            }
        }

        return errors;
    }

    private static void ValidateCustomItems(IReadOnlyList<CustomItemRequest>? items, string key, Action<string, string> add)
    {
        if (items is not { Count: > 0 })
        {
            add($"{key}.items", "A custom package needs at least one product.");
            return;
        }

        if (items.Count > MaxItemsPerCustomLine)
        {
            add($"{key}.items", $"At most {MaxItemsPerCustomLine} products are allowed.");
            return;
        }

        var productIds = new HashSet<int>();
        for (var j = 0; j < items.Count; j++)
        {
            var item = items[j];
            var itemKey = $"{key}.items[{j}]";

            if (item?.ProductId is not > 0)
            {
                add($"{itemKey}.productId", "A product id is required.");
            }
            else if (!productIds.Add(item.ProductId.Value))
            {
                add($"{itemKey}.productId", "Each product may appear once per custom package.");
            }

            if (item?.Quantity is not (>= 1 and <= MaxQuantity))
            {
                add($"{itemKey}.quantity", $"Quantity must be between 1 and {MaxQuantity}.");
            }
        }
    }

    public static (CustomerInfo? Customer, Dictionary<string, string[]> Errors) ValidateCustomer(CustomerRequest? request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request is null)
        {
            errors["customer"] = ["الرجاء إدخال معلومات التوصيل."];
            return (null, errors);
        }

        var fullName = SingleLine(request.FullName);
        var address = SingleLine(request.Address);
        var instructions = MultiLine(request.DeliveryInstructions);
        var notes = MultiLine(request.Notes);
        var phone = NormalizePhone(request.WhatsAppNumber);

        if (fullName.Length is < 2 or > 100)
        {
            errors["customer.fullName"] = ["الرجاء إدخال الاسم الكامل."];
        }
        if (phone is null)
        {
            errors["customer.whatsAppNumber"] = ["الرجاء إدخال رقم واتساب صحيح مع مقدّمة الدولة، مثل ‎+970599123456."];
        }
        if (address.Length is < 5 or > 300)
        {
            errors["customer.address"] = ["الرجاء إدخال عنوان التوصيل بالتفصيل."];
        }
        if (instructions?.Length > 300)
        {
            errors["customer.deliveryInstructions"] = ["تعليمات التوصيل طويلة جداً (300 حرف كحد أقصى)."];
        }
        if (notes?.Length > 500)
        {
            errors["customer.notes"] = ["الملاحظات طويلة جداً (500 حرف كحد أقصى)."];
        }

        return errors.Count > 0
            ? (null, errors)
            : (new CustomerInfo(fullName, phone!, address, instructions, notes), errors);
    }

    /// <summary>E.164 or null; see <see cref="PhoneNumbers.Normalize"/>.</summary>
    public static string? NormalizePhone(string? input) => PhoneNumbers.Normalize(input);

    private static string SingleLine(string? value) =>
        Whitespace().Replace(StripControl(value ?? "", keepNewlines: false), " ").Trim();

    private static string? MultiLine(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var cleaned = StripControl(value.Replace("\r\n", "\n"), keepNewlines: true);
        cleaned = ExtraBlankLines().Replace(cleaned, "\n\n").Trim();
        return cleaned.Length == 0 ? null : cleaned;
    }

    // Whitespace controls (tabs, line breaks) become spaces so words don't run together; others are dropped.
    private static string StripControl(string value, bool keepNewlines) =>
        string.Concat(value
            .Where(c => !char.IsControl(c) || char.IsWhiteSpace(c))
            .Select(c => c == '\n' && keepNewlines ? c : char.IsControl(c) ? ' ' : c));

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"\n{3,}")]
    private static partial Regex ExtraBlankLines();
}
