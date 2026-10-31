using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Checkout;
using WarmersStore.Api.Features.Orders;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class OrderTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static readonly CustomerRequest Customer =
        new("محمد أحمد", "0097 0599 123 456", "نابلس، شارع فيصل", "اتصل قبل الوصول", "رن الجرس");

    private int _packageId;
    private int _bodyId;

    private Task SeedAsync() => Api.WithDbAsync(async db =>
    {
        var body = await db.Products.SingleAsync(p => p.Slug == "body-warmer");
        body.IsActive = true;
        body.UnitPrice = 6m;
        var package = new ReadyMadePackage
        {
            Slug = "weekly", Name = LocalizedText.Arabic("باقة الأسبوع"), Price = 49m, IsActive = true,
            Items = [new PackageItem { Product = body, Quantity = 5 }],
        };
        db.Packages.Add(package);
        (await db.StoreSettings.SingleAsync()).WhatsAppNumber = "+970599000000";
        await db.SaveChangesAsync();
        (_packageId, _bodyId) = (package.Id, body.Id);
    });

    private SubmitRequest Request(Guid? submissionId = null) => new(
        [
            new("r1", CartLineKind.ReadyMade, _packageId, 2, null),
            new("c1", CartLineKind.Custom, null, null, [new CustomItemRequest(_bodyId, 3)]),
        ],
        null,
        Customer,
        submissionId);

    private async Task<SubmitResultDto> SubmitAsync(SubmitRequest request)
    {
        var response = await Api.PostJsonAsync("/api/checkout/submit", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SubmitResultDto>(ApiFixture.Json))!;
    }

    [Fact]
    public async Task Submit_SavesAPendingOrderWithServerPricedSnapshot()
    {
        await SeedAsync();

        var result = await SubmitAsync(Request());

        await Api.WithDbAsync(async db =>
        {
            var order = await db.Orders.Include(o => o.Items).ThenInclude(i => i.Products).SingleAsync();
            Assert.Equal(result.Reference, order.Reference);
            Assert.Equal(OrderStatus.PendingConfirmation, order.Status);
            Assert.Equal(("محمد أحمد", "+970599123456", "نابلس، شارع فيصل"), (order.CustomerName, order.CustomerWhatsApp, order.Address));
            Assert.Equal(("اتصل قبل الوصول", "رن الجرس"), (order.DeliveryInstructions, order.Notes));
            Assert.Equal((98m + 18m, 0m, 0m, 116m), (order.Subtotal, order.DiscountTotal, order.DeliveryFee, order.Total));
            Assert.Equal(result.Message, order.WhatsAppMessage);

            var lines = order.Items.OrderBy(i => i.Position).ToList();
            Assert.Equal([(OrderItemKind.ReadyMade, "باقة الأسبوع", 2, 98m), (OrderItemKind.Custom, "باقة مخصّصة 1", 1, 18m)],
                lines.Select(i => (i.Kind, i.Name, i.Quantity, i.LineTotal)));
            Assert.Equal(("لاصق تدفئة الجسم", 5), (lines[0].Products.Single().ProductName, lines[0].Products.Single().Quantity));
            Assert.Equal((3, 6m, 18m), (lines[1].Products.Single().Quantity, lines[1].Products.Single().UnitPrice!.Value, lines[1].Products.Single().Subtotal!.Value));
        });
    }

    [Fact]
    public async Task Order_IsASnapshot_UnaffectedByLaterPriceChanges()
    {
        await SeedAsync();
        await SubmitAsync(Request());

        await Api.WithDbAsync(async db =>
        {
            (await db.Packages.SingleAsync()).Price = 70m;
            (await db.Products.SingleAsync(p => p.Id == _bodyId)).Name = LocalizedText.Arabic("اسم جديد");
            await db.SaveChangesAsync();
        });

        await Api.WithDbAsync(async db =>
        {
            var order = await db.Orders.Include(o => o.Items).ThenInclude(i => i.Products).SingleAsync();
            Assert.Equal(116m, order.Total);
            Assert.Equal("لاصق تدفئة الجسم", order.Items.Single(i => i.Kind == OrderItemKind.Custom).Products.Single().ProductName);
        });
    }

    [Fact]
    public async Task Submit_WithTheSameSubmissionId_CreatesOneOrder()
    {
        await SeedAsync();
        var submissionId = Guid.NewGuid();

        var first = await SubmitAsync(Request(submissionId));
        var second = await SubmitAsync(Request(submissionId));
        var other = await SubmitAsync(Request(Guid.NewGuid()));

        Assert.Equal(first.Reference, second.Reference);
        Assert.Equal(first.WhatsAppUrl, second.WhatsAppUrl);
        Assert.NotEqual(first.Reference, other.Reference);
        await Api.WithDbAsync(async db => Assert.Equal(2, await db.Orders.CountAsync()));
    }

    [Fact]
    public async Task RejectedSubmissions_SaveNothing()
    {
        await SeedAsync();
        await Api.WithDbAsync(async db =>
        {
            (await db.StoreSettings.SingleAsync()).MinOrderTotal = 1000m;
            await db.SaveChangesAsync();
        });

        var ruleFailure = await Api.PostJsonAsync("/api/checkout/submit", Request());
        var badCustomer = await Api.PostJsonAsync("/api/checkout/submit", Request() with { Customer = Customer with { FullName = "" } });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, ruleFailure.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, badCustomer.StatusCode);
        await Api.WithDbAsync(async db => Assert.Equal(0, await db.Orders.CountAsync()));
    }

    [Fact]
    public async Task Retention_DeletesOnlyOldUnconfirmedAndCancelledOrders()
    {
        await SeedAsync();
        for (var i = 0; i < 5; i++)
        {
            await SubmitAsync(Request());
        }

        var now = DateTimeOffset.UtcNow;
        await Api.WithDbAsync(async db =>
        {
            var orders = await db.Orders.OrderBy(o => o.Id).ToListAsync();
            (orders[0].Status, orders[0].StatusChangedAt) = (OrderStatus.PendingConfirmation, now.AddDays(-91)); // expired
            (orders[1].Status, orders[1].StatusChangedAt) = (OrderStatus.Cancelled, now.AddDays(-91));           // expired
            (orders[2].Status, orders[2].StatusChangedAt) = (OrderStatus.Confirmed, now.AddDays(-400));          // kept
            (orders[3].Status, orders[3].StatusChangedAt) = (OrderStatus.Completed, now.AddDays(-400));          // kept
            (orders[4].Status, orders[4].StatusChangedAt) = (OrderStatus.PendingConfirmation, now.AddDays(-89)); // kept
            await db.SaveChangesAsync();

            var deleted = await OrderRetention.DeleteExpiredAsync(db, now, retentionDays: 90, CancellationToken.None);

            Assert.Equal(2, deleted);
            Assert.Equal(
                [OrderStatus.Confirmed, OrderStatus.Completed, OrderStatus.PendingConfirmation],
                await db.Orders.AsNoTracking().OrderBy(o => o.Id).Select(o => o.Status).ToListAsync());
            Assert.Equal(0, await db.Database.SqlQueryRaw<int>(
                "SELECT count(*)::int AS \"Value\" FROM order_item WHERE order_id NOT IN (SELECT id FROM orders)").SingleAsync());
        });
    }
}
