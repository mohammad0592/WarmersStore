using SkiaSharp;
using WarmersStore.Api.Features.Media;

namespace WarmersStore.UnitTests.Media;

public class ImageProcessorTests
{
    // A 3×2 image whose stored pixels are labelled A..F (row by row):
    //   A B C
    //   D E F
    private static readonly SKColor[] Labels =
    [
        new(10, 0, 0), new(20, 0, 0), new(30, 0, 0),
        new(40, 0, 0), new(50, 0, 0), new(60, 0, 0),
    ];

    private static SKBitmap Source()
    {
        var bitmap = new SKBitmap(3, 2, SKColorType.Rgba8888, SKAlphaType.Premul);
        for (var y = 0; y < 2; y++)
        for (var x = 0; x < 3; x++)
        {
            bitmap.SetPixel(x, y, Labels[y * 3 + x]);
        }
        return bitmap;
    }

    private static string Render(SKBitmap bitmap)
    {
        var rows = new List<string>();
        for (var y = 0; y < bitmap.Height; y++)
        {
            var row = "";
            for (var x = 0; x < bitmap.Width; x++)
            {
                row += (char)('A' + Array.IndexOf(Labels, bitmap.GetPixel(x, y)));
            }
            rows.Add(row);
        }
        return string.Join("/", rows);
    }

    // Expected upright results follow the EXIF orientation definitions (1–8).
    [Theory]
    [InlineData(SKEncodedOrigin.TopLeft, "ABC/DEF")]      // 1: as stored
    [InlineData(SKEncodedOrigin.TopRight, "CBA/FED")]     // 2: mirrored
    [InlineData(SKEncodedOrigin.BottomRight, "FED/CBA")]  // 3: rotated 180°
    [InlineData(SKEncodedOrigin.BottomLeft, "DEF/ABC")]   // 4: flipped vertically
    [InlineData(SKEncodedOrigin.LeftTop, "AD/BE/CF")]     // 5: transposed
    [InlineData(SKEncodedOrigin.RightTop, "DA/EB/FC")]    // 6: needs 90° clockwise (portrait phone photo)
    [InlineData(SKEncodedOrigin.RightBottom, "FC/EB/DA")] // 7: transverse
    [InlineData(SKEncodedOrigin.LeftBottom, "CF/BE/AD")]  // 8: needs 90° counter-clockwise
    public void Orient_AppliesExifOrientation(SKEncodedOrigin origin, string expected)
    {
        using var source = Source();
        using var upright = ImageProcessor.Orient(source, origin);

        Assert.Equal(expected, Render(upright));
    }
}
