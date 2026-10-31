using Microsoft.AspNetCore.Mvc;
using WarmersStore.Api.Common.Hosting;
using WarmersStore.Api.Features.Orders;
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

        checkout.MapPost("/submit", async Task<IResult> (
            SubmitRequest request, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
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

            // Saved before the customer is sent to WhatsApp, as PendingConfirmation: opening
            // WhatsApp doesn't prove the message was sent, so an admin confirms it later.
            var order = await OrderSubmission.FindExistingAsync(db, request.SubmissionId, ct)
                ?? await OrderSubmission.SaveAsync(
                    db, quote, customer!, context.Store.StoreName, request.SubmissionId, clock, ct);

            return TypedResults.Ok(new SubmitResultDto(
                order.Reference,
                quote,
                order.Message,
                WhatsAppMessageBuilder.Link(context.Store.WhatsAppNumber!, order.Message)));
        })
        .RequireRateLimiting(RateLimiting.SubmitPolicy);

        return api;
    }
}
