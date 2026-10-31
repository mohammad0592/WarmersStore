using Microsoft.AspNetCore.Identity;

namespace WarmersStore.Api.Domain;

/// <summary>
/// A store administrator. There is no public registration; accounts are created by the
/// start-up seeder (from configuration) or, later, by another admin.
/// </summary>
public class ApplicationUser : IdentityUser
{
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LastSignInAt { get; set; }
}

public static class Roles
{
    public const string Admin = "Admin";
}
