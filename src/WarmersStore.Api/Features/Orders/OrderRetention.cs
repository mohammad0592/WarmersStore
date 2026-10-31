using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Orders;

public sealed class OrderRetentionOptions
{
    public const string SectionName = "Orders";

    /// <summary>Unconfirmed and cancelled orders (and the personal data in them) are deleted after this.</summary>
    public int UnconfirmedRetentionDays { get; set; } = 90;

    public bool CleanupEnabled { get; set; } = true;
    public TimeSpan CleanupInterval { get; set; } = TimeSpan.FromHours(6);
}

public static class OrderRetention
{
    /// <summary>
    /// Deletes PendingConfirmation and Cancelled orders whose status hasn't changed for the
    /// retention period. Confirmed and Completed orders are business records and are kept.
    /// </summary>
    public static Task<int> DeleteExpiredAsync(AppDbContext db, DateTimeOffset now, int retentionDays, CancellationToken ct)
    {
        var cutoff = now.AddDays(-retentionDays);
        return db.Orders
            .Where(o => (o.Status == OrderStatus.PendingConfirmation || o.Status == OrderStatus.Cancelled)
                && o.StatusChangedAt < cutoff)
            .ExecuteDeleteAsync(ct);
    }
}

/// <summary>Runs the retention clean-up periodically. Safe with one app instance (the v1 setup).</summary>
internal sealed class OrderCleanupService(
    IServiceScopeFactory scopes,
    IOptions<OrderRetentionOptions> options,
    TimeProvider clock,
    ILogger<OrderCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.CleanupInterval, clock);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var deleted = await OrderRetention.DeleteExpiredAsync(
                    db, clock.GetUtcNow(), options.Value.UnconfirmedRetentionDays, stoppingToken);
                if (deleted > 0)
                {
                    logger.LogInformation("Deleted {Count} expired unconfirmed or cancelled orders", deleted);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Order retention clean-up failed; will retry next interval");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
