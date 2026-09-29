import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";
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
  if (snapshot.status === "canceled") {
    return snapshot.terminalAt && !Number.isNaN(snapshot.terminalAt.getTime()) &&
      snapshot.terminalAt <= now
      ? { state: "expired", paidThrough: null }
      : REVIEW;
  }
  // A trial may grant access, but does not prove that a period has been paid for.
  if (snapshot.status !== "active") return REVIEW;
  if (snapshot.terminalAt) return REVIEW;
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
async function snapshotTableExists(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT to_regclass('public.stripe_service_subscription_snapshots') IS NOT NULL AS present
  `);
  const row = (result as any).rows?.[0] ?? (result as any)[0];
  return row?.present === true;
}

export async function readServiceBillingStatus(identity: BillingIdentity): Promise<ServiceBillingStatus> {
  if (!identity.stripeSubscriptionId || !identity.stripeCustomerId) return REVIEW;
  if (!await snapshotTableExists()) return REVIEW;
  const [snapshot] = await db.select().from(serviceBillingSnapshots)
    .where(eq(serviceBillingSnapshots.stripeSubscriptionId, identity.stripeSubscriptionId))
    .limit(1);
  return resolveServiceBillingStatus(identity, snapshot ?? null);
}

export function resolveHistoricalProfessionalBilling(
  candidate: ServiceBillingSnapshot,
  ownerUserId: string,
  studioId: string,
  ownership: Array<{ identityType: string; identityValue: string }>,
  now: Date = new Date(),
  trustedPrice: (priceId: string) => { planLookupKey: string } | null =
    (priceId) => resolveTrustedStripePlan({ priceId }),
): ServiceBillingStatus {
  if (candidate.ownerUserId !== ownerUserId ||
      candidate.serviceType !== "professional" ||
      candidate.studioId !== studioId ||
      candidate.status !== "canceled" ||
      !ownership.some((row) => row.identityType === "customer" && row.identityValue === candidate.stripeCustomerId) ||
      !ownership.some((row) => row.identityType === "subscription" && row.identityValue === candidate.stripeSubscriptionId)) {
    return REVIEW;
  }
  return resolveServiceBillingStatus({
    serviceType: "professional",
    ownerUserId,
    stripeCustomerId: candidate.stripeCustomerId,
    stripeSubscriptionId: candidate.stripeSubscriptionId,
    studioId,
  }, candidate, now, trustedPrice);
}

/**
 * A canceled personal subscription loses users.stripe_subscription_id. Its
 * historical subscription identity remains in the verified snapshot and the
 * existing ownership registry; neither is an active user entitlement.
 * Multiple candidates or incomplete ownership always require review.
 */
export async function readHistoricalProfessionalBillingStatus(
  ownerUserId: string,
  studioId: string,
): Promise<ServiceBillingStatus | null> {
  if (!await snapshotTableExists()) return null;
  const candidates = await db.select().from(serviceBillingSnapshots)
    .where(and(
      eq(serviceBillingSnapshots.ownerUserId, ownerUserId),
      eq(serviceBillingSnapshots.serviceType, "professional"),
    ))
    .limit(2);
  if (candidates.length === 0) return null;
  if (candidates.length !== 1) return REVIEW;
  const candidate = candidates[0];
  const ownership = await db.select({
    identityType: stripeIdentityOwners.identityType,
    identityValue: stripeIdentityOwners.identityValue,
  }).from(stripeIdentityOwners).where(and(
    eq(stripeIdentityOwners.ownerUserId, ownerUserId),
    isNull(stripeIdentityOwners.businessId),
  ));
  return resolveHistoricalProfessionalBilling(candidate, ownerUserId, studioId, ownership);
}