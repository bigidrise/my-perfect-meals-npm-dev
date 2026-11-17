import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { BillingSafetyError, subjectKey, subscriptionSubject, terminalSubscriptionStates } from "./subjects";

export interface BillingFinding {
  fingerprint: string;
  subjectKey: string;
  category: "duplicate_subscription" | "duplicates_ending" | "ambiguous_subscription";
  subscriptionIds: string[];
}

export async function subscriptionInventory(stripe: Stripe): Promise<Stripe.Subscription[]> {
  const rows: Stripe.Subscription[] = [];
  // SDK auto-pagination, not just data[0..99]. No Stripe search eventual-consistency dependency.
  for await (const subscription of stripe.subscriptions.list({ status: "all", limit: 100 })) {
    rows.push(subscription);
    if (rows.length > 50_000) {
      throw new BillingSafetyError("BILLING_INVENTORY_LIMIT", "Billing inventory requires review.", 503);
    }
  }
  return rows;
}

export function inspectInventory(
  subscriptions: Stripe.Subscription[],
  managedPrices: ReadonlyMap<string, string>,
  accountId: string,
  livemode: boolean,
): BillingFinding[] {
  const groups = new Map<string, Stripe.Subscription[]>();
  const findings: BillingFinding[] = [];
  const finding = (key: string, category: BillingFinding["category"], ids: string[]) => ({
    subjectKey: key, category, subscriptionIds: ids.sort(),
    fingerprint: createHash("sha256").update(JSON.stringify([
      accountId, livemode, key, category, [...ids].sort(),
    ])).digest("hex"),
  });
  for (const subscription of subscriptions) {
    if (subscription.livemode !== livemode) {
      throw new BillingSafetyError("BILLING_MODE_CONFLICT", "Provider inventory mode disagrees with account mode.", 503);
    }
    if (terminalSubscriptionStates.has(subscription.status)) continue;
    const classified = subscriptionSubject(subscription, managedPrices);
    if (!classified.managed) continue;
    if (!classified.subject) {
      const key = createHash("sha256").update(`unresolved:${subscription.id}`).digest("hex");
      findings.push(finding(key, "ambiguous_subscription", [subscription.id]));
      continue;
    }
    const key = subjectKey(classified.subject);
    groups.set(key, [...(groups.get(key) ?? []), subscription]);
  }
  for (const [key, subscriptionsForSubject] of groups) {
    if (subscriptionsForSubject.length < 2) continue;
    const continuing = subscriptionsForSubject.filter(s => !s.cancel_at_period_end && !s.cancel_at);
    findings.push(finding(key, continuing.length <= 1 ? "duplicates_ending" : "duplicate_subscription",
      subscriptionsForSubject.map(s => s.id)));
  }
  return findings;
}
