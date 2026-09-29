import { eq } from "drizzle-orm";
import { db } from "../db";
import { studios, studioBilling } from "../db/schema/studio";
import { users } from "@shared/schema";
import { readServiceBillingStatus } from "./serviceBillingStatus";
import type { ServiceBillingStatus } from "@shared/serviceBilling";

export type LegacyStudioBilling = {
  customerId: string | null;
  subscriptionId: string | null;
  reservationId: string | null;
  checkoutSessionId: string | null;
  planKey: string;
  status: string;
};

/** A legacy Studio has no Stripe billing identity or checkout in progress. */
export function isLegacyStudioBilling(record: LegacyStudioBilling | null | undefined): boolean {
  return !record || (
    !record.customerId && !record.subscriptionId &&
    !record.reservationId && !record.checkoutSessionId &&
    (record.planKey === "studio_59" || record.planKey === "clinic_69") &&
    record.status === "trialing"
  );
}

/** A Studio subscription is never inferred from the owner's Personal subscription. */
export async function readIndependentStudioAccess(userId: string): Promise<{
  studioId: string | null;
  studioActive: boolean;
  studioDisconnected: boolean;
  hasSubscription: boolean;
  legacyEligible: boolean;
  legacyToggleEligible: boolean;
  billing: ServiceBillingStatus | null;
}> {
  const owned = await db.select({ id: studios.id, status: studios.status })
    .from(studios).where(eq(studios.ownerUserId, userId)).limit(2);
  if (owned.length !== 1) {
    return { studioId: null, studioActive: false, studioDisconnected: false,
      hasSubscription: false, legacyEligible: false, legacyToggleEligible: false, billing: null };
  }
  const studio = owned[0];
  const [record] = await db.select({
    customerId: studioBilling.stripeCustomerId,
    subscriptionId: studioBilling.stripeSubscriptionId,
    reservationId: studioBilling.stripeCheckoutReservationId,
    checkoutSessionId: studioBilling.stripeCheckoutSessionId,
    planKey: studioBilling.planCode,
    status: studioBilling.status,
  }).from(studioBilling).where(eq(studioBilling.studioId, studio.id)).limit(1);
  const attachment = {
    studioDisconnected: studio.status === "disconnected",
    legacyToggleEligible: (studio.status === "active" || studio.status === "disconnected") &&
      isLegacyStudioBilling(record),
  };
  if (!record?.customerId || !record.subscriptionId) {
    return { studioId: studio.id, studioActive: studio.status === "active", ...attachment,
      hasSubscription: false,
      legacyEligible: studio.status === "active" &&
        (record?.planKey === "studio_59" || record?.planKey === "clinic_69") &&
        record.status === "trialing",
      billing: null };
  }
  const [personal] = await db.select({
    customerId: users.stripeCustomerId,
    subscriptionId: users.stripeSubscriptionId,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!personal || record.customerId === personal.customerId ||
      record.subscriptionId === personal.subscriptionId) {
    return { studioId: studio.id, studioActive: studio.status === "active",
      ...attachment, hasSubscription: true, legacyEligible: false,
      billing: { state: "needs_review", paidThrough: null } };
  }
  const billing = await readServiceBillingStatus({
    serviceType: "professional",
    ownerUserId: userId,
    stripeCustomerId: record.customerId,
    stripeSubscriptionId: record.subscriptionId,
    studioId: studio.id,
    trustedPlanKey: record.planKey,
  });
  if ((billing.state === "active" || billing.state === "ending") &&
      record.status !== "active") {
    return { studioId: studio.id, studioActive: studio.status === "active",
      ...attachment, hasSubscription: true, legacyEligible: false,
      billing: { state: "needs_review", paidThrough: null } };
  }
  return { studioId: studio.id, studioActive: studio.status === "active",
    ...attachment, hasSubscription: true, legacyEligible: false, billing };
}

export async function hasIndependentStudioAccess(userId: string): Promise<boolean> {
  const result = await readIndependentStudioAccess(userId);
  return result.studioActive &&
    (result.billing?.state === "active" || result.billing?.state === "ending");
}