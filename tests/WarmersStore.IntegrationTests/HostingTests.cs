using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace WarmersStore.IntegrationTests;

public class HostingTests(HostingTests.Factory factory) : IClassFixture<HostingTests.Factory>
{
    public sealed class Factory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            // No database here: liveness and routing must work without one.
            builder.UseSetting("ConnectionStrings:Default", "Host=unused.invalid;Database=unused");
            builder.UseSetting("Database:SeedEssentialData", "false");
        }
    }

    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Health_ReturnsHealthyWithoutDatabase()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task UnknownApiRoute_ReturnsProblemJson404()
    {
        var response = await _client.GetAsync("/api/does-not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Responses_IncludeSecurityHeaders()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
    }
}
