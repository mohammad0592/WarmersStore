using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.CustomPackages;

internal sealed class CustomPackageSettingsConfiguration : IEntityTypeConfiguration<CustomPackageSettings>
{
    public void Configure(EntityTypeBuilder<CustomPackageSettings> builder)
    {
        builder.Property(s => s.Id).ValueGeneratedNever();

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("ck_custom_package_settings_singleton", "id = 1");
            t.HasCheckConstraint("ck_custom_package_settings_item_range",
                "min_items IS NULL OR max_items IS NULL OR min_items <= max_items");
            t.HasCheckConstraint("ck_custom_package_settings_limits_positive",
                "(min_items IS NULL OR min_items > 0) AND (max_items IS NULL OR max_items > 0) "
                + "AND (min_subtotal IS NULL OR min_subtotal >= 0)");
        });
    }
}

internal sealed class ProductCustomRuleConfiguration : IEntityTypeConfiguration<ProductCustomRule>
{
    public void Configure(EntityTypeBuilder<ProductCustomRule> builder)
    {
        builder.HasKey(r => r.ProductId);

        builder.HasOne(r => r.Product)
            .WithOne()
            .HasForeignKey<ProductCustomRule>(r => r.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("ck_product_custom_rules_range",
            "(min_qty IS NULL OR min_qty > 0) AND (max_qty IS NULL OR max_qty > 0) "
            + "AND (min_qty IS NULL OR max_qty IS NULL OR min_qty <= max_qty)"));
    }
}

internal sealed class CustomDiscountTierConfiguration : IEntityTypeConfiguration<CustomDiscountTier>
{
    public void Configure(EntityTypeBuilder<CustomDiscountTier> builder)
    {
        builder.ToTable(t =>
        {
            t.HasCheckConstraint("ck_custom_discount_tiers_min_items_positive", "min_items > 0");
            t.HasCheckConstraint("ck_custom_discount_tiers_value",
                "value > 0 AND (type <> 'Percent' OR value <= 100)");
        });
    }
}
