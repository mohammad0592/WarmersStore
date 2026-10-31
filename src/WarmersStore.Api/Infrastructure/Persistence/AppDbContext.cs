using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options, TimeProvider timeProvider) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<ReadyMadePackage> Packages => Set<ReadyMadePackage>();
    public DbSet<PackageItem> PackageItems => Set<PackageItem>();
    public DbSet<CustomPackageSettings> CustomPackageSettings => Set<CustomPackageSettings>();
    public DbSet<ProductCustomRule> ProductCustomRules => Set<ProductCustomRule>();
    public DbSet<CustomDiscountTier> CustomDiscountTiers => Set<CustomDiscountTier>();
    public DbSet<DeliverySettings> DeliverySettings => Set<DeliverySettings>();
    public DbSet<DeliveryArea> DeliveryAreas => Set<DeliveryArea>();
    public DbSet<StoreSettings> StoreSettings => Set<StoreSettings>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<Distributor> Distributors => Set<Distributor>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Money defaults to numeric(10,2); non-money decimals override this in their configuration.
        configurationBuilder.Properties<decimal>().HavePrecision(10, 2);

        configurationBuilder.Properties<SellingUnit>().HaveConversion<string>().HaveMaxLength(20);
        configurationBuilder.Properties<DiscountType>().HaveConversion<string>().HaveMaxLength(20);
        configurationBuilder.Properties<DeliveryMode>().HaveConversion<string>().HaveMaxLength(20);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = timeProvider.GetUtcNow();

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified))
            {
                continue;
            }

            switch (entry.Entity)
            {
                case IAuditable auditable:
                    if (entry.State == EntityState.Added)
                    {
                        auditable.CreatedAt = now;
                    }
                    auditable.UpdatedAt = now;
                    break;
                case Domain.CustomPackageSettings or Domain.DeliverySettings or Domain.StoreSettings:
                    entry.Property(nameof(Domain.StoreSettings.UpdatedAt)).CurrentValue = now;
                    break;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
