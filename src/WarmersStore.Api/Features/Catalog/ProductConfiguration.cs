using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Catalog;

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.Property(p => p.Slug).HasMaxLength(80);
        builder.HasIndex(p => p.Slug).IsUnique();

        builder.ComplexProperty(p => p.Name, c => c.ToJson());
        builder.ComplexProperty(p => p.ShortDescription, c => c.ToJson());
        builder.ComplexProperty(p => p.Description, c => c.ToJson());
        builder.ComplexProperty(p => p.UsageGuidance, c => c.ToJson());
        builder.ComplexProperty(p => p.SafetyInfo, c => c.ToJson());

        builder.Property(p => p.WidthCm).HasPrecision(5, 1);
        builder.Property(p => p.HeightCm).HasPrecision(5, 1);
        builder.Property(p => p.HeatMinHours).HasPrecision(4, 1);
        builder.Property(p => p.HeatMaxHours).HasPrecision(4, 1);

        builder.Property(p => p.Version).IsRowVersion();

        builder.HasMany(p => p.Images)
            .WithOne()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("ck_products_dimensions_positive", "width_cm > 0 AND height_cm > 0");
            t.HasCheckConstraint("ck_products_heat_range",
                "heat_min_hours IS NULL OR heat_max_hours IS NULL OR heat_min_hours <= heat_max_hours");
            t.HasCheckConstraint("ck_products_pieces_positive",
                "pieces_per_retail_bag > 0 AND pieces_per_selling_unit > 0");
            t.HasCheckConstraint("ck_products_unit_price_non_negative", "unit_price IS NULL OR unit_price >= 0");
        });
    }
}

internal sealed class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> builder)
    {
        builder.Property(i => i.StorageKey).HasMaxLength(200);
        builder.Property(i => i.AltText).HasMaxLength(200);
        builder.HasIndex(i => new { i.ProductId, i.SortOrder });
    }
}
