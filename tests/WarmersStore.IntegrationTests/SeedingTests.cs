using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using WarmersStore.Api.Infrastructure.Persistence.Seeding;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class SeedingTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    [Fact]
    public async Task EssentialSeed_IsIdempotent_AndLeavesProductsUnpriced()
    {
        await Api.WithDbAsync(async db =>
        {
            await EssentialDataSeeder.SeedAsync(db, NullLogger.Instance);

            Assert.Equal(4, await db.Products.CountAsync());
            Assert.Equal(1, await db.StoreSettings.CountAsync());
            Assert.Equal(1, await db.CustomPackageSettings.CountAsync());
            Assert.Equal(1, await db.DeliverySettings.CountAsync());
            Assert.True(await db.Products.AllAsync(p => !p.IsActive && p.UnitPrice == null));
        });
    }

    [Fact]
    public async Task SampleSeed_IsIdempotent_AndEveryDistributorIsMarkedAsSample()
    {
        await Api.WithDbAsync(async db =>
        {
            await SampleDataSeeder.SeedAsync(db, NullLogger.Instance);
            await SampleDataSeeder.SeedAsync(db, NullLogger.Instance);

            Assert.Equal(3, await db.Packages.CountAsync());
            var distributors = await db.Distributors.ToListAsync();
            Assert.NotEmpty(distributors);
            Assert.All(distributors, d =>
            {
                Assert.Contains(SampleDataSeeder.SampleMarker, d.Name);
                Assert.Contains(SampleDataSeeder.SampleMarker, d.Address);
            });
        });
    }

    [Fact]
    public async Task Timestamps_AreSetOnInsertAndUpdate()
    {
        await Api.WithDbAsync(async db =>
        {
            var product = await db.Products.FirstAsync();
            var created = product.CreatedAt;
            Assert.NotEqual(default, created);

            product.DisplayOrder += 10;
            await db.SaveChangesAsync();

            Assert.Equal(created, product.CreatedAt);
            Assert.True(product.UpdatedAt >= created);
        });
    }
}
