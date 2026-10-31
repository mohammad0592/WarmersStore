using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Distributors;

internal sealed class CityConfiguration : IEntityTypeConfiguration<City>
{
    public void Configure(EntityTypeBuilder<City> builder)
    {
        builder.Property(c => c.Slug).HasMaxLength(60);
        builder.HasIndex(c => c.Slug).IsUnique();
        builder.ComplexProperty(c => c.Name, c => c.ToJson());

        // A city that still has distributors can't be deleted; deactivate it or move them first.
        builder.HasMany(c => c.Distributors)
            .WithOne(d => d.City)
            .HasForeignKey(d => d.CityId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class DistributorConfiguration : IEntityTypeConfiguration<Distributor>
{
    public void Configure(EntityTypeBuilder<Distributor> builder)
    {
        builder.Property(d => d.Name).HasMaxLength(120);
        builder.Property(d => d.Address).HasMaxLength(300);
        builder.Property(d => d.PhoneNumber).HasMaxLength(20);
        builder.Property(d => d.GoogleMapsUrl).HasMaxLength(500);
        builder.Property(d => d.ImageKey).HasMaxLength(200);
        builder.Property(d => d.Latitude).HasPrecision(9, 6);
        builder.Property(d => d.Longitude).HasPrecision(9, 6);
        builder.Property(d => d.Version).IsRowVersion();

        builder.HasIndex(d => new { d.IsActive, d.CityId, d.DisplayOrder });

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("ck_distributors_coordinates_pair", "(latitude IS NULL) = (longitude IS NULL)");
            t.HasCheckConstraint("ck_distributors_coordinates_range",
                "latitude IS NULL OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)");
        });
    }
}
