namespace WarmersStore.Api.Domain;

/// <summary>
/// Customer-facing text stored per language as a JSON column. Arabic is required;
/// English is optional and falls back to Arabic until translations are added.
/// </summary>
public sealed class LocalizedText
{
    public string Ar { get; set; } = "";
    public string? En { get; set; }

    public static LocalizedText Arabic(string ar) => new() { Ar = ar };

    public string Resolve(string language) =>
        language == "en" && !string.IsNullOrWhiteSpace(En) ? En : Ar;
}
