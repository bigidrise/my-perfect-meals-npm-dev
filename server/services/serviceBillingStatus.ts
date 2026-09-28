import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  serviceBillingSnapshots,
  type ServiceBillingSnapshot,
} from "../db/schema/serviceBillingSnapshots";
import type { BillableService, ServiceBillingStatus } from "@shared/serviceBilling";
import { isProCarePlanKey } from "@shared/planFeatures";
import { resolveTrustedStripePlan } from "./stripePlanCatalog";

export type BillingIdentity = {
  serviceType: BillableService;
  ownerUserId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  businessId?: string | null;
  studioId?: string | null;
  trustedPlanKey?: string | null;
};

const REVIEW: ServiceBillingStatus = { state: "needs_review", paidThrough: null };

/** Never use plan keys or workspace status as evidence of a paid-through date. */
export function resolveServiceBillingStatus(
  identity: BillingIdentity,
  snapshot: ServiceBillingSnapshot | null,
  now: Date = new Date(),
  trustedPrice: (priceId: string) => { planLookupKey: string } | null =
    (priceId) => resolveTrustedStripePlan({ priceId }),
): ServiceBillingStatus {
  if (!identity.stripeCustomerId || !identity.stripeSubscriptionId || !snapshot ||
      !snapshot.sourceEventId || !snapshot.priceId || !snapshot.productId ||
      !snapshot.trustedPlanKey || Number.isNaN(snapshot.currentPeriodEnd.getTime()) ||
      Number.isNaN(snapshot.verifiedAt.getTime()) ||
      snapshot.verifiedAt.getTime() > now.getTime() ||
      snapshot.ownerUserId !== identity.ownerUserId ||
      snapshot.serviceType !== identity.serviceType ||
      snapshot.stripeCustomerId !== identity.stripeCustomerId ||
      snapshot.stripeSubscriptionId !== identity.stripeSubscriptionId ||
      (identity.businessId ?? null) !== snapshot.businessId ||
      (identity.studioId && snapshot.studioId !== identity.studioId) ||
      (identity.trustedPlanKey && snapshot.trustedPlanKey !== identity.trustedPlanKey) ||
      (snapshot.priceId && trustedPrice(snapshot.priceId)?.planLookupKey !== snapshot.trustedPlanKey) ||
      (identity.serviceType === "professional" && !isProCarePlanKey(snapshot.trustedPlanKey)) ||
      (identity.serviceType === "organization" && snapshot.trustedPlanKey !== "clinical_business_monthly")) {
    return REVIEW;
  }
  if (snapshot.status === "canceled") return { state: "expired", paidThrough: null };
  // A trial may grant access, but does not prove that a period has been paid for.
  if (snapshot.status !== "active") return REVIEW;
  // An old active event cannot prove either renewal or expiry after its period end.
  if (snapshot.currentPeriodEnd <= now) return REVIEW;
  if (snapshot.cancelAtPeriodEnd) {
    return { state: "ending", paidThrough: snapshot.currentPeriodEnd.toISOString() };
  }
  return { state: "active", paidThrough: snapshot.currentPeriodEnd.toISOString() };
}

/**
 * Read only. Before the separate, explicitly approved migration and verified
 * webhook ingestion, all subscriptions resolve to needs_review. No Stripe call,
 * DDL, backfill, or customer/subscription creation happens on this path.
 */
export async function readServiceBillingStatus(identity: BillingIdentity): Promise<ServiceBillingStatus> {
  if (!identity.stripeSubscriptionId || !identity.stripeCustomerId) return REVIEW;
  const result = await db.execute(sql`
    SELECT to_regclass('public.stripe_service_subscription_snapshots') IS NOT NULL AS present
  `);
  const row = (result as any).rows?.[0] ?? (result as any)[0];
  if (row?.present !== true) return REVIEW;
  const [snapshot] = await db.select().from(serviceBillingSnapshots)
    .where(eq(serviceBillingSnapshots.stripeSubscriptionId, identity.stripeSubscriptionId))
    .limit(1);
  return resolveServiceBillingStatus(identity, snapshot ?? null);
}