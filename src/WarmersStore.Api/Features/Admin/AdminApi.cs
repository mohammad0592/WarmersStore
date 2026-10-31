using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WarmersStore.Api.Common.Hosting;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Admin;

public sealed record LoginRequest(string? Email, string? Password);

public sealed record AdminUserDto(string Email);

/// <summary>Figures for the dashboard, including a set-up checklist for launch.</summary>
public sealed record DashboardDto(
    int ActiveProducts,
    int TotalProducts,
    int ProductsWithoutPrice,
    int ActivePackages,
    bool CustomPackagesEnabled,
    int ActiveDistributors,
    int PendingOrders,
    bool WhatsAppConfigured,
    bool ShowDistributors);

public static class AdminApi
{
    /// <summary>
    /// Everything under /api/admin. Only login is anonymous; every other endpoint, including
    /// those added by later features, goes on the returned group and requires the Admin policy.
    /// </summary>
    public static RouteGroupBuilder MapAdminApi(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin")
            .AddEndpointFilter<RequireAdminHeaderFilter>()
            .WithTags("Admin");

        admin.MapPost("/auth/login", LoginAsync)
            .AllowAnonymous()
            .RequireRateLimiting(RateLimiting.LoginPolicy);

        var secured = admin.MapGroup("").RequireAuthorization(AdminAuthentication.AdminPolicy);

        secured.MapPost("/auth/logout", async (SignInManager<ApplicationUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return TypedResults.NoContent();
        });

        secured.MapGet("/auth/me", async Task<IResult> (ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
        {
            var user = await users.GetUserAsync(principal);
            return user?.Email is { } email ? TypedResults.Ok(new AdminUserDto(email)) : TypedResults.Unauthorized();
        });

        secured.MapGet("/dashboard", GetDashboardAsync);

        return secured;
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        UserManager<ApplicationUser> users,
        SignInManager<ApplicationUser> signIn,
        TimeProvider clock)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrEmpty(request.Password) || request.Password.Length > 256)
        {
            return InvalidCredentials();
        }

        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null || !await users.IsInRoleAsync(user, Roles.Admin))
        {
            // Hash anyway so "no such account" takes as long as "wrong password" (no account probing).
            users.PasswordHasher.VerifyHashedPassword(new ApplicationUser(), TimingHash.Value, request.Password);
            return InvalidCredentials();
        }

        // Counts failures and locks the account after 5 (see AdminAuthentication). A locked account
        // gets the same answer as a wrong password.
        var result = await signIn.PasswordSignInAsync(user, request.Password, isPersistent: false, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            return InvalidCredentials();
        }

        user.LastSignInAt = clock.GetUtcNow();
        await users.UpdateAsync(user);
        return TypedResults.Ok(new AdminUserDto(user.Email!));
    }

    private static readonly Lazy<string> TimingHash =
        new(() => new PasswordHasher<ApplicationUser>().HashPassword(new ApplicationUser(), Guid.NewGuid().ToString()));

    private static IResult InvalidCredentials() =>
        TypedResults.Problem(
            statusCode: StatusCodes.Status401Unauthorized,
            title: "Invalid credentials",
            detail: "البريد الإلكتروني أو كلمة المرور غير صحيحة، أو تم إيقاف الحساب مؤقتاً بعد محاولات كثيرة.");

    private static async Task<IResult> GetDashboardAsync(AppDbContext db, CancellationToken ct)
    {
        var store = await db.StoreSettings.AsNoTracking().SingleAsync(ct);

        return TypedResults.Ok(new DashboardDto(
            ActiveProducts: await db.Products.CountAsync(p => p.IsActive, ct),
            TotalProducts: await db.Products.CountAsync(ct),
            ProductsWithoutPrice: await db.Products.CountAsync(p => p.UnitPrice == null, ct),
            ActivePackages: await db.Packages.CountAsync(p => p.IsActive, ct),
            CustomPackagesEnabled: await db.CustomPackageSettings.Select(s => s.IsEnabled).SingleAsync(ct),
            ActiveDistributors: await db.Distributors.CountAsync(d => d.IsActive && d.City.IsActive, ct),
            PendingOrders: await db.Orders.CountAsync(o => o.Status == OrderStatus.PendingConfirmation, ct),
            WhatsAppConfigured: !string.IsNullOrEmpty(store.WhatsAppNumber),
            ShowDistributors: store.ShowDistributors));
    }
}
