namespace WarmersStore.Api.Domain;

/// <summary>Timestamps maintained automatically by <c>AppDbContext.SaveChangesAsync</c>.</summary>
public interface IAuditable
{
    DateTimeOffset CreatedAt { get; set; }
    DateTimeOffset UpdatedAt { get; set; }
}
