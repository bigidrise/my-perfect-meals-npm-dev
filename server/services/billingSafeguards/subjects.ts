import { createHash } from "node:crypto";
import type Stripe from "stripe";

export type BillingSubject = {
  kind: "personal" | "family" | "studio" | "organization" | "procare";
  ownerUserId: string;
  /** Required for a separately billed household, Studio, Organization or care relationship. */
  scopeId?: string;
};

export class BillingSafetyError extends Error {
  constructor(readonly code: string, message: string, readonly status = 409) {
    super(message);
    this.name = "BillingSafetyError";
  }
}

export function subjectKey(subject: BillingSubject): string {
  if (!subject.ownerUserId || (subject.kind !== "personal" && !subject.scopeId)) {
    throw new BillingSafetyError("BILLING_SUBJECT_INVALID", "An exact billing relationship is required.");
  }
  return createHash("sha256").update(JSON.stringify([
    "mpm-billing-v1", subject.kind, subject.ownerUserId, subject.scopeId ?? null,
  ])).digest("hex");
}

export const terminalSubscriptionStates = new Set(["canceled", "incomplete_expired"]);

/** An MPM price is necessary: metadata alone must never adopt Everfit or other payments. */
export function subscriptionSubject(
  subscription: Stripe.Subscription,
  managedPrices: ReadonlyMap<string, string>,
): { subject: BillingSubject | null; managed: boolean; ambiguous: boolean } {
  const items = subscription.items.data;
  const plan = managedPrices.get(items[0]?.price?.id);
  if (!plan) return { subject: null, managed: false, ambiguous: false };
  const m = subscription.metadata ?? {};
  const ownerUserId = m.userId;
  if (!ownerUserId || items.length !== 1 ||
      (m.sku && m.sku !== plan) || (items[0]?.quantity ?? 1) !== 1) {
    return { subject: null, managed: true, ambiguous: true };
  }
  let subject: BillingSubject;
  if (m.subscriptionType === "procare_client") {
    if (!m.clientUserId || !m.proUserId || m.clientUserId !== ownerUserId) {
      return { subject: null, managed: true, ambiguous: true };
    }
    subject = { kind: "procare", ownerUserId, scopeId: JSON.stringify([m.clientUserId, m.proUserId]) };
  } else if (m.serviceType === "studio" || m.subscriptionType === "studio") {
    if (!m.studioId) return { subject: null, managed: true, ambiguous: true };
    subject = { kind: "studio", ownerUserId, scopeId: m.studioId };
  } else if (plan === "clinical_business_monthly") {
    if (!m.businessId) return { subject: null, managed: true, ambiguous: true };
    subject = { kind: "organization", ownerUserId, scopeId: m.businessId };
  } else if (m.householdId && plan.startsWith("mpm_family_")) {
    subject = { kind: "family", ownerUserId, scopeId: m.householdId };
  } else if (/^mpm_(?:trainer|physician)_|^signature_kitchen_/.test(plan)) {
    return { subject: null, managed: true, ambiguous: true };
  } else {
    // Existing MPM family plans replace the account's Personal plan; no new household is inferred.
    subject = { kind: "personal", ownerUserId };
  }
  if (m.mpmBillingSubject && m.mpmBillingSubject !== subjectKey(subject)) {
    return { subject: null, managed: true, ambiguous: true };
  }
  return { subject, managed: true, ambiguous: false };
}

export function assertPersonalCheckoutPlan(plan: string): void {
  if (!new Set([
    "mpm_basic", "mpm_premium", "mpm_ultimate", "mpm_guidance",
    "mpm_family_base", "mpm_family_premium", "mpm_family_ultimate",
  ]).has(plan)) {
    throw new BillingSafetyError(
      "BILLING_PRODUCT_ROUTE_REQUIRED",
      "Use the dedicated Organization or Studio checkout for this product.",
    );
  }
}
