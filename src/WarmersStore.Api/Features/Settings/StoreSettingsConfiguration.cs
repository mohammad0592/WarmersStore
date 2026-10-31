using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Settings;

internal sealed class StoreSettingsConfiguration : IEntityTypeConfiguration<StoreSettings>
{
    public void Configure(EntityTypeBuilder<StoreSettings> builder)
    {
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.StoreName).HasMaxLength(80);
        builder.Property(s => s.LogoKey).HasMaxLength(200);
        builder.Property(s => s.WhatsAppNumber).HasMaxLength(20);
        builder.Property(s => s.Phone).HasMaxLength(20);
        builder.Property(s => s.Email).HasMaxLength(200);
        builder.Property(s => s.Address).HasMaxLength(300);
        builder.Property(s => s.FacebookUrl).HasMaxLength(300);
        builder.Property(s => s.InstagramUrl).HasMaxLength(300);
        builder.Property(s => s.TikTokUrl).HasMaxLength(300);
        builder.ComplexProperty(s => s.Announcement, c => c.ToJson());

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("ck_store_settings_singleton", "id = 1");
            t.HasCheckConstraint("ck_store_settings_min_order_non_negative",
                "min_order_total IS NULL OR min_order_total >= 0");
        });
    }
}
