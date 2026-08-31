import type Stripe from "stripe";
import type { CheckoutLookupKey } from "@shared/planFeatures";
import { STRIPE_PRICE_IDS } from "../config/stripePrices";

export interface TrustedStripePlan {
  planLookupKey: CheckoutLookupKey;
  priceId: string;
}

function configuredPlans(): TrustedStripePlan[] {
  return Object.entries(STRIPE_PRICE_IDS)
    .filter((entry): entry is [CheckoutLookupKey, string] => Boolean(entry[1]))
    .map(([planLookupKey, priceId]) => ({ planLookupKey, priceId }));
}

export function getTrustedCheckoutPlan(planLookupKey: string): TrustedStripePlan | null {
  const match = configuredPlans().find((plan) => plan.planLookupKey === planLookupKey);
  return match ?? null;
}

export function resolveTrustedStripePlan(input: {
  priceId: string | null | undefined;
  metadataSku?: string | null;
  stripeLookupKey?: string | null;
}): TrustedStripePlan | null {
  if (!input.priceId) return null;
  const priceMatches = configuredPlans().filter((plan) => plan.priceId === input.priceId);
  if (priceMatches.length !== 1) return null;

  const trusted = priceMatches[0];
  if (input.metadataSku && input.metadataSku !== trusted.planLookupKey) return null;
  if (
    input.stripeLookupKey
    && getTrustedCheckoutPlan(input.stripeLookupKey)
    && input.stripeLookupKey !== trusted.planLookupKey
  ) {
    return null;
  }
  return trusted;
}

export function planFromSubscription(
  subscription: Stripe.Subscription,
  metadataSku?: string | null,
): TrustedStripePlan | null {
  const price = subscription.items.data[0]?.price;
  return resolveTrustedStripePlan({
    priceId: price?.id,
    metadataSku: metadataSku ?? subscription.metadata?.sku,
    stripeLookupKey: price?.lookup_key,
  });
}
