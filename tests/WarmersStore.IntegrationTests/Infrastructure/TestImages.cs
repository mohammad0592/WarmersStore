using System.Net.Http.Headers;
using SkiaSharp;

namespace WarmersStore.IntegrationTests.Infrastructure;

/// <summary>Generates small real images for upload tests.</summary>
public static class TestImages
{
    public static byte[] Encode(int width, int height, SKEncodedImageFormat format)
    {
        using var bitmap = new SKBitmap(width, height);
        bitmap.Erase(new SKColor(234, 88, 12));
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, 90);
        return data.ToArray();
    }

    public static MultipartFormDataContent Form(byte[] bytes, string fileName, string contentType, string? altText = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(file, "file", fileName);
        if (altText is not null)
        {
            form.Add(new StringContent(altText), "altText");
        }
        return form;
    }

    public static (int Width, int Height, SKEncodedImageFormat Format) Inspect(byte[] bytes)
    {
        using var codec = SKCodec.Create(new MemoryStream(bytes));
        return (codec.Info.Width, codec.Info.Height, codec.EncodedFormat);
    }
}
