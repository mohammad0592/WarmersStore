using Microsoft.AspNetCore.Mvc;
using WarmersStore.Api.Common.Hosting;
using WarmersStore.Api.Infrastructure.Persistence;

namespace WarmersStore.Api.Features.Checkout;

/// <summary>
/// Server-side pricing for the cart (quote) and the WhatsApp hand-off (submit).
/// Prices always come from the database; nothing the client sends is trusted.
/// </summary>
public static class CheckoutEndpoints
{
    private const long MaxBodyBytes = 32 * 1024;

    public static RouteGroupBuilder MapCheckoutEndpoints(this RouteGroupBuilder api)
    {
        var checkout = api.MapGroup("/checkout")
            .WithTags("Checkout")
            .WithMetadata(new RequestSizeLimitAttribute(MaxBodyBytes));

        checkout.MapPost("/quote", async Task<IResult> (QuoteRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var cartErrors = CheckoutRequestValidator.ValidateCart(request.Lines);
            if (cartErrors.Count > 0)
            {
                return TypedResults.ValidationProblem(cartErrors);
            }

            var context = await PricingContext.LoadAsync(db, request.Lines!, request.DeliveryAreaId, ct);
            return TypedResults.Ok(PricingEngine.Price(request.Lines!, request.DeliveryAreaId, context, forSubmission: false));
        })
        .RequireRateLimiting(RateLimiting.QuotePolicy);

        checkout.MapPost("/submit", async Task<IResult> (SubmitRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var errors = CheckoutRequestValidator.ValidateCart(request.Lines);
            var (customer, customerErrors) = CheckoutRequestValidator.ValidateCustomer(request.Customer);
            foreach (var (key, messages) in customerErrors)
            {
                errors[key] = messages;
            }
            if (errors.Count > 0)
            {
                return TypedResults.ValidationProblem(errors);
            }

            var context = await PricingContext.LoadAsync(db, request.Lines!, request.DeliveryAreaId, ct);
            var quote = PricingEngine.Price(request.Lines!, request.DeliveryAreaId, context, forSubmission: true);

            if (context.Store.WhatsAppNumber is not { Length: > 0 } businessNumber)
            {
                quote = quote with { Errors = [.. quote.Errors, CheckoutErrors.OrderingUnavailable()], IsValid = false };
            }

            if (!quote.IsValid)
            {
                return TypedResults.UnprocessableEntity(quote);
            }

            var message = WhatsAppMessageBuilder.Build(context.Store.StoreName, quote, customer!, reference: null);
            return TypedResults.Ok(new SubmitResultDto(
                Reference: null,
                quote,
                message,
                WhatsAppMessageBuilder.Link(context.Store.WhatsAppNumber!, message)));
        })
        .RequireRateLimiting(RateLimiting.SubmitPolicy);

        return api;
    }
}
