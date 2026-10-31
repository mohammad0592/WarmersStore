namespace WarmersStore.Api.Features.Media;

/// <summary>
/// Turns stored image keys into public URLs. Uploads and serving arrive with admin media
/// management (M9), where this moves behind the IImageStorage abstraction.
/// </summary>
public static class MediaUrls
{
    public static string? For(string? storageKey) =>
        string.IsNullOrEmpty(storageKey) ? null : $"/media/{storageKey}";
}
