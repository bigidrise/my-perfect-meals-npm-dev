import type Stripe from "stripe";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "../db";
import { studios } from "../db/schema/studio";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";
import { users } from "@shared/schema";
import {
  serviceBillingSnapshots,
  type ServiceBillingSnapshot,
} from "../db/schema/serviceBillingSnapshots";
import { isProCarePlanKey } from "@shared/planFeatures";
import { resolveTrustedStripePlan } from "./stripePlanCatalog";
import type { SubscriptionMutationContext } from "./subscriptionService";

type SnapshotInput = typeof serviceBillingSnapshots.$inferInsert;
type SnapshotSource = SubscriptionMutationContext["source"] | "backfill";
export type SnapshotWatermark = {
  eventCreatedAt: Date;
  eventRank: number;
  sourceEventId: string;
};

export function compareSnapshotWatermark(
  previous: SnapshotWatermark,
  incoming: SnapshotWatermark,
): "newer" | "duplicate" | "stale" {
  const delta = incoming.eventCreatedAt.getTime() - previous.eventCreatedAt.getTime();
  if (delta > 0) return "newer";
  if (delta < 0) return "stale";
  if (incoming.eventRank > previous.eventRank) return "newer";
  if (incoming.eventRank < previous.eventRank) return "stale";
  return incoming.sourceEventId === previous.sourceEventId ? "duplicate" : "stale";
}

function objectId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

/**
 * Only a trusted server-side Stripe subscription and a second Stripe price
 * lookup can establish a price/product pair. Never use client/metadata product
 * identifiers. The caller must separately verify exact account ownership.
 */
export async function verifySubscriptionBillingFacts(input: {
  stripe: Pick<Stripe, "prices">;
  subscription: Stripe.Subscription;
  customerId: string;
  ownerUserId: string;
  expectedPlanKey: string;
  mutation: SnapshotWatermark & { source: SnapshotSource };
  paymentFailed?: boolean;
}): Promise<Omit<SnapshotInput, "businessId" | "studioId">> {
  const { subscription, customerId, expectedPlanKey, mutation } = input;
  const item = subscription.items.data[0];
  if (subscription.items.data.length !== 1 || !item?.price?.id ||
      objectId(subscription.customer) !== customerId ||
      (subscription.metadata?.userId && subscription.metadata.userId !== input.ownerUserId)) {
    throw new Error("Stripe subscription identity or item count could not be verified");
  }
  const plan = resolveTrustedStripePlan({
    priceId: item.price.id,
    stripeLookupKey: item.price.lookup_key,
    metadataSku: subscription.metadata?.sku,
  });
  if (!plan || plan.planLookupKey !== expectedPlanKey) {
    throw new Error("Stripe price does not match the expected service plan");
  }
  const verifiedPrice = await input.stripe.prices.retrieve(item.price.id);
  const productId = objectId(verifiedPrice.product);
  if (!productId || verifiedPrice.id !== item.price.id ||
      objectId(item.price.product) !== productId ||
      (plan.planLookupKey === "clinical_business_monthly" && item.quantity !== 1)) {
    throw new Error("Stripe price and product association could not be verified");
  }
  const serviceType = plan.planLookupKey === "clinical_business_monthly"
    ? "organization" as const
    : isProCarePlanKey(plan.planLookupKey)
      ? "professional" as const
      : "personal" as const;
  // Stripe's current API puts the period on the subscription item.
  const periodEnd = item.current_period_end;
  if (!Number.isSafeInteger(periodEnd) || periodEnd <= 0 ||
      !Number.isFinite(mutation.eventCreatedAt.getTime()) ||
      !mutation.sourceEventId || !Number.isInteger(mutation.eventRank)) {
    throw new Error("Stripe billing period or event provenance is invalid");
  }
  const status = input.paymentFailed && subscription.status !== "canceled"
    ? "payment_failed"
    : subscription.status;
  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    serviceType,
    ownerUserId: input.ownerUserId,
    priceId: plan.priceId,
    productId,
    trustedPlanKey: plan.planLookupKey,
    status,
    currentPeriodEnd: new Date(periodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    terminalAt: status === "canceled"
      ? new Date(((subscription.ended_at ?? subscription.canceled_at) || Math.floor(mutation.eventCreatedAt.getTime() / 1000)) * 1000)
      : null,
    sourceEventId: mutation.sourceEventId,
    source: mutation.source,
    eventCreatedAt: mutation.eventCreatedAt,
    eventRank: mutation.eventRank,
    verifiedAt: new Date(),
  };
}

