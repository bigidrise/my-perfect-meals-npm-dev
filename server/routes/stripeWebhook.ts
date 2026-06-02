import { Router } from "express";
import Stripe from "stripe";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  updateUserSubscription,
  cancelUserSubscription,
} from "../services/subscriptionService";
import { clientLinks } from "../db/schema/procare";
import { deactivateProCareClient } from "../services/procareActivation";
import type { LookupKey } from "../../client/src/data/planSkus";

const router = Router();

let stripe: Stripe | null = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
  });
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Resolve the plan lookup key from a Stripe subscription object.
 * Returns null if the price has no lookup_key set.
 */
function extractLookupKey(subscription: Stripe.Subscription): string | null {
  const price = subscription.items.data[0]?.price;
  return price?.lookup_key ?? null;
}

const CLINICAL_PLAN_KEYS = ["mpm_ultimate", "mpm_ultimate_monthly", "mpm_ultimate_plan_2999"];
const PROCARE_PLAN_KEYS = [
  "mpm_procare_monthly", "mpm_trainer_5", "mpm_trainer_10",
  "mpm_trainer_25", "mpm_trainer_50", "mpm_physician_50", "mpm_physician_150",
];

/**
 * Terminates all active ProCare relationships when a subscription is cancelled.
 * Called only on customer.subscription.deleted — after Stripe's retry cycle is exhausted.
 *
 * role="client" → finds all active coaches for this client, deactivates each link
 * role="coach"  → finds all active clients under this coach, deactivates each link
 */
