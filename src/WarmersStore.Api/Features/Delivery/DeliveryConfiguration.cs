using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Delivery;

internal sealed class DeliverySettingsConfiguration : IEntityTypeConfiguration<DeliverySettings>
{
    public void Configure(EntityTypeBuilder<DeliverySettings> builder)
    {
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.ComplexProperty(s => s.Message, c => c.ToJson());

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("ck_delivery_settings_singleton", "id = 1");
            t.HasCheckConstraint("ck_delivery_settings_amounts_non_negative",
                "(flat_fee IS NULL OR flat_fee >= 0) AND (free_delivery_threshold IS NULL OR free_delivery_threshold >= 0)");
        });
    }
}

internal sealed class DeliveryAreaConfiguration : IEntityTypeConfiguration<DeliveryArea>
{
    public void Configure(EntityTypeBuilder<DeliveryArea> builder)
    {
        builder.ComplexProperty(a => a.Name, c => c.ToJson());
        builder.ComplexProperty(a => a.Note, c => c.ToJson());

        builder.ToTable(t => t.HasCheckConstraint("ck_delivery_areas_amounts_non_negative",
            "fee >= 0 AND (free_delivery_threshold IS NULL OR free_delivery_threshold >= 0)"));
    }
}