export function classifySnapshotWrite(
  existing: ServiceBillingSnapshot | null,
  incoming: SnapshotInput,
): "write" | "duplicate" | "stale" | "conflict" {
  if (!existing) return "write";
  if (existing.ownerUserId !== incoming.ownerUserId ||
      existing.serviceType !== incoming.serviceType ||
      existing.stripeCustomerId !== incoming.stripeCustomerId ||
      existing.businessId !== (incoming.businessId ?? null) ||
      (existing.studioId && incoming.studioId && existing.studioId !== incoming.studioId)) {
    return "conflict";
  }
  const order = compareSnapshotWatermark(existing, incoming);
  return order === "newer" ? "write" : order;
}

/** Called inside the accepted entitlement transaction; an error rolls it back. */
export async function persistVerifiedServiceSnapshot(
  tx: any,
  incoming: SnapshotInput,
): Promise<void> {
  const [existing] = await tx.select().from(serviceBillingSnapshots)
    .where(eq(serviceBillingSnapshots.stripeSubscriptionId, incoming.stripeSubscriptionId))
    .limit(1);
  const decision = classifySnapshotWrite(existing ?? null, incoming);
  if (decision === "conflict" || decision === "stale") {
    throw new Error(`Verified billing snapshot rejected ${decision} identity or event`);
  }
  if (decision === "duplicate") return;
  // The PK serializes concurrent inserts. Re-check order and identity on
  // conflict rather than trusting the initial read under READ COMMITTED.
  const [written] = await tx.insert(serviceBillingSnapshots)
    .values({ ...incoming, studioId: incoming.studioId ?? existing?.studioId ?? null })
    .onConflictDoUpdate({
      target: serviceBillingSnapshots.stripeSubscriptionId,
      set: {
        priceId: incoming.priceId,
        productId: incoming.productId,
        trustedPlanKey: incoming.trustedPlanKey,
        status: incoming.status,
        currentPeriodEnd: incoming.currentPeriodEnd,
        cancelAtPeriodEnd: incoming.cancelAtPeriodEnd,
        terminalAt: incoming.terminalAt,
        sourceEventId: incoming.sourceEventId,
        source: incoming.source,
        eventCreatedAt: incoming.eventCreatedAt,
        eventRank: incoming.eventRank,
        verifiedAt: incoming.verifiedAt,
        studioId: incoming.studioId ?? existing?.studioId ?? null,
      },
      setWhere: and(
        eq(serviceBillingSnapshots.ownerUserId, incoming.ownerUserId),
        eq(serviceBillingSnapshots.serviceType, incoming.serviceType),
        eq(serviceBillingSnapshots.stripeCustomerId, incoming.stripeCustomerId),
        incoming.businessId
          ? eq(serviceBillingSnapshots.businessId, incoming.businessId)
          : isNull(serviceBillingSnapshots.businessId),
        incoming.studioId
          ? or(isNull(serviceBillingSnapshots.studioId),
              eq(serviceBillingSnapshots.studioId, incoming.studioId))
          : undefined,
        or(
          lt(serviceBillingSnapshots.eventCreatedAt, incoming.eventCreatedAt),
          and(
            eq(serviceBillingSnapshots.eventCreatedAt, incoming.eventCreatedAt),
            lt(serviceBillingSnapshots.eventRank, incoming.eventRank),
          ),
          and(
            eq(serviceBillingSnapshots.eventCreatedAt, incoming.eventCreatedAt),
            eq(serviceBillingSnapshots.eventRank, incoming.eventRank),
            eq(serviceBillingSnapshots.sourceEventId, incoming.sourceEventId),
          ),
        ),
      ),
    })
    .returning({ id: serviceBillingSnapshots.stripeSubscriptionId });
  if (!written) throw new Error("Verified billing snapshot ownership conflict");
}

/**
 * An invoice failure may already have cleared users.stripe_subscription_id.
 * A later signed terminal event can only update an EXISTING verified snapshot
 * with both immutable ledger identities. No new owner is inferred from metadata.
 */
