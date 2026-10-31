using Microsoft.AspNetCore.Identity;
using WarmersStore.Api.Domain;

namespace WarmersStore.Api.Features.Admin;

/// <summary>
/// Creates the first administrator from configuration (Admin__Email / Admin__Password, or user
/// secrets in development) when no admin exists yet. Nothing is hard-coded, the password is never
/// logged, and once an admin exists the settings are ignored.
/// </summary>
public static class AdminSeeder
{
    public static async Task SeedAsync(IServiceProvider services, IConfiguration configuration, ILogger logger)
    {
        var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var clock = services.GetRequiredService<TimeProvider>();

        if (!await roles.RoleExistsAsync(Roles.Admin))
        {
            await roles.CreateAsync(new IdentityRole(Roles.Admin));
        }

        if ((await users.GetUsersInRoleAsync(Roles.Admin)).Count > 0)
        {
            return;
        }

        var email = configuration["Admin:Email"]?.Trim();
        var password = configuration["Admin:Password"];
        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
        {
            logger.LogWarning("No admin account exists. Set Admin__Email and Admin__Password to create the first one");
            return;
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            CreatedAt = clock.GetUtcNow(),
        };

        var created = await users.CreateAsync(user, password);
        if (!created.Succeeded)
        {
            // Error codes only (e.g. PasswordTooShort); never the password itself.
            logger.LogError("Could not create the first admin: {Errors}", string.Join(", ", created.Errors.Select(e => e.Code)));
            return;
        }

        await users.AddToRoleAsync(user, Roles.Admin);
        logger.LogInformation("Created the first admin account");
    }
}
