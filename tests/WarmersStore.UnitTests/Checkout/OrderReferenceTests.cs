using WarmersStore.Api.Features.Orders;

namespace WarmersStore.UnitTests.Checkout;

public class OrderReferenceTests
{
    [Fact]
    public void Reference_HasDateAndReadableSuffix()
    {
        var reference = OrderReference.Create(new DateTimeOffset(2026, 10, 31, 23, 30, 0, TimeSpan.Zero));

        Assert.Matches(@"^DF-261031-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$", reference);
    }

    [Fact]
    public void Reference_UsesTheUtcDate()
    {
        // 01:30 in Palestine (UTC+2) on 1 Nov is still 31 Oct in UTC.
        var reference = OrderReference.Create(new DateTimeOffset(2026, 11, 1, 1, 30, 0, TimeSpan.FromHours(2)));

        Assert.StartsWith("DF-261031-", reference);
    }

    [Fact]
    public void Alphabet_AvoidsLookalikeCharacters() =>
        Assert.DoesNotContain(OrderReference.Alphabet, c => "01ILO".Contains(c));

    [Fact]
    public void References_AreVaried() =>
        Assert.True(Enumerable.Range(0, 200).Select(_ => OrderReference.Create(DateTimeOffset.UtcNow)).Distinct().Count() > 190);
}
