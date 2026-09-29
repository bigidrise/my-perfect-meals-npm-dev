import type Stripe from "stripe";
import { getTrustedCheckoutPlan, planFromSubscription, type TrustedStripePlan } from "./stripePlanCatalog";

/**
 * The Studio price is selected from the server-owned professional catalog by
 * the existing Studio type. It is never selected from users' Personal plan
 * fields or from a browser-supplied SKU.
 */
export function getTrustedStudioPlan(studioType: string): TrustedStripePlan | null {
  const key = studioType === "clinic"
    ? "mpm_physician_50"
    : studioType === "studio"
      ? "mpm_trainer_5"
      : null;
  return key ? getTrustedCheckoutPlan(key) : null;
}

export function resolveTrustedStudioSubscription(
  subscription: Stripe.Subscription,
  studioType: string,
): TrustedStripePlan | null {
  const expected = getTrustedStudioPlan(studioType);
  const actual = planFromSubscription(subscription, subscription.metadata?.sku);
  return expected && actual?.planLookupKey === expected.planLookupKey ? actual : null;
}

export function hasStudioBillingMetadata(metadata: Record<string, string> | null | undefined): boolean {
  return Boolean(
    metadata?.serviceType === "studio" ||
    metadata?.subscriptionType === "studio" ||
    metadata?.studioId,
  );
}