async function terminateProCareRelationships(userId: string, role: "client" | "coach"): Promise<void> {
  try {
    if (role === "client") {
      const activeLinks = await db
        .select({ proUserId: clientLinks.proUserId })
        .from(clientLinks)
        .where(and(eq(clientLinks.clientUserId, userId), eq(clientLinks.active, true)));

      for (const link of activeLinks) {
        try {
          await deactivateProCareClient(userId, link.proUserId, userId, "provider_revoke");
          console.log(`🔌 [webhook] ProCare terminated: client ${userId} ← coach ${link.proUserId} (Clinical subscription cancelled)`);
        } catch (err) {
          console.error(`⚠️ [webhook] Failed to deactivate link client=${userId} coach=${link.proUserId}:`, err);
        }
      }
    } else {
      const activeLinks = await db
        .select({ clientUserId: clientLinks.clientUserId })
        .from(clientLinks)
        .where(and(eq(clientLinks.proUserId, userId), eq(clientLinks.active, true)));

      for (const link of activeLinks) {
        try {
          await deactivateProCareClient(link.clientUserId, userId, userId, "provider_revoke");
          console.log(`🔌 [webhook] ProCare terminated: client ${link.clientUserId} ← coach ${userId} (ProCare subscription cancelled)`);
        } catch (err) {
          console.error(`⚠️ [webhook] Failed to deactivate link client=${link.clientUserId} coach=${userId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`⚠️ [webhook] terminateProCareRelationships failed for ${role} ${userId}:`, err);
  }
}

router.post("/", async (req, res) => {
  if (!stripe || !webhookSecret) {
    return res.status(503).send("Stripe webhook not configured");
  }

  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    return res.status(400).send("Missing Stripe signature");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // ── Payment completed: new subscription ──────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const metadata = session.metadata || {};
        const userId = metadata.userId;
        const sku = metadata.sku as LookupKey;

        if (!userId || !sku) {
          console.warn("⚠️ [webhook] Missing userId or sku in checkout.session.completed");
          break;
        }

        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        await updateUserSubscription({
          userId,
          lookupKey: sku,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });

        console.log(`✅ [webhook] checkout.session.completed — user ${userId} → ${sku}`);
        break;
      }

      // ── Renewal or recovery: restore access if it was revoked ────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = (invoice as any).subscription as string | null;

        if (!customerId || !subscriptionId) {
          console.log(`[webhook] invoice.payment_succeeded — no customerId/subscriptionId, skipping`);
          break;
        }

        // Find the user and check if access was previously revoked
        const [user] = await db
          .select({ id: users.id, planLookupKey: users.planLookupKey, subscriptionStatus: users.subscriptionStatus })
          .from(users)
          .where(eq(users.stripeCustomerId, customerId))
          .limit(1);

        if (!user) {
          console.warn(`[webhook] invoice.payment_succeeded — no user found for customer ${customerId}`);
          break;
        }

        // Only act if access appears revoked (e.g. after a previous invoice.payment_failed)
        if (user.subscriptionStatus === "cancelled" || !user.planLookupKey) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const lookupKey = extractLookupKey(subscription);

          if (lookupKey && (subscription.status === "active" || subscription.status === "trialing")) {
            await updateUserSubscription({
              userId: user.id,
              lookupKey,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
            });
            console.log(`✅ [webhook] invoice.payment_succeeded — access restored for user ${user.id} → ${lookupKey}`);
          }
        } else {
          console.log(`[webhook] invoice.payment_succeeded — user ${user.id} already active, no action needed`);
        }
        break;
      }

      // ── Payment failed: revoke access ────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await cancelUserSubscription(customerId);

        console.warn(`⚠️ [webhook] invoice.payment_failed — access revoked for customer ${customerId}`);
        break;
      }

      // ── Subscription deleted: revoke access + terminate ProCare relationships ──
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const cancelledLookupKey = extractLookupKey(subscription);

        // Look up user BEFORE cancelUserSubscription wipes planLookupKey
        const [affectedUser] = await db
          .select({ id: users.id, planLookupKey: users.planLookupKey, isProCare: users.isProCare })
          .from(users)
          .where(eq(users.stripeCustomerId, customerId))
          .limit(1);

        await cancelUserSubscription(customerId);
        console.log(`⚠️ [webhook] customer.subscription.deleted — access revoked for customer ${customerId}`);

        if (affectedUser) {
          const planKey = cancelledLookupKey ?? affectedUser.planLookupKey ?? "";

          if (CLINICAL_PLAN_KEYS.includes(planKey) && affectedUser.isProCare) {
            console.log(`🔌 [webhook] Clinical cancelled — terminating ProCare client relationships for user ${affectedUser.id}`);
            await terminateProCareRelationships(affectedUser.id, "client");
          } else if (PROCARE_PLAN_KEYS.includes(planKey)) {
            console.log(`🔌 [webhook] ProCare cancelled — terminating all coach relationships for user ${affectedUser.id}`);
            await terminateProCareRelationships(affectedUser.id, "coach");
          }
        }
        break;
      }

      // ── Plan upgrade / downgrade / reactivation ──────────────────────────
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const lookupKey = extractLookupKey(subscription);

        if (!lookupKey) {
          console.log(`[webhook] customer.subscription.updated — no lookup_key on price, skipping`);
          break;
        }

        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.stripeCustomerId, customerId))
          .limit(1);

        if (!user) {
          console.warn(`[webhook] customer.subscription.updated — no user for customer ${customerId}`);
          break;
        }

        if (subscription.status === "active" || subscription.status === "trialing") {
          await updateUserSubscription({
            userId: user.id,
            lookupKey,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
          });
          console.log(`✅ [webhook] customer.subscription.updated — user ${user.id} → ${lookupKey} (${subscription.status})`);
        } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
          await cancelUserSubscription(customerId);
          console.log(`⚠️ [webhook] customer.subscription.updated — user ${user.id} revoked (status: ${subscription.status})`);
        } else {
          console.log(`[webhook] customer.subscription.updated — user ${user.id} status ${subscription.status}, no action`);
        }
        break;
      }

      default:
        console.log(`ℹ️ [webhook] Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error("❌ [webhook] Handler error:", err);
    return res.status(500).send("Webhook handler error");
  }
});

export default router;
