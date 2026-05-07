import { Router } from "express";
import Stripe from "stripe";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  updateUserSubscription,
  cancelUserSubscription,
} from "../services/subscriptionService";
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

      // ── Subscription deleted: revoke access ──────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await cancelUserSubscription(customerId);

        console.log(`⚠️ [webhook] customer.subscription.deleted — access revoked for customer ${customerId}`);
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
