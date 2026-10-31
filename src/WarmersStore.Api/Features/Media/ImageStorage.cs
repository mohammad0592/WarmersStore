namespace WarmersStore.Api.Features.Media;

public sealed class MediaOptions
{
    public const string SectionName = "Media";

    /// <summary>
    /// Folder for uploaded images. Relative paths resolve against the app's content root.
    /// In production this is a Railway Volume mount (e.g. /data/media) so files survive deploys.
    /// </summary>
    public string Root { get; set; } = "data/media";

    public long MaxUploadBytes { get; set; } = 5 * 1024 * 1024;
}

/// <summary>
/// Where processed images live. Keys look like "products/3f2a….webp" and are served at /media/{key}.
/// Swapping the local disk for S3/R2 later only means another implementation of this interface.
/// </summary>
public interface IImageStorage
{
    Task<string> SaveAsync(string folder, Stream webpContent, CancellationToken ct);
    Task DeleteAsync(string? key, CancellationToken ct);
}

internal sealed class LocalImageStorage(string root, ILogger<LocalImageStorage> logger) : IImageStorage
{
    public string Root { get; } = root;

    public async Task<string> SaveAsync(string folder, Stream webpContent, CancellationToken ct)
    {
        // Random names: nothing from the uploaded file (name, extension) reaches the file system.
        var key = $"{folder}/{Guid.NewGuid():N}.webp";
        var path = PathFor(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        await using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await webpContent.CopyToAsync(file, ct);
        return key;
    }

    public Task DeleteAsync(string? key, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(key))
        {
            return Task.CompletedTask;
        }

        try
        {
            File.Delete(PathFor(key));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // An orphaned file is harmless; a failed admin action because of it is not.
            logger.LogWarning(ex, "Could not delete image {Key}", key);
        }

        return Task.CompletedTask;
    }

    private string PathFor(string key)
    {
        var full = Path.GetFullPath(Path.Combine(Root, key));
        if (!full.StartsWith(Path.GetFullPath(Root) + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Image key escapes the media root.");
        }
        return full;
    }
}
