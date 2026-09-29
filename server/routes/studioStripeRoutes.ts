import { Router } from "express";
import Stripe from "stripe";
import { ensureStudioForTrainer } from "../services/studioBridge";
import { getProviderStudioReadiness } from "../services/procareStudioReadiness";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "../db";
import { users } from "@shared/schema";
import { studios, studioBilling } from "../db/schema/studio";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";
import { serviceBillingSnapshots } from "../db/schema/serviceBillingSnapshots";
import { claimStripeIdentityOwnership } from "../services/stripeIdentityOwnershipService";
import { getTrustedStudioPlan } from "../services/studioStripePlanCatalog";
import { readServiceBillingStatus } from "../services/serviceBillingStatus";
import { assertStripeBillingOwnership, getStripeKeyMode } from "../services/stripeRuntimePolicy";

const router = Router();
const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-10-29.clover" }) : null;

function getUserId(req: any): string | null {
  return req.authUser?.id ?? req.session?.userId ?? null;
}

function stripeObjectId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function checkoutBaseUrl(): string {
  return process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
    "http://localhost:5000";
}

async function ensureStudioCustomer(input: {
  stripe: Stripe;
  userId: string;
  studioId: string;
  email: string | null;
  name: string;
  customerId: string | null;
}): Promise<string> {
  if (input.customerId) {
    const existing = await input.stripe.customers.retrieve(input.customerId);
    if (existing.deleted === true) {
      throw new Error("Existing Studio Stripe customer metadata is ambiguous; contact support before checkout.");
    }
    if (
      existing.metadata?.userId !== input.userId ||
      existing.metadata?.serviceType !== "studio" ||
      existing.metadata?.studioId !== input.studioId
    ) {
      throw new Error("Existing Studio Stripe customer metadata is ambiguous; contact support before checkout.");
    }
    return input.customerId;
  }
  const customer = await input.stripe.customers.create({
    ...(input.email ? { email: input.email } : {}),
    name: input.name,
    metadata: {
      userId: input.userId,
      serviceType: "studio",
      studioId: input.studioId,
    },
  }, {
    idempotencyKey: `mpm-studio-customer:${input.studioId}`,
  });
  await db.transaction(async (tx) => {
    await claimStripeIdentityOwnership(tx, {
      ownerUserId: input.userId,
      stripeCustomerId: customer.id,
    });
    const [saved] = await tx.update(studioBilling).set({
      stripeCustomerId: customer.id,
      updatedAt: new Date(),
    }).where(and(
      eq(studioBilling.studioId, input.studioId),
      isNull(studioBilling.stripeCustomerId),
    )).returning({ stripeCustomerId: studioBilling.stripeCustomerId });
    if (!saved) {
      const [current] = await tx.select({ stripeCustomerId: studioBilling.stripeCustomerId })
        .from(studioBilling).where(eq(studioBilling.studioId, input.studioId)).limit(1);
      if (current?.stripeCustomerId !== customer.id) {
        throw new Error("A different Stripe customer is already attached to this Studio.");
      }
    }
  });
  return customer.id;
}

async function verifyExpiredStudioSubscription(input: {
  userId: string;
  studioId: string;
  customerId: string | null;
  subscriptionId: string;
  planLookupKey: string;
}): Promise<void> {
  if (!input.customerId) throw new Error("Studio billing identity needs review before reconnecting.");
  const billing = await readServiceBillingStatus({
    serviceType: "professional",
    ownerUserId: input.userId,
    stripeCustomerId: input.customerId,
    stripeSubscriptionId: input.subscriptionId,
    studioId: input.studioId,
    trustedPlanKey: input.planLookupKey,
  });
  if (billing.state !== "expired") {
    throw new Error(
      billing.state === "active" || billing.state === "ending"
        ? "Studio already has current paid access."
        : "Previous Studio billing could not be verified for reconnect.",
    );
  }
  const [snapshot] = await db.select({
    ownerUserId: serviceBillingSnapshots.ownerUserId,
    serviceType: serviceBillingSnapshots.serviceType,
    stripeCustomerId: serviceBillingSnapshots.stripeCustomerId,
    stripeSubscriptionId: serviceBillingSnapshots.stripeSubscriptionId,
    businessId: serviceBillingSnapshots.businessId,
    studioId: serviceBillingSnapshots.studioId,
  }).from(serviceBillingSnapshots)
    .where(eq(serviceBillingSnapshots.stripeSubscriptionId, input.subscriptionId)).limit(1);
  if (
    !snapshot ||
    snapshot.ownerUserId !== input.userId ||
    snapshot.serviceType !== "professional" ||
    snapshot.stripeCustomerId !== input.customerId ||
    snapshot.stripeSubscriptionId !== input.subscriptionId ||
    snapshot.businessId !== null ||
    snapshot.studioId !== input.studioId
  ) {
    throw new Error("Previous Studio subscription identity is ambiguous.");
  }
  for (const identityType of ["customer", "subscription"] as const) {
    const identityValue = identityType === "customer" ? input.customerId : input.subscriptionId;
    const [claim] = await db.select({
      ownerUserId: stripeIdentityOwners.ownerUserId,
      businessId: stripeIdentityOwners.businessId,
    }).from(stripeIdentityOwners).where(and(
      eq(stripeIdentityOwners.identityType, identityType),
      eq(stripeIdentityOwners.identityValue, identityValue),
    )).limit(1);
    if (!claim || claim.ownerUserId !== input.userId || claim.businessId !== null) {
      throw new Error("Previous Studio Stripe ownership is ambiguous.");
    }
  }
}

