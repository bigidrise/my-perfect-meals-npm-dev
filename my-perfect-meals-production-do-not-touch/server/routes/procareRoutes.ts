import { Router } from "express";
import express from "express";
import { db } from "../db";
import { proAccounts, clientLinks, subscriptions, payouts } from "../db/schema/procare";
import { eq, and } from "drizzle-orm";
import {
  createConnectAccount,
  createAccountLink,
  isAccountActive,
  createCheckoutSession,
  transferToPro,
  constructWebhookEvent,
} from "../services/stripeProcare";

const router = Router();

function getUserId(req: any): string {
  if (req.session?.userId) return req.session.userId as string;
  const headerUserId = req.headers["x-user-id"] as string;
  if (headerUserId) return headerUserId;
  return "00000000-0000-0000-0000-000000000001";
}

/**
 * POST /api/pro/onboard
 * Create Stripe Connect onboarding link for pros
 */
router.post("/onboard", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { returnUrl, email } = req.body;

    // Check if pro account already exists
    const [existing] = await db
      .select()
      .from(proAccounts)
      .where(eq(proAccounts.userId, userId));

    let stripeAccountId: string;

    if (existing) {
      stripeAccountId = existing.stripeAccountId;
      
      // Check if already active
      const active = await isAccountActive(stripeAccountId);
      if (active) {
        await db
          .update(proAccounts)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(proAccounts.userId, userId));
      }
    } else {
      // Create new Stripe Connect account
      stripeAccountId = await createConnectAccount(email);
      
      // Save to database
      await db.insert(proAccounts).values({
        userId,
        stripeAccountId,
        status: "pending",
      });
    }

    // Generate onboarding link
    const appUrl = process.env.APP_URL 
      || (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null)
      || "http://localhost:5000";
    
    const refreshUrl = `${appUrl}/pro/onboarding/refresh`;
    const finalReturnUrl = returnUrl || `${appUrl}/pro/onboarding/complete`;

    const onboardingUrl = await createAccountLink(
      stripeAccountId,
      refreshUrl,
      finalReturnUrl
    );

    res.json({ url: onboardingUrl });
  } catch (error) {
    console.error("❌ Error creating onboarding link:", error);
    res.status(500).json({ error: "Failed to create onboarding link" });
  }
});

/**
 * POST /api/checkout/session
 * Create subscription checkout session for clients
 */
router.post("/checkout/session", async (req, res) => {
  try {
    const clientUserId = getUserId(req);
    const { successUrl, cancelUrl, email } = req.body;

    // Find the client's active pro link
    const [link] = await db
      .select()
      .from(clientLinks)
      .where(
        and(
          eq(clientLinks.clientUserId, clientUserId),
          eq(clientLinks.active, true)
        )
      );

    if (!link) {
      return res.status(400).json({ error: "No active pro link found" });
    }

    // Check if pro account is active
    const [pro] = await db
      .select()
      .from(proAccounts)
      .where(eq(proAccounts.userId, link.proUserId));

    if (!pro || pro.status !== "active") {
      return res.status(400).json({ error: "Pro account not active" });
    }

    // Create Stripe checkout session
    const appUrl = process.env.APP_URL 
      || (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null)
      || "http://localhost:5000";

    // Use test price or configured price
    const priceId = process.env.STRIPE_PRICE_ID || "price_test_2999";

    const checkoutUrl = await createCheckoutSession({
      clientEmail: email,
      clientUserId,
      proUserId: link.proUserId,
      successUrl: successUrl || `${appUrl}/billing/success`,
      cancelUrl: cancelUrl || `${appUrl}/billing/cancel`,
      priceId,
    });

    res.json({ url: checkoutUrl });
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhooks for payment events and auto-transfer $10 to pros
 * Note: Must use raw body for signature verification
 */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("❌ Missing STRIPE_WEBHOOK_SECRET");
    return res.status(400).send("Webhook secret not configured");
  }

  try {
    const event = constructWebhookEvent(req.body, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const { clientUserId, proUserId } = session.metadata;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Save subscription
        await db.insert(subscriptions).values({
          clientUserId,
          proUserId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          planCode: "mpm_pro_2999",
          status: "active",
        });

        console.log(`✅ Subscription created for client ${clientUserId}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;

        // Find the subscription
        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

        if (!sub) {
          console.log(`⚠️ No subscription found for ${subscriptionId}`);
          break;
        }

        // Get pro account
        const [pro] = await db
          .select()
          .from(proAccounts)
          .where(eq(proAccounts.userId, sub.proUserId));

        if (!pro || pro.status !== "active") {
          console.log(`⚠️ Pro account not active for ${sub.proUserId}`);
          break;
        }

        // Transfer $10 to pro
        const transferId = await transferToPro(
          pro.stripeAccountId,
          1000, // $10.00
          `ProCare share for client ${sub.clientUserId}`
        );

        // Record payout
        await db.insert(payouts).values({
          subscriptionId: sub.id,
          proUserId: sub.proUserId,
          amountCents: 1000,
          currency: "usd",
          stripeTransferId: transferId,
          status: "succeeded",
        });

        console.log(`✅ Transferred $10 to pro ${sub.proUserId} (${transferId})`);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const stripeSubId = subscription.id;
        const status = subscription.status;

        await db
          .update(subscriptions)
          .set({
            status: status === "active" ? "active" : status === "past_due" ? "past_due" : "canceled",
            currentPeriodEnd: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

        console.log(`✅ Updated subscription ${stripeSubId} to status: ${status}`);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("❌ Webhook error:", error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

export default router;
