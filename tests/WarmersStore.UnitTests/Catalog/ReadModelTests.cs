using System.Globalization;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Distributors;
using WarmersStore.Api.Features.Packages;

namespace WarmersStore.UnitTests.Catalog;

public class ReadModelTests
{
    [Fact]
    public void LocalizedText_FallsBackToArabic()
    {
        var text = new LocalizedText { Ar = "دفا", En = null };

        Assert.Equal("دفا", text.Resolve("ar"));
        Assert.Equal("دفا", text.Resolve("en"));
        Assert.Equal("Dafa", new LocalizedText { Ar = "دفا", En = "Dafa" }.Resolve("en"));
    }

    [Fact]
    public void MapLinks_UseCoordinatesWithInvariantFormatting()
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            // Arabic and many European cultures use other decimal separators.
            CultureInfo.CurrentCulture = new CultureInfo("ar-PS");
            Assert.Equal("https://www.google.com/maps/search/?api=1&query=31.9038,35.2034",
                MapLinks.Build(31.9038m, 35.2034m, "https://maps.app.goo.gl/x"));
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Theory]
    [InlineData("https://maps.app.goo.gl/x", "https://maps.app.goo.gl/x")]
    [InlineData(null, null)]
    [InlineData("  ", null)]
    public void MapLinks_FallBackToStoredUrl(string? url, string? expected) =>
        Assert.Equal(expected, MapLinks.Build(null, null, url));

    [Fact]
    public void RegularPrice_SumsUnitPriceTimesQuantity_OrNullWhenAnyUnpriced()
    {
        PackageItem Item(decimal? price, int qty) => new()
        {
            Quantity = qty,
            Product = new Product
            {
                Slug = "p", Name = LocalizedText.Arabic("p"), UnitPrice = price,
                PiecesPerRetailBag = 1, PiecesPerSellingUnit = 1,
            },
        };

        Assert.Equal(40m, PackageDto.ComputeRegularPrice([Item(6m, 5), Item(5m, 2)]));
        Assert.Null(PackageDto.ComputeRegularPrice([Item(6m, 5), Item(null, 1)]));
    }
}
