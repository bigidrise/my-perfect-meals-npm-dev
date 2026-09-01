import type Stripe from "stripe";
import type { CheckoutLookupKey } from "@shared/planFeatures";
import { STRIPE_PRICE_IDS } from "../config/stripePrices";

export interface TrustedStripePlan {
  planLookupKey: CheckoutLookupKey;
  priceId: string;
}

export interface StripePriceConfigurationStatus {
  configured: TrustedStripePlan[];
  missingPlanLookupKeys: CheckoutLookupKey[];
  duplicatePriceIds: Array<{
    priceId: string;
    planLookupKeys: CheckoutLookupKey[];
  }>;
  valid: boolean;
}

function configuredPlans(): TrustedStripePlan[] {
  return Object.entries(STRIPE_PRICE_IDS)
    .filter((entry): entry is [CheckoutLookupKey, string] => Boolean(entry[1]))
    .map(([planLookupKey, priceId]) => ({ planLookupKey, priceId }));
}

export function getStripePriceConfigurationStatus(): StripePriceConfigurationStatus {
  const configured = configuredPlans();
  const allPlanLookupKeys = Object.keys(STRIPE_PRICE_IDS) as CheckoutLookupKey[];
  const missingPlanLookupKeys = allPlanLookupKeys.filter(
    (planLookupKey) => !STRIPE_PRICE_IDS[planLookupKey],
  );
  const plansByPriceId = new Map<string, CheckoutLookupKey[]>();

  for (const plan of configured) {
    const keys = plansByPriceId.get(plan.priceId) ?? [];
    keys.push(plan.planLookupKey);
    plansByPriceId.set(plan.priceId, keys);
  }

  const duplicatePriceIds = [...plansByPriceId.entries()]
    .filter(([, planLookupKeys]) => planLookupKeys.length > 1)
    .map(([priceId, planLookupKeys]) => ({ priceId, planLookupKeys }));

  return {
    configured,
    missingPlanLookupKeys,
    duplicatePriceIds,
    valid: duplicatePriceIds.length === 0,
  };
}

export function getTrustedCheckoutPlan(planLookupKey: string): TrustedStripePlan | null {
  const match = configuredPlans().find((plan) => plan.planLookupKey === planLookupKey);
  if (!match) return null;
  const priceMatches = configuredPlans().filter((plan) => plan.priceId === match.priceId);
  return priceMatches.length === 1 ? match : null;
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