export async function persistVerifiedTerminalFromHistory(input: {
  stripe: Pick<Stripe, "prices">;
  subscription: Stripe.Subscription;
  customerId: string;
  expectedPlanKey: string;
  mutation: SubscriptionMutationContext;
}): Promise<string | null> {
  if (process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED !== "true" ||
      input.subscription.status !== "canceled") return null;
  const [previous] = await db.select().from(serviceBillingSnapshots)
    .where(eq(serviceBillingSnapshots.stripeSubscriptionId, input.subscription.id)).limit(1);
  if (!previous || previous.serviceType === "organization" ||
      previous.stripeCustomerId !== input.customerId) return null;
  if (compareSnapshotWatermark(previous, {
    sourceEventId: input.mutation.eventId,
    eventCreatedAt: input.mutation.eventCreatedAt,
    eventRank: input.mutation.eventRank,
  }) === "stale") return null;
  const facts = await verifySubscriptionBillingFacts({
    ...input,
    ownerUserId: previous.ownerUserId,
    mutation: {
      source: input.mutation.source,
      sourceEventId: input.mutation.eventId,
      eventCreatedAt: input.mutation.eventCreatedAt,
      eventRank: input.mutation.eventRank,
    },
  });
  if (facts.serviceType !== previous.serviceType) {
    throw new Error("Historical subscription service identity changed");
  }
  await db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id, subscriptionId: users.stripeSubscriptionId })
      .from(users).where(eq(users.id, previous.ownerUserId)).limit(1);
    if (!user || user.subscriptionId === input.subscription.id) {
      throw new Error("Historical subscription still has an active account binding");
    }
    const ownership = await tx.select({
      identityType: stripeIdentityOwners.identityType,
      identityValue: stripeIdentityOwners.identityValue,
    }).from(stripeIdentityOwners).where(and(
      eq(stripeIdentityOwners.ownerUserId, previous.ownerUserId),
      isNull(stripeIdentityOwners.businessId),
    ));
    if (!ownership.some((row) => row.identityType === "customer" && row.identityValue === input.customerId) ||
        !ownership.some((row) => row.identityType === "subscription" && row.identityValue === input.subscription.id)) {
      throw new Error("Historical Stripe identity ownership is incomplete");
    }
    await persistVerifiedServiceSnapshot(tx, {
      ...facts,
      businessId: null,
      studioId: previous.studioId,
    });
  });
  return previous.ownerUserId;
}

/**
 * Explicit opt-in only. Missing table/invalid evidence fails the Stripe event
 * for retry; this never runs a migration or silently drops accepted evidence.
 */
export async function prepareVerifiedSnapshotHook(input: {
  stripe: Pick<Stripe, "prices">;
  subscription: Stripe.Subscription;
  customerId: string;
  ownerUserId: string;
  expectedPlanKey: string;
  mutation: SubscriptionMutationContext;
  paymentFailed?: boolean;
}): Promise<((tx: any, ownerUserId: string, businessId?: string | null) => Promise<void>) | undefined> {
  if (process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED !== "true") return undefined;
  const facts = await verifySubscriptionBillingFacts({
    ...input,
    mutation: {
      sourceEventId: input.mutation.eventId,
      eventCreatedAt: input.mutation.eventCreatedAt,
      eventRank: input.mutation.eventRank,
      source: input.mutation.source,
    },
  });
  return async (tx, ownerUserId, businessId) => {
    if (ownerUserId !== facts.ownerUserId) throw new Error("Billing snapshot owner changed");
    if (facts.serviceType === "organization") {
      if (!businessId || (input.subscription.metadata?.businessId &&
          input.subscription.metadata.businessId !== businessId)) {
        throw new Error("Organization billing snapshot business identity mismatch");
      }
      await persistVerifiedServiceSnapshot(tx, { ...facts, businessId, studioId: null });
      return;
    }
    if (businessId) throw new Error("Personal subscription cannot bind to a business");
    const owned = facts.serviceType === "professional"
      ? await tx.select({ id: studios.id }).from(studios)
        .where(eq(studios.ownerUserId, ownerUserId)).limit(2)
      : [];
    if (owned.length > 1) throw new Error("Professional owns multiple Studio records");
    await persistVerifiedServiceSnapshot(tx, {
      ...facts,
      businessId: null,
      studioId: owned[0]?.id ?? null,
    });
  };
}