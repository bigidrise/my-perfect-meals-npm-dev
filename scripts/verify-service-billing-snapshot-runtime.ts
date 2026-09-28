/**
 * One-off Phase 2D Development check. Uses the real snapshot writer and
 * resolver against Neon, with mock Stripe evidence and a forced transaction
 * rollback. Does not import the application entrypoint or persist any fixture.
 */
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

async function main(): Promise<void> {
  if (process.argv[2] !== "--approved-fixture" ||
      process.env.NODE_ENV === "production" ||
      process.env.REPLIT_DEPLOYMENT ||
      process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED !== "true" ||
      process.env.SERVICE_BILLING_BACKFILL_ENABLED === "true" ||
      !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("Development fixture requires explicit opt-in, snapshot gate, test-only Stripe key, and backfill off");
  }
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error("Development DATABASE_URL is required");
  const target = new URL(connection);
  if (target.hostname !== "ep-shy-wave-ahb2dj9a-pooler.c-3.us-east-1.aws.neon.tech" ||
      (target.port || "5432") !== "5432" ||
      decodeURIComponent(target.pathname.slice(1)) !== "neondb") {
    throw new Error("Development database target does not match the approved Neon identity");
  }

  // Import services only after all guards. Never import server/index.ts.
  const { db, pool } = await import("../server/db");
  try {
    const { eq } = await import("drizzle-orm");
    const { serviceBillingSnapshots } = await import("../server/db/schema/serviceBillingSnapshots");
    const { getTrustedCheckoutPlan } = await import("../server/services/stripePlanCatalog");
    const { verifySubscriptionBillingFacts, persistVerifiedServiceSnapshot } =
      await import("../server/services/verifiedServiceBillingWriter");
    const { resolveServiceBillingStatus } = await import("../server/services/serviceBillingStatus");
    const plan = getTrustedCheckoutPlan("mpm_trainer_5");
    if (!plan) throw new Error("Trainer fixture price is not uniquely configured");

    const id = randomUUID();
    const subscriptionId = `sub_phase2d_fixture_${id}`;
    const customerId = `cus_phase2d_fixture_${id}`;
    const ownerUserId = `phase2d-fixture-${id}`;
    const studioId = randomUUID();
    const productId = `prod_phase2d_fixture_${id}`;
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
    const startedAt = Math.floor(Date.now() / 1000) - 10;
    const stripe = {
      prices: {
        retrieve: async (priceId: string) => ({ id: priceId, product: productId }),
      },
    } as unknown as Pick<Stripe, "prices">;
    const identity = {
      serviceType: "professional" as const,
      ownerUserId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      studioId,
      trustedPlanKey: plan.planLookupKey,
    };

    const rollback = new Error("PHASE2D_FIXTURE_ROLLBACK");
    let checked = 0;
    try {
      await db.transaction(async (tx) => {
        for (const [index, state] of (["active", "ending", "expired"] as const).entries()) {
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status: state === "expired" ? "canceled" : "active",
            cancel_at_period_end: state === "ending",
            ended_at: state === "expired" ? startedAt : null,
            metadata: { userId: ownerUserId, sku: plan.planLookupKey },
            items: { data: [{
              quantity: 1,
              current_period_end: periodEnd,
              price: { id: plan.priceId, product: productId, lookup_key: plan.planLookupKey },
            }] },
          } as unknown as Stripe.Subscription;
          const facts = await verifySubscriptionBillingFacts({
            stripe, subscription, customerId, ownerUserId,
            expectedPlanKey: plan.planLookupKey,
            mutation: {
              source: "webhook",
              sourceEventId: `evt_phase2d_fixture_${id}_${index}`,
              eventCreatedAt: new Date((startedAt + index) * 1000),
              eventRank: 75,
            },
          });
          await persistVerifiedServiceSnapshot(tx, { ...facts, businessId: null, studioId });
          const [stored] = await tx.select().from(serviceBillingSnapshots)
            .where(eq(serviceBillingSnapshots.stripeSubscriptionId, subscriptionId)).limit(1);
          if (!stored) throw new Error("Fixture snapshot was not readable in its transaction");
          const result = resolveServiceBillingStatus(identity, stored);
          const expected = state === "expired"
            ? { state: "expired", paidThrough: null }
            : {
                state: state === "ending" ? "ending" : "active",
                paidThrough: new Date(periodEnd * 1000).toISOString(),
              };
          if (result.state !== expected.state || result.paidThrough !== expected.paidThrough) {
            throw new Error(`Fixture ${state} resolved to an unexpected state or date`);
          }
          checked++;
          console.log(`Fixture ${state}: verified`);
        }
        // Even on success, deliberately roll back all three states.
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    if (checked !== 3) throw new Error("Fixture did not verify every lifecycle state");
    const persisted = await db.select({ id: serviceBillingSnapshots.stripeSubscriptionId })
      .from(serviceBillingSnapshots)
      .where(eq(serviceBillingSnapshots.stripeSubscriptionId, subscriptionId)).limit(1);
    if (persisted.length) throw new Error("Fixture rollback left a persisted snapshot");
    console.log("Fixture rollback verified: no snapshot persisted; no startup path imported");
  } finally {
    await pool.end();
  }
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  // Do not print database connection strings or environment values.
  const message = error instanceof Error ? error.message : "Unknown verification error";
  console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted connection]"));
  process.exit(1);
});