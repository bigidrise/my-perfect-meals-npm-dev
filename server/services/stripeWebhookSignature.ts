import type Stripe from "stripe";

export function verifyStripeWebhookEvent(input: {
  stripe: Stripe;
  rawBody: Buffer;
  signature: string | string[];
  webhookSecret: string;
}): Stripe.Event {
  return input.stripe.webhooks.constructEvent(
    input.rawBody,
    input.signature,
    input.webhookSecret,
  );
}