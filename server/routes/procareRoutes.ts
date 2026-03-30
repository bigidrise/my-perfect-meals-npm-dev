import { Router } from "express";
import express from "express";
import { db } from "../db";
import { proAccounts, clientLinks, subscriptions, payouts } from "../db/schema/procare";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  createConnectAccount,
  createAccountLink,
  isAccountActive,
  createCheckoutSession,
  transferToPro,
  constructWebhookEvent,
} from "../services/stripeProcare";
import { endLink, getActiveLink } from "../services/clientLinkService";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { verifyClinicalAccess } from "../utils/verifyClinicalAccess";
import { isOncologySupportEnabled, type OncologySupportContext } from "../services/guardrails/prompt/oncologySupportPromptBuilder";
import { z } from "zod";

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

// GET /api/pro/clients/:clientId/board-control — read current board control setting
router.get("/clients/:clientId/board-control", async (req, res) => {
  try {
    const proUserId = getUserId(req);
    const { clientId } = req.params;
    const [link] = await db
      .select({ mealBoardControl: clientLinks.mealBoardControl })
      .from(clientLinks)
      .where(and(eq(clientLinks.clientUserId, clientId), eq(clientLinks.proUserId, proUserId), eq(clientLinks.active, true)))
      .limit(1);
    if (!link) return res.status(404).json({ error: "No active relationship found with this client" });
    return res.json({ control: link.mealBoardControl });
  } catch (error) {
    console.error("❌ Error reading board control:", error);
    res.status(500).json({ error: "Failed to read board control" });
  }
});

// PATCH /api/pro/clients/:clientId/board-control — set board control ("client" or "professional")
router.patch("/clients/:clientId/board-control", async (req, res) => {
  try {
    const proUserId = getUserId(req);
    const { clientId } = req.params;
    const { control } = req.body as { control: 'client' | 'professional' };
    if (control !== 'client' && control !== 'professional') {
      return res.status(400).json({ error: "control must be 'client' or 'professional'" });
    }
    const [existing] = await db
      .select({ id: clientLinks.id })
      .from(clientLinks)
      .where(and(eq(clientLinks.clientUserId, clientId), eq(clientLinks.proUserId, proUserId), eq(clientLinks.active, true)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "No active relationship found with this client" });
    await db
      .update(clientLinks)
      .set({ mealBoardControl: control })
      .where(eq(clientLinks.id, existing.id));
    console.log(`🔒 Board control for client ${clientId} set to '${control}' by pro ${proUserId}`);
    return res.json({ control });
  } catch (error) {
    console.error("❌ Error setting board control:", error);
    res.status(500).json({ error: "Failed to set board control" });
  }
});

router.post("/end-relationship", async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { clientUserId } = req.body;
    if (!clientUserId) {
      return res.status(400).json({ error: "Missing clientUserId" });
    }

    const proUserId = authUser.id;

    const activeLink = await getActiveLink(clientUserId);
    if (!activeLink || activeLink.proUserId !== proUserId) {
      return res.status(404).json({ error: "No active relationship found with this client" });
    }

    const result = await endLink(clientUserId, proUserId);
    res.json(result);
  } catch (error) {
    console.error("❌ Error ending relationship:", error);
    res.status(500).json({ error: "Failed to end relationship" });
  }
});

// ---------------------------------------------------------------------------
// Cancer Support Nutrition — ProCare Assignment Endpoints
// Feature flag: oncology_support_v1 (ONCOLOGY_SUPPORT_V1 env var)
// Only verified studio owners may read or write a client's oncologySupportContext.
// ---------------------------------------------------------------------------

const oncologySupportSchema = z.object({
  enabled: z.boolean(),
  symptoms: z.array(
    z.enum(["low_appetite", "nausea", "mouth_sensitivity", "fatigue_low_prep", "gi_sensitivity"])
  ),
  emphasis: z.object({
    highProteinNutrientDensity: z.boolean(),
  }),
});

/**
 * GET /api/pro/oncology-support/:clientUserId
 * Retrieve the current Cancer Support Nutrition context for a client.
 * Only accessible by the verified studio owner for this client.
 */
router.get("/oncology-support/:clientUserId", async (req, res) => {
  try {
    if (!isOncologySupportEnabled()) {
      return res.status(404).json({ error: "Feature not available" });
    }

    const requesterId = getUserId(req);
    const { clientUserId } = req.params;

    const hasAccess = await verifyClinicalAccess(requesterId, clientUserId);
    if (!hasAccess) {
      console.warn(`[oncology-support GET] UNAUTHORIZED: ${requesterId} attempted to read oncology context for ${clientUserId}`);
      return res.status(403).json({ error: "You are not authorized to view this client's support context" });
    }

    const rows = await db
      .select({ oncologySupportContext: users.oncologySupportContext })
      .from(users)
      .where(eq(users.id, clientUserId as any))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ oncologySupportContext: rows[0].oncologySupportContext ?? null });
  } catch (error: any) {
    console.error("[oncology-support GET]", error);
    res.status(500).json({ error: "Failed to retrieve oncology support context" });
  }
});

/**
 * PUT /api/pro/oncology-support/:clientUserId
 * Assign or update a Cancer Support Nutrition context for a client.
 * Only accessible by the verified studio owner for this client.
 *
 * Body: { enabled, symptoms[], emphasis: { highProteinNutrientDensity } }
 *
 * To disable: send { enabled: false, symptoms: [], emphasis: { highProteinNutrientDensity: false } }
 */
router.put("/oncology-support/:clientUserId", async (req, res) => {
  try {
    if (!isOncologySupportEnabled()) {
      return res.status(404).json({ error: "Feature not available" });
    }

    const requesterId = getUserId(req);
    const { clientUserId } = req.params;

    const hasAccess = await verifyClinicalAccess(requesterId, clientUserId);
    if (!hasAccess) {
      console.warn(`[oncology-support PUT] UNAUTHORIZED: ${requesterId} attempted to write oncology context for ${clientUserId}`);
      return res.status(403).json({ error: "You are not authorized to update this client's support context" });
    }

    const body = oncologySupportSchema.parse(req.body);

    const context: OncologySupportContext = {
      ...body,
      source: "physician",
      updatedBy: requesterId,
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(users)
      .set({ oncologySupportContext: context as any, updatedAt: new Date() })
      .where(eq(users.id, clientUserId as any));

    console.log(`[oncology-support PUT] Physician ${requesterId} ${body.enabled ? "assigned" : "disabled"} Cancer Support Nutrition for client ${clientUserId}. Symptoms: [${body.symptoms.join(", ")}]`);

    res.json({ ok: true, oncologySupportContext: context });
  } catch (error: any) {
    console.error("[oncology-support PUT]", error);
    res.status(400).json({ error: "Failed to update oncology support context", detail: error?.message });
  }
});

export default router;
