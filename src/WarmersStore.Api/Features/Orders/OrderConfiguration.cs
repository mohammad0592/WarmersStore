using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Orders;

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.Property(o => o.Reference).HasMaxLength(20);
        builder.HasIndex(o => o.Reference).IsUnique();
        builder.HasIndex(o => o.SubmissionId).IsUnique().HasFilter("submission_id IS NOT NULL");
        // Admin list (newest first, by status) and the retention clean-up.
        builder.HasIndex(o => new { o.Status, o.CreatedAt });
        builder.HasIndex(o => new { o.Status, o.StatusChangedAt });

        builder.Property(o => o.CustomerName).HasMaxLength(100);
        builder.Property(o => o.CustomerWhatsApp).HasMaxLength(20);
        builder.Property(o => o.Address).HasMaxLength(300);
        builder.Property(o => o.DeliveryInstructions).HasMaxLength(300);
        builder.Property(o => o.Notes).HasMaxLength(500);
        builder.Property(o => o.DeliveryAreaName).HasMaxLength(120);
        builder.Property(o => o.Version).IsRowVersion();

        builder.HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("ck_orders_amounts_non_negative",
            "subtotal >= 0 AND discount_total >= 0 AND delivery_fee >= 0 AND total >= 0"));
    }
}

internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.Property(i => i.Name).HasMaxLength(120);
        builder.HasIndex(i => new { i.OrderId, i.Position });

        builder.HasMany(i => i.Products)
            .WithOne()
            .HasForeignKey(p => p.OrderItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("ck_order_items_quantity_positive", "quantity > 0"));
    }
}

internal sealed class OrderItemProductConfiguration : IEntityTypeConfiguration<OrderItemProduct>
{
    public void Configure(EntityTypeBuilder<OrderItemProduct> builder)
    {
        builder.Property(p => p.ProductName).HasMaxLength(120);
    }
}
