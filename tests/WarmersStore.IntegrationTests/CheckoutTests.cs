using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Checkout;
using WarmersStore.Api.Infrastructure.Persistence;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class CheckoutTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static readonly CustomerRequest ValidCustomer =
        new("محمد أحمد", "+970 599 123 456", "نابلس، شارع فيصل، بناية 4", null, "رن الجرس");

    private int _packageId;
    private int _bodyId;
    private int _handId;

    /// <summary>Two priced products and one 49 ₪ package; WhatsApp number configured.</summary>
    private Task SeedStoreAsync(string? whatsApp = "+970599000000") => Api.WithDbAsync(async db =>
    {
        var body = await Activate(db, "body-warmer", 6m);
        var hand = await Activate(db, "hand-warmer", 5m);
        var package = new ReadyMadePackage
        {
            Slug = "weekly",
            Name = LocalizedText.Arabic("باقة الأسبوع"),
            Price = 49m,
            IsActive = true,
            Items = [new PackageItem { Product = body, Quantity = 5 }, new PackageItem { Product = hand, Quantity = 2 }],
        };
        db.Packages.Add(package);
        (await db.StoreSettings.SingleAsync()).WhatsAppNumber = whatsApp;
        await db.SaveChangesAsync();

        (_packageId, _bodyId, _handId) = (package.Id, body.Id, hand.Id);
    });

    private CartLineRequest ReadyMade(int quantity, string lineId = "r1") =>
        new(lineId, CartLineKind.ReadyMade, _packageId, quantity, null);

    private CartLineRequest Custom(string lineId, int bodyQty, int handQty) =>
        new(lineId, CartLineKind.Custom, null, null, [new(_bodyId, bodyQty), new(_handId, handQty)]);

    private async Task<QuoteDto> QuoteAsync(params CartLineRequest[] lines)
    {
        var response = await Api.PostJsonAsync("/api/checkout/quote", new QuoteRequest(lines, null));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<QuoteDto>(ApiFixture.Json))!;
    }

    // ---- Quote ----

    [Fact]
    public async Task Quote_PricesReadyMadeAndCustomLinesFromDatabase()
    {
        await SeedStoreAsync();

        var quote = await QuoteAsync(ReadyMade(2), Custom("c1", 3, 1));

        Assert.True(quote.IsValid);
        Assert.Equal(98m + 18m + 5m, quote.Total);
        Assert.Equal(["باقة الأسبوع", "باقة مخصّصة 1"], quote.Lines.Select(l => l.Name));
    }

    [Fact]
    public async Task Quote_IgnoresPricesSentByTheClient()
    {
        await SeedStoreAsync();

        // A tampered cart: invented price fields on every level. None of them exist in the contract.
        var json = $$"""
            {
              "lines": [
                { "lineId": "r1", "kind": "ReadyMade", "packageId": {{_packageId}}, "quantity": 1,
                  "price": 0.01, "unitPrice": 0.01, "lineTotal": 0.01 },
                { "lineId": "c1", "kind": "Custom",
                  "items": [ { "productId": {{_bodyId}}, "quantity": 2, "unitPrice": 0.01 } ] }
              ],
              "total": 0.01, "subtotal": 0.01
            }
            """;
        var response = await Api.Client.PostAsync("/api/checkout/quote", new StringContent(json, Encoding.UTF8, "application/json"));
        var quote = (await response.Content.ReadFromJsonAsync<QuoteDto>(ApiFixture.Json))!;

        Assert.Equal(49m + 12m, quote.Total);
    }

    [Fact]
    public async Task Quote_ReflectsPriceChangesImmediately()
    {
        await SeedStoreAsync();
        Assert.Equal(49m, (await QuoteAsync(ReadyMade(1))).Total);

        await Api.WithDbAsync(async db =>
        {
            (await db.Packages.SingleAsync()).Price = 55m;
            await db.SaveChangesAsync();
        });

        Assert.Equal(55m, (await QuoteAsync(ReadyMade(1))).Total);
    }

    [Fact]
    public async Task Quote_DisabledOrDeletedPackage_IsReportedOnItsLine()
    {
        await SeedStoreAsync();
        await Api.WithDbAsync(async db =>
        {
            (await db.Packages.SingleAsync()).DeletedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        });

        var quote = await QuoteAsync(ReadyMade(1, "gone"), Custom("c1", 1, 1));

        Assert.False(quote.IsValid);
        Assert.Equal("package_not_found", Assert.Single(quote.Lines.Single(l => l.LineId == "gone").Errors).Code);
        Assert.Empty(quote.Lines.Single(l => l.LineId == "c1").Errors);
    }

    [Fact]
    public async Task Quote_EnforcesConfiguredCustomRules()
    {
        await SeedStoreAsync();
        await Api.WithDbAsync(async db =>
        {
            var settings = await db.CustomPackageSettings.SingleAsync();
            settings.MaxItems = 3;
            settings.MaxQuantityPerProduct = 2;
            await db.SaveChangesAsync();
        });

        var line = (await QuoteAsync(Custom("c1", 3, 1))).Lines.Single();

        Assert.Equal(["product_max_qty", "custom_max_items"], line.Errors.Select(e => e.Code));
    }

    [Theory]
    [InlineData("""{ "lines": [ { "lineId": "a", "kind": "ReadyMade", "packageId": 1, "quantity": -5 } ] }""")]
    [InlineData("""{ "lines": [ { "lineId": "a", "kind": "Bogus", "packageId": 1, "quantity": 1 } ] }""")]
    [InlineData("""{ "lines": [ { "lineId": "a", "kind": "Custom", "items": [ { "productId": 1, "quantity": 1 }, { "productId": 1, "quantity": 1 } ] } ] }""")]
    [InlineData("""{ "lines": null }""")]
    [InlineData("""not json""")]
    public async Task Quote_MalformedRequests_Return400ProblemDetails(string body)
    {
        var response = await Api.Client.PostAsync("/api/checkout/quote", new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    // ---- Submit ----

    [Fact]
    public async Task Submit_Valid_ReturnsMessageAndWhatsAppLinkToTheStoreNumber()
    {
        await SeedStoreAsync(whatsApp: "+970599000000");

        var response = await Api.PostJsonAsync("/api/checkout/submit",
            new SubmitRequest([ReadyMade(1), Custom("c1", 2, 1)], null, ValidCustomer));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = (await response.Content.ReadFromJsonAsync<SubmitResultDto>(ApiFixture.Json))!;
        Assert.Matches(@"^DF-\d{6}-[2-9A-HJKMNP-Z]{4}$", result.Reference);
        Assert.Contains($"رقم الطلب: {result.Reference}", result.Message);
        Assert.Equal(49m + 12m + 5m, result.Quote.Total);
        Assert.StartsWith("https://wa.me/970599000000?text=", result.WhatsAppUrl);
        Assert.Contains("*الاسم:* محمد أحمد", result.Message);
        Assert.Contains("+970599123456", result.Message); // normalized customer number
        Assert.Equal(result.Message, Uri.UnescapeDataString(result.WhatsAppUrl.Split("text=")[1]));
    }

    [Fact]
    public async Task Submit_WithoutConfiguredWhatsAppNumber_IsUnavailable()
    {
        await SeedStoreAsync(whatsApp: null);

        var response = await Api.PostJsonAsync("/api/checkout/submit", new SubmitRequest([ReadyMade(1)], null, ValidCustomer));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var quote = (await response.Content.ReadFromJsonAsync<QuoteDto>(ApiFixture.Json))!;
        Assert.Contains(quote.Errors, e => e.Code == "ordering_unavailable");
    }

    [Fact]
    public async Task Submit_BusinessRuleViolation_Returns422WithTheQuote()
    {
        await SeedStoreAsync();
        await Api.WithDbAsync(async db =>
        {
            (await db.StoreSettings.SingleAsync()).MinOrderTotal = 100m;
            await db.SaveChangesAsync();
        });

        var response = await Api.PostJsonAsync("/api/checkout/submit", new SubmitRequest([ReadyMade(1)], null, ValidCustomer));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var quote = (await response.Content.ReadFromJsonAsync<QuoteDto>(ApiFixture.Json))!;
        Assert.Equal("min_order_total", Assert.Single(quote.Errors).Code);
    }

    [Fact]
    public async Task Submit_PerAreaDelivery_RequiresAnArea()
    {
        await SeedStoreAsync();
        int areaId = 0;
        await Api.WithDbAsync(async db =>
        {
            (await db.DeliverySettings.SingleAsync()).Mode = DeliveryMode.PerArea;
            var area = new DeliveryArea { Name = LocalizedText.Arabic("نابلس"), Fee = 15m, IsActive = true };
            db.DeliveryAreas.Add(area);
            await db.SaveChangesAsync();
            areaId = area.Id;
        });

        var withoutArea = await Api.PostJsonAsync("/api/checkout/submit", new SubmitRequest([ReadyMade(1)], null, ValidCustomer));
        var withArea = await Api.PostJsonAsync("/api/checkout/submit", new SubmitRequest([ReadyMade(1)], areaId, ValidCustomer));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, withoutArea.StatusCode);
        Assert.Equal(HttpStatusCode.OK, withArea.StatusCode);
        var result = (await withArea.Content.ReadFromJsonAsync<SubmitResultDto>(ApiFixture.Json))!;
        Assert.Equal(64m, result.Quote.Total);
        Assert.Contains("*منطقة التوصيل:* نابلس", result.Message);
    }

    [Fact]
    public async Task Submit_InvalidCustomer_Returns400WithFieldErrors()
    {
        await SeedStoreAsync();

        var response = await Api.PostJsonAsync("/api/checkout/submit",
            new SubmitRequest([ReadyMade(1)], null, ValidCustomer with { WhatsAppNumber = "0599123456", FullName = "" }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
        Assert.Contains("customer.whatsAppNumber", problem.Errors.Keys);
        Assert.Contains("customer.fullName", problem.Errors.Keys);
    }

    [Fact]
    public async Task Submit_IsRateLimitedPerClient()
    {
        await SeedStoreAsync();
        var client = Api.CreateClientWithSettings(("RateLimiting:SubmitPerMinute", "2"));
        var body = new SubmitRequest([ReadyMade(1)], null, ValidCustomer);

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 3; i++)
        {
            statuses.Add((await client.PostAsJsonAsync("/api/checkout/submit", body, ApiFixture.Json)).StatusCode);
        }

        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.TooManyRequests], statuses);
    }

    private static async Task<Product> Activate(AppDbContext db, string slug, decimal price)
    {
        var product = await db.Products.SingleAsync(p => p.Slug == slug);
        product.IsActive = true;
        product.UnitPrice = price;
        return product;
    }
}