router.post("/checkout", requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe billing is not configured." });
  if (process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED !== "true") {
    return res.status(503).json({ error: "Verified Studio billing is not enabled." });
  }
  const deployed = process.env.REPLIT_DEPLOYMENT === "1" ||
    process.env.REPLIT_DEPLOYMENT === "true";
  if (!deployed && getStripeKeyMode(stripeKey) !== "TEST") {
    return res.status(503).json({ error: "Studio checkout requires test-mode Stripe in Development." });
  }
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    assertStripeBillingOwnership(stripeKey);
    const readiness = await getProviderStudioReadiness(userId, { requireSubscription: false });
    if (!readiness.ok) {
      return res.status(403).json({ error: readiness.message, code: readiness.code });
    }
    let studioId = typeof req.body?.studioId === "string" ? req.body.studioId : "";
    if (!studioId) {
      const ensured = await ensureStudioForTrainer(userId);
      if (!ensured) {
        return res.status(409).json({ error: "Studio setup could not be verified. Please try again." });
      }
      studioId = ensured.studioId;
      if (ensured.created) {
        await db.update(studioBilling).set({
          planCode: "studio_pending",
          status: "incomplete",
          updatedAt: new Date(),
        }).where(and(
          eq(studioBilling.studioId, studioId),
          isNull(studioBilling.stripeSubscriptionId),
        ));
      }
    }
    const [studio] = await db.select({
      id: studios.id,
      ownerUserId: studios.ownerUserId,
      name: studios.name,
      type: studios.type,
      email: studios.contactEmail,
    }).from(studios).where(and(
      eq(studios.ownerUserId, userId),
      eq(studios.id, studioId),
    )).limit(1);
    if (!studio) return res.status(404).json({ error: "The requested Studio was not found for this account." });

    const trustedPlan = getTrustedStudioPlan(studio.type);
    if (!trustedPlan) {
      return res.status(503).json({ error: "A trusted professional Stripe price is not configured for this Studio type." });
    }
    const [billing] = await db.select().from(studioBilling)
      .where(eq(studioBilling.studioId, studio.id)).limit(1);
    if (!billing) return res.status(409).json({ error: "Studio billing is not initialized; contact support." });
    const [personal] = await db.select({
      customerId: users.stripeCustomerId,
      subscriptionId: users.stripeSubscriptionId,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!personal ||
        (billing.stripeCustomerId && billing.stripeCustomerId === personal.customerId) ||
        (billing.stripeSubscriptionId && billing.stripeSubscriptionId === personal.subscriptionId)) {
      return res.status(409).json({
        error: "Studio and Personal billing identities overlap. No checkout was started; contact support for review.",
      });
    }
    if (billing.stripeSubscriptionId && billing.planCode !== trustedPlan.planLookupKey) {
      return res.status(409).json({
        error: "Your previous Studio plan needs review before reconnecting. No new checkout was started.",
      });
    }

    let expiredSubscriptionId: string | null = null;
    if (billing.stripeSubscriptionId) {
      await verifyExpiredStudioSubscription({
        userId,
        studioId: studio.id,
        customerId: billing.stripeCustomerId,
        subscriptionId: billing.stripeSubscriptionId,
        planLookupKey: billing.planCode,
      });
      expiredSubscriptionId = billing.stripeSubscriptionId;
    }

    const customerId = await ensureStudioCustomer({
      stripe,
      userId,
      studioId: studio.id,
      email: studio.email,
      name: studio.name,
      customerId: billing.stripeCustomerId,
    });
    const [customerOwner] = await db.select({
      ownerUserId: stripeIdentityOwners.ownerUserId,
      businessId: stripeIdentityOwners.businessId,
    }).from(stripeIdentityOwners).where(and(
      eq(stripeIdentityOwners.identityType, "customer"),
      eq(stripeIdentityOwners.identityValue, customerId),
    )).limit(1);
    if (
      !customerOwner ||
      customerOwner.ownerUserId !== userId ||
      customerOwner.businessId !== null
    ) {
      return res.status(409).json({ error: "Studio Stripe customer ownership needs review before checkout." });
    }

    let reservationId = billing.stripeCheckoutReservationId;
    let savedSessionId = billing.stripeCheckoutSessionId;
    if (savedSessionId) {
      const savedSession = await stripe.checkout.sessions.retrieve(savedSessionId);
      if (
        savedSession.metadata?.serviceType !== "studio" ||
        savedSession.metadata?.subscriptionType !== "studio" ||
        savedSession.metadata?.userId !== userId ||
        savedSession.metadata?.studioId !== studio.id ||
        savedSession.metadata?.sku !== trustedPlan.planLookupKey ||
        savedSession.metadata?.checkoutReservationId !== reservationId
      ) {
        return res.status(409).json({ error: "Saved Studio checkout identity needs manual review; do not pay again." });
      }
      if (savedSession.status === "open" && savedSession.url) return res.json({ url: savedSession.url });
      if (savedSession.status === "complete" || savedSession.payment_status === "paid" || savedSession.subscription) {
        const savedSubscriptionId = stripeObjectId(savedSession.subscription as any);
        if (!expiredSubscriptionId || savedSubscriptionId !== expiredSubscriptionId) {
          return res.status(409).json({
            code: "STUDIO_BILLING_VERIFICATION_PENDING",
            error: "Studio checkout is already complete. Do not pay again; retry billing verification.",
            recoveryUrl: `/checkout/success?session_id=${encodeURIComponent(savedSession.id)}`,
          });
        }
      }
      if (savedSession.status !== "expired" &&
          !(expiredSubscriptionId && stripeObjectId(savedSession.subscription as any) === expiredSubscriptionId)) {
        return res.status(409).json({ error: "Saved Studio checkout cannot be verified; do not start another payment." });
      }
      reservationId = null;
      savedSessionId = null;
    } else if (reservationId) {
      return res.status(409).json({
        code: "STUDIO_CHECKOUT_UNBOUND",
        error: "A Studio checkout was reserved but could not be verified. Do not pay again; contact support.",
      });
    }

    const proposedReservationId = randomUUID();
    const [reserved] = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM studio_billing WHERE studio_id = ${studio.id} FOR UPDATE`);
      const [current] = await tx.select().from(studioBilling)
        .where(eq(studioBilling.studioId, studio.id)).limit(1);
      if (!current || current.stripeCustomerId !== customerId) {
        throw new Error("Studio billing changed during checkout; please retry.");
      }
      if (
        current.stripeCheckoutReservationId !== billing.stripeCheckoutReservationId ||
        current.stripeCheckoutSessionId !== billing.stripeCheckoutSessionId ||
        current.stripeSubscriptionId !== billing.stripeSubscriptionId
      ) {
        throw new Error("A concurrent Studio billing change needs verification; please retry.");
      }
      return tx.update(studioBilling).set({
        stripeCheckoutReservationId: proposedReservationId,
        stripeCheckoutSessionId: null,
        // Keep the verified expired identity until the replacement is paid
        // and atomically bound. A failed Checkout must not erase recovery.
        stripeSubscriptionId: current.stripeSubscriptionId,
        planCode: trustedPlan.planLookupKey,
        status: current.stripeSubscriptionId ? current.status : "incomplete",
        updatedAt: new Date(),
      }).where(and(
        eq(studioBilling.studioId, studio.id),
        eq(studioBilling.stripeCustomerId, customerId),
      )).returning({ studioId: studioBilling.studioId });
    });
    if (!reserved) throw new Error("Studio checkout reservation could not be saved.");

    const appUrl = checkoutBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: trustedPlan.priceId, quantity: 1 }],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings?studio_checkout=cancelled`,
      metadata: {
        userId,
        studioId: studio.id,
        checkoutReservationId: proposedReservationId,
        serviceType: "studio",
        subscriptionType: "studio",
        sku: trustedPlan.planLookupKey,
      },
      subscription_data: {
        metadata: {
          userId,
          studioId: studio.id,
          checkoutReservationId: proposedReservationId,
          serviceType: "studio",
          subscriptionType: "studio",
          sku: trustedPlan.planLookupKey,
        },
      },
    }, {
      idempotencyKey: `mpm-studio-checkout:${studio.id}:${proposedReservationId}`,
    });
    if (!session.url) throw new Error("Stripe did not return a Studio checkout URL.");

    const [sessionSaved] = await db.update(studioBilling).set({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date(),
    }).where(and(
      eq(studioBilling.studioId, studio.id),
      eq(studioBilling.stripeCheckoutReservationId, proposedReservationId),
      isNull(studioBilling.stripeCheckoutSessionId),
    )).returning({ studioId: studioBilling.studioId });
    if (!sessionSaved) {
      return res.status(409).json({
        code: "STUDIO_CHECKOUT_UNBOUND",
        error: "Stripe created a checkout that could not be bound to Studio. Do not pay again; contact support.",
      });
    }
    return res.json({ url: session.url });
  } catch (error: any) {
    const message = error?.message ?? "Studio checkout could not be created.";
    console.error("[studio/checkout] Refused or failed:", message);
    const status = message.includes("disabled outside the production billing runtime") ? 503 : 409;
    return res.status(status).json({
      error: status === 503 ? "Live billing is only available from the production billing runtime." : message,
    });
  }
});

export default router;