using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WarmersStore.Api.Domain;
using WarmersStore.Api.Features.Admin;
using WarmersStore.IntegrationTests.Infrastructure;

namespace WarmersStore.IntegrationTests;

public class AdminAuthTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private HttpClient AnonymousClient()
    {
        var client = Api.NewClient();
        client.DefaultRequestHeaders.Add("X-Dafa-Admin", "1");
        return client;
    }

    private static Task<HttpResponseMessage> Login(HttpClient client, string email, string password) =>
        client.PostAsJsonAsync("/api/admin/auth/login", new { email, password });

    [Fact]
    public void EveryAdminEndpointExceptLogin_RequiresTheAdminPolicy()
    {
        // Guards future features too: any endpoint mapped under /api/admin without the policy fails here.
        var endpoints = Api.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText?.StartsWith("/api/admin", StringComparison.Ordinal) == true)
            .ToList();

        Assert.NotEmpty(endpoints);
        foreach (var endpoint in endpoints.Where(e => e.RoutePattern.RawText != "/api/admin/auth/login"))
        {
            var policies = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Select(a => a.Policy);
            Assert.True(policies.Contains(AdminAuthentication.AdminPolicy), $"{endpoint.RoutePattern.RawText} is not protected");
            Assert.Null(endpoint.Metadata.GetMetadata<IAllowAnonymous>());
        }
    }

    [Theory]
    [InlineData("GET", "/api/admin/auth/me")]
    [InlineData("GET", "/api/admin/dashboard")]
    [InlineData("POST", "/api/admin/auth/logout")]
    public async Task AnonymousRequests_Get401(string method, string url)
    {
        var response = await AnonymousClient().SendAsync(new HttpRequestMessage(new HttpMethod(method), url));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_SetsAHardenedCookie_AndUnlocksAdminEndpoints()
    {
        var client = AnonymousClient();

        var response = await Login(client, ApiFixture.AdminEmail, ApiFixture.AdminPassword);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("dafa_admin=", StringComparison.Ordinal));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("expires=", cookie, StringComparison.OrdinalIgnoreCase); // session cookie

        var me = await client.GetFromJsonAsync<AdminUserDto>("/api/admin/auth/me");
        Assert.Equal(ApiFixture.AdminEmail, me!.Email);
    }

    [Fact]
    public async Task WrongPasswordAndUnknownAccount_GetTheSameAnswer()
    {
        var wrongPassword = await Login(AnonymousClient(), ApiFixture.AdminEmail, "not-the-password");
        var unknownAccount = await Login(AnonymousClient(), "nobody@test.local", "whatever-password");

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownAccount.StatusCode);
        Assert.Equal(await Detail(wrongPassword), await Detail(unknownAccount));
    }

    [Fact]
    public async Task FiveFailures_LockTheAccount_EvenForTheRightPassword()
    {
        for (var i = 0; i < 5; i++)
        {
            await Login(AnonymousClient(), ApiFixture.AdminEmail, "wrong-password");
        }

        var response = await Login(AnonymousClient(), ApiFixture.AdminEmail, ApiFixture.AdminPassword);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await Api.WithDbAsync(async db =>
            Assert.True((await db.Users.SingleAsync(u => u.Email == ApiFixture.AdminEmail)).LockoutEnd > DateTimeOffset.UtcNow));
    }

    [Fact]
    public async Task UserWithoutAdminRole_CannotSignIn_OrUseAdminEndpoints()
    {
        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            if (await users.FindByEmailAsync("staff@test.local") is null)
            {
                Assert.True((await users.CreateAsync(
                    new ApplicationUser { UserName = "staff@test.local", Email = "staff@test.local" }, "staff-password-123")).Succeeded);
            }
        }

        var response = await Login(AnonymousClient(), "staff@test.local", "staff-password-123");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task StateChangingRequests_WithoutTheAdminHeader_AreRejected()
    {
        var client = Api.NewClient(); // no X-Dafa-Admin header

        var response = await Login(client, ApiFixture.AdminEmail, ApiFixture.AdminPassword);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Logout_EndsTheSession()
    {
        var client = await Api.AdminClientAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/admin/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/admin/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Seeder_CreatedExactlyOneAdmin_FromConfiguration()
    {
        await using var scope = Api.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var config = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();

        // Running it again (as on every start-up) must not create another account.
        await AdminSeeder.SeedAsync(scope.ServiceProvider, config, Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance);

        var admins = await users.GetUsersInRoleAsync(Roles.Admin);
        Assert.Equal(ApiFixture.AdminEmail, Assert.Single(admins).Email);
    }

    [Fact]
    public async Task Dashboard_ReportsCountsAndSetupChecklist()
    {
        await Api.WithDbAsync(async db =>
        {
            var body = await db.Products.SingleAsync(p => p.Slug == "body-warmer");
            body.IsActive = true;
            body.UnitPrice = 6m;
            await db.SaveChangesAsync();
        });
        var client = await Api.AdminClientAsync();

        var dashboard = await client.GetFromJsonAsync<DashboardDto>("/api/admin/dashboard");

        Assert.Equal(new DashboardDto(
            ActiveProducts: 1, TotalProducts: 4, ProductsWithoutPrice: 3, ActivePackages: 0, CustomPackagesEnabled: true,
            ActiveDistributors: 0, PendingOrders: 0, WhatsAppConfigured: false, ShowDistributors: false), dashboard);
    }

    private static async Task<string?> Detail(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>())?.Detail;
}
