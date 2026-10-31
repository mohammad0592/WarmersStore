using SkiaSharp;

namespace WarmersStore.Api.Features.Media;

public sealed record ImageProcessingResult(Stream? Webp, string? Error);

/// <summary>
/// Turns an untrusted upload into a safe, web-sized WebP (SkiaSharp, MIT-licensed): the content —
/// not the file name or declared type — must decode as JPEG, PNG or WebP; oversized and
/// "decompression bomb" images are refused; the photo is turned upright and re-encoded, which drops
/// all metadata (camera, GPS). No byte of the original file is ever served.
/// </summary>
public static class ImageProcessor
{
    private const int MaxEdge = 1600;
    private const long MaxJpegPixels = 50_000_000; // JPEG decodes at a reduced scale, so large photos are cheap
    private const long MaxOtherPixels = 20_000_000; // PNG/WebP decode at full size

    private const string InvalidImage = "الملف ليس صورة صالحة (المسموح: JPG أو PNG أو WebP).";

    public static async Task<ImageProcessingResult> ProcessAsync(IFormFile? file, long maxBytes, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return new(null, "اختر صورة لرفعها.");
        }
        if (file.Length > maxBytes)
        {
            return new(null, $"حجم الصورة أكبر من {maxBytes / (1024 * 1024)} ميغابايت.");
        }

        var buffer = new MemoryStream((int)file.Length);
        await using (var upload = file.OpenReadStream())
        {
            await upload.CopyToAsync(buffer, ct);
        }
        buffer.Position = 0;

        return Process(buffer);
    }

    private static ImageProcessingResult Process(Stream input)
    {
        using var codec = SKCodec.Create(input, out var status);
        if (codec is null || status != SKCodecResult.Success
            || codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp))
        {
            return new(null, InvalidImage);
        }

        var pixels = (long)codec.Info.Width * codec.Info.Height;
        var limit = codec.EncodedFormat == SKEncodedImageFormat.Jpeg ? MaxJpegPixels : MaxOtherPixels;
        if (codec.Info.Width <= 0 || codec.Info.Height <= 0 || pixels > limit)
        {
            return new(null, "أبعاد الصورة كبيرة جداً.");
        }

        // Decode at up to twice the target size (JPEG supports scaled decoding), then resize smoothly.
        var scale = Math.Min(1f, 2f * MaxEdge / Math.Max(codec.Info.Width, codec.Info.Height));
        var decodedSize = codec.GetScaledDimensions(scale);
        var decodeInfo = new SKImageInfo(decodedSize.Width, decodedSize.Height, SKColorType.Rgba8888, SKAlphaType.Premul);

        using var decoded = new SKBitmap(decodeInfo);
        var result = codec.GetPixels(decodeInfo, decoded.GetPixels());
        if (result is not (SKCodecResult.Success or SKCodecResult.IncompleteInput))
        {
            return new(null, InvalidImage);
        }

        using var upright = Orient(decoded, codec.EncodedOrigin);
        var ratio = Math.Min(1f, (float)MaxEdge / Math.Max(upright.Width, upright.Height));
        var target = new SKImageInfo(
            Math.Max(1, (int)Math.Round(upright.Width * ratio)),
            Math.Max(1, (int)Math.Round(upright.Height * ratio)),
            SKColorType.Rgba8888,
            SKAlphaType.Premul);

        using var resized = ratio < 1f ? upright.Resize(target, new SKSamplingOptions(SKCubicResampler.Mitchell)) : upright.Copy();
        if (resized is null)
        {
            return new(null, InvalidImage);
        }

        using var image = SKImage.FromBitmap(resized);
        using var webp = image.Encode(SKEncodedImageFormat.Webp, 82);
        if (webp is null)
        {
            return new(null, InvalidImage);
        }

        var output = new MemoryStream();
        webp.SaveTo(output);
        output.Position = 0;
        return new(output, null);
    }

    /// <summary>Applies the EXIF orientation so phone photos aren't shown sideways.</summary>
    internal static SKBitmap Orient(SKBitmap source, SKEncodedOrigin origin)
    {
        if (origin == SKEncodedOrigin.TopLeft)
        {
            return source.Copy();
        }

        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var result = new SKBitmap(swap ? source.Height : source.Width, swap ? source.Width : source.Height, source.ColorType, source.AlphaType);
        using var canvas = new SKCanvas(result);
        float w = result.Width, h = result.Height;

        switch (origin)
        {
            case SKEncodedOrigin.TopRight: // mirrored
                canvas.Translate(w, 0);
                canvas.Scale(-1, 1);
                break;
            case SKEncodedOrigin.BottomRight: // 180°
                canvas.RotateDegrees(180, w / 2, h / 2);
                break;
            case SKEncodedOrigin.BottomLeft: // mirrored vertically
                canvas.Translate(0, h);
                canvas.Scale(1, -1);
                break;
            case SKEncodedOrigin.LeftTop: // transposed
                canvas.Scale(-1, 1);
                canvas.RotateDegrees(90);
                break;
            case SKEncodedOrigin.RightTop: // 90° clockwise (typical portrait phone photo)
                canvas.Translate(w, 0);
                canvas.RotateDegrees(90);
                break;
            case SKEncodedOrigin.RightBottom: // transverse
                canvas.Translate(w, h);
                canvas.Scale(-1, 1);
                canvas.RotateDegrees(270);
                break;
            case SKEncodedOrigin.LeftBottom: // 90° counter-clockwise
                canvas.Translate(0, h);
                canvas.RotateDegrees(270);
                break;
        }

        using var sourceImage = SKImage.FromBitmap(source);
        canvas.DrawImage(sourceImage, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest));
        return result;
    }
}
