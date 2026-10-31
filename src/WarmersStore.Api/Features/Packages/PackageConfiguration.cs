using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Packages;

internal sealed class ReadyMadePackageConfiguration : IEntityTypeConfiguration<ReadyMadePackage>
{
    public void Configure(EntityTypeBuilder<ReadyMadePackage> builder)
    {
        builder.Property(p => p.Slug).HasMaxLength(80);
        // Slugs only need to be unique among packages that haven't been deleted.
        builder.HasIndex(p => p.Slug).IsUnique().HasFilter("deleted_at IS NULL");

        builder.ComplexProperty(p => p.Name, c => c.ToJson());
        builder.ComplexProperty(p => p.Description, c => c.ToJson());
        builder.Property(p => p.ImageKey).HasMaxLength(200);
        builder.Property(p => p.Version).IsRowVersion();

        builder.HasQueryFilter(p => p.DeletedAt == null);

        builder.HasMany(p => p.Items)
            .WithOne()
            .HasForeignKey(i => i.PackageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("ck_ready_made_packages_price_non_negative", "price >= 0"));
    }
}

internal sealed class PackageItemConfiguration : IEntityTypeConfiguration<PackageItem>
{
    public void Configure(EntityTypeBuilder<PackageItem> builder)
    {
        builder.HasKey(i => new { i.PackageId, i.ProductId });

        // A product that is part of a package can't be deleted; deactivate it instead.
        builder.HasOne(i => i.Product)
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.ToTable(t => t.HasCheckConstraint("ck_package_items_quantity_positive", "quantity > 0"));
    }
}
