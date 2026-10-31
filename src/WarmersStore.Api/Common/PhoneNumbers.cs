using System.Text;
using System.Text.RegularExpressions;

namespace WarmersStore.Api.Common;

/// <summary>Phone number normalization shared by checkout (customers) and distributors (shops).</summary>
public static partial class PhoneNumbers
{
    /// <summary>
    /// Accepts what people actually type: spaces, dashes, brackets, a leading 00 and Arabic-Indic
    /// digits. Returns E.164 (+ and 8-15 digits) or null.
    /// </summary>
    public static string? Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        var builder = new StringBuilder(input.Length);
        foreach (var c in input.Trim())
        {
            if (c is >= '٠' and <= '٩')
            {
                builder.Append((char)('0' + (c - '٠')));
            }
            else if (c is >= '۰' and <= '۹')
            {
                builder.Append((char)('0' + (c - '۰')));
            }
            else if (char.IsAsciiDigit(c) || c == '+')
            {
                builder.Append(c);
            }
            else if (c is not (' ' or '-' or '(' or ')' or '.' or '‎' or '‏'))
            {
                return null;
            }
        }

        var normalized = builder.ToString();
        if (normalized.StartsWith("00", StringComparison.Ordinal))
        {
            normalized = "+" + normalized[2..];
        }

        return E164().IsMatch(normalized) ? normalized : null;
    }

    /// <summary>
    /// Like <see cref="Normalize"/>, but a local number written with a single leading 0
    /// ("059 912 3456", "09-234-5678") is read as belonging to <paramref name="defaultCountryCode"/>.
    /// </summary>
    public static string? NormalizeWithDefaultCountry(string? input, string defaultCountryCode)
    {
        var normalized = Normalize(input);
        if (normalized is not null || string.IsNullOrWhiteSpace(input))
        {
            return normalized;
        }

        var trimmed = input.Trim();
        var local = trimmed.TrimStart('0', '٠', '۰');
        var leadingZeros = trimmed.Length - local.Length;
        return leadingZeros == 1 ? Normalize(defaultCountryCode + local) : null;
    }

    [GeneratedRegex(@"^\+[1-9]\d{7,14}$")]
    private static partial Regex E164();
}
