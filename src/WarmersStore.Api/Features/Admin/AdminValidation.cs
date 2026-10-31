using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Admin;

/// <summary>
/// Collects field errors for admin forms. Keys match the request's camelCase property names so the
/// UI can show each message under its field; messages are Arabic because the admin is.
/// </summary>
internal sealed partial class ValidationErrors
{
    private readonly Dictionary<string, List<string>> _errors = [];

    public bool Any => _errors.Count > 0;

    public void Add(string key, string message)
    {
        if (!_errors.TryGetValue(key, out var list))
        {
            _errors[key] = list = [];
        }
        list.Add(message);
    }

    public IResult ToResult() => TypedResults.ValidationProblem(_errors.ToDictionary(e => e.Key, e => e.Value.ToArray()));

    public string? Required(string key, string? value, int maxLength)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            Add(key, "هذا الحقل مطلوب.");
            return null;
        }
        return MaxLength(key, trimmed, maxLength);
    }

    /// <summary>Trimmed text, or null when empty.</summary>
    public string? Optional(string key, string? value, int maxLength)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : MaxLength(key, trimmed, maxLength);
    }

    public string? Slug(string key, string? value)
    {
        var slug = Required(key, value?.ToLowerInvariant(), 80);
        if (slug is not null && !SlugPattern().IsMatch(slug))
        {
            Add(key, "استخدم أحرفاً إنجليزية صغيرة وأرقاماً وشرطات فقط، مثل hand-warmer.");
        }
        return slug;
    }

    public void Number(string key, decimal? value, decimal min, decimal max, int decimals, bool required)
    {
        if (value is null)
        {
            if (required)
            {
                Add(key, "هذا الحقل مطلوب.");
            }
            return;
        }
        if (value < min || value > max)
        {
            Add(key, $"القيمة يجب أن تكون بين {min} و{max}.");
        }
        else if (decimal.Round(value.Value, decimals) != value)
        {
            Add(key, decimals == 0 ? "استخدم رقماً صحيحاً." : $"استخدم {decimals} منازل عشرية كحد أقصى.");
        }
    }

    private string? MaxLength(string key, string value, int maxLength)
    {
        if (value.Length > maxLength)
        {
            Add(key, $"النص أطول من {maxLength} حرفاً.");
        }
        return value;
    }

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();
}

internal static class AdminResults
{
    public static IResult Conflict(string message) =>
        TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "Conflict", detail: message);

    /// <summary>Optimistic concurrency: someone else saved this record since it was loaded.</summary>
    public static IResult StaleVersion() =>
        Conflict("تم تعديل هذا العنصر من مكان آخر بعد ما فتحته. حدّث الصفحة وأعد التعديل.");

    public static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    /// <summary>Keeps any English translation when the Arabic text is edited.</summary>
    public static LocalizedText? Localized(string? arabic, LocalizedText? existing) =>
        arabic is null ? null : new LocalizedText { Ar = arabic, En = existing?.En };
}
