import { Router } from "express";
import express from "express";
import { db } from "../db";
import { proAccounts, clientLinks, subscriptions, payouts } from "../db/schema/procare";
import { users, userGlycemicSettings, glp1Shots } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { diabetesProfile, glucoseLogs } from "../../shared/diabetes-schema";
import {
  createConnectAccount,
  createAccountLink,
  isAccountActive,
  createCheckoutSession,
  transferToPro,
  constructWebhookEvent,
} from "../services/stripeProcare";
import { endLink, getActiveLink } from "../services/clientLinkService";
import { deactivateProCareClient } from "../services/procareActivation";
import { studios } from "../db/schema/studio";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireWorkspaceAccess, WorkspaceRequest } from "../middleware/requireWorkspaceAccess";
import { getWeekBoard, upsertWeekBoard } from "../data/weekBoardsRepo";
import { getWeekStartISO } from "../utils/week";
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
    const proUserId = (req as AuthenticatedRequest).authUser?.id;
    if (!proUserId) return res.status(401).json({ error: "Authentication required" });
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
    const proUserId = (req as AuthenticatedRequest).authUser?.id;
    if (!proUserId) return res.status(401).json({ error: "Authentication required" });
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

    const requesterId = (req as AuthenticatedRequest).authUser?.id;
    if (!requesterId) return res.status(401).json({ error: "Authentication required" });
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

    // Look up the physician's display name for the ownership trail
    const [physician] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
      .from(users)
      .where(eq(users.id, requesterId as any))
      .limit(1);

    const ownerName = physician
      ? (physician.firstName && physician.lastName
          ? `${physician.firstName} ${physician.lastName}`
          : physician.firstName || physician.username || "Your Physician")
      : null;

    const context: OncologySupportContext = {
      ...body,
      source: "physician",
      // locked = true while enabled + physician is active; false when disabling
      locked: body.enabled,
      ownerName,
      updatedBy: requesterId,
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(users)
      .set({ oncologySupportContext: context as any, updatedAt: new Date() })
      .where(eq(users.id, clientUserId as any));

    console.log(`[oncology-support PUT] Physician ${requesterId} (${ownerName ?? "unknown"}) ${body.enabled ? "assigned" : "disabled"} Cancer Support Nutrition for client ${clientUserId}. Symptoms: [${body.symptoms.join(", ")}]`);

    res.json({ ok: true, oncologySupportContext: context });
  } catch (error: any) {
    console.error("[oncology-support PUT]", error);
    res.status(400).json({ error: "Failed to update oncology support context", detail: error?.message });
  }
});

// ─── GLP-1 Protocol — Physician Assignment ────────────────────────────────────

/**
 * GET /api/pro/glp1-protocol/:clientUserId
 * Read whether GLP-1 protocol is physician-assigned for a client.
 */
router.get("/glp1-protocol/:clientUserId", async (req, res) => {
  try {
    const requesterId = getUserId(req);
    const { clientUserId } = req.params;

    const hasAccess = await verifyClinicalAccess(requesterId, clientUserId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const [row] = await db
      .select({ medicalConditions: users.medicalConditions })
      .from(users)
      .where(eq(users.id, clientUserId as any))
      .limit(1);

    const mc: string[] = Array.isArray(row?.medicalConditions) ? row.medicalConditions as string[] : [];
    res.json({ glp1Active: mc.includes("glp1"), medicalConditions: mc });
  } catch (error: any) {
    console.error("[glp1-protocol GET]", error);
    res.status(500).json({ error: "Failed to retrieve GLP-1 protocol status" });
  }
});

/**
 * PUT /api/pro/glp1-protocol/:clientUserId
 * Physician-only: assign or remove GLP-1 Active from a client's medicalConditions.
 * Body: { enabled: boolean }
 *
 * Preserves all other medicalConditions values — only toggles 'glp1'.
 * The protocol envelope reads medicalConditions and stacks GLP-1 guidance
 * automatically on the next meal generation call.
 */
router.put("/glp1-protocol/:clientUserId", async (req, res) => {
  try {
    const requesterId = getUserId(req);
    const { clientUserId } = req.params;

    const hasAccess = await verifyClinicalAccess(requesterId, clientUserId);
    if (!hasAccess) {
      console.warn(`[glp1-protocol PUT] UNAUTHORIZED: ${requesterId} attempted to write GLP-1 protocol for ${clientUserId}`);
      return res.status(403).json({ error: "You are not authorized to update this client's protocol" });
    }

    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }

    // Physician name for audit trail
    const [physician] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
      .from(users)
      .where(eq(users.id, requesterId as any))
      .limit(1);

    const ownerName = physician
      ? (physician.firstName && physician.lastName
          ? `${physician.firstName} ${physician.lastName}`
          : physician.firstName || physician.username || "Your Physician")
      : null;

    // Toggle 'glp1' — preserve all other medicalConditions values
    const [clientRow] = await db
      .select({ medicalConditions: users.medicalConditions })
      .from(users)
      .where(eq(users.id, clientUserId as any))
      .limit(1);

    const existing: string[] = Array.isArray(clientRow?.medicalConditions) ? clientRow.medicalConditions as string[] : [];
    const withoutGlp1 = existing.filter((v: string) => v !== "glp1");
    const updated = enabled ? [...withoutGlp1, "glp1"] : withoutGlp1;

    await db
      .update(users)
      .set({ medicalConditions: updated as any, updatedAt: new Date() })
      .where(eq(users.id, clientUserId as any));

    console.log(`[glp1-protocol PUT] Physician ${requesterId} (${ownerName ?? "unknown"}) ${enabled ? "assigned" : "removed"} GLP-1 Active for client ${clientUserId}`);
    res.json({ ok: true, glp1Active: enabled, medicalConditions: updated });
  } catch (error: any) {
    console.error("[glp1-protocol PUT]", error);
    res.status(500).json({ error: "Failed to update GLP-1 protocol", detail: error?.message });
  }
});

// ─── Workspace-Aware Board Endpoints (T002) ───────────────────────────────────
// Architecture: actorUserId = req.authUser.id (pro), workspaceUserId = :clientId (client)
// requireWorkspaceAccess validates the active clientLinks relationship before any data is served.

// GET /api/pro/week-boards/:clientId/current-week — client's current week board
router.get("/week-boards/:clientId/current-week", requireWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceUserId } = (req as WorkspaceRequest).workspace;
    const builderType = (req.query.bt as string | undefined) ?? "";
    const weekStartISO = getWeekStartISO();
    const board = await getWeekBoard(workspaceUserId, weekStartISO, builderType);
    return res.json({ week: board ?? null, weekStartISO });
  } catch (error) {
    console.error("[workspace] GET current-week error:", error);
    res.status(500).json({ error: "Failed to load client board" });
  }
});

// GET /api/pro/week-board/:clientId/:weekStartISO — client's board for a specific week
router.get("/week-board/:clientId/:weekStartISO", requireWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceUserId } = (req as WorkspaceRequest).workspace;
    const { weekStartISO } = req.params;
    const builderType = (req.query.bt as string | undefined) ?? "";
    const board = await getWeekBoard(workspaceUserId, weekStartISO, builderType);
    return res.json({ week: board ?? null, weekStartISO });
  } catch (error) {
    console.error("[workspace] GET week-board error:", error);
    res.status(500).json({ error: "Failed to load client board" });
  }
});

// PUT /api/pro/week-board/:clientId/:weekStartISO — save to client's board
router.put("/week-board/:clientId/:weekStartISO", requireWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceUserId, boardLocked } = (req as WorkspaceRequest).workspace;
    const { weekStartISO } = req.params;
    const builderType = (req.query.bt as string | undefined) ?? "";
    const { week } = req.body as { week: any };

    if (!week) {
      return res.status(400).json({ error: "Missing week data" });
    }

    // If board is in client-controlled mode, only the pro can still write because
    // the pro is the actor here. Board lock only restricts the CLIENT from writing.
    const saved = await upsertWeekBoard(workspaceUserId, weekStartISO, week, builderType);
    console.log(`[workspace] Pro ${(req as WorkspaceRequest).workspace.actorUserId} saved board for client ${workspaceUserId} (week ${weekStartISO}, bt=${builderType || "none"})`);
    return res.json({ week: saved, weekStartISO, boardLocked });
  } catch (error) {
    console.error("[workspace] PUT week-board error:", error);
    res.status(500).json({ error: "Failed to save client board" });
  }
});

// ─── Workspace-Aware Board Lock Status (T003) ─────────────────────────────────
// GET /api/pro/clients/:clientId/board-lock — client's board lock state (pro perspective)
// Replaces /api/me/board-lock when a pro is operating inside a client workspace.
router.get("/clients/:clientId/board-lock", requireWorkspaceAccess, async (req, res) => {
  try {
    const { boardLocked } = (req as WorkspaceRequest).workspace;
    return res.json({ locked: boardLocked });
  } catch (error) {
    console.error("[workspace] GET board-lock error:", error);
    res.status(500).json({ error: "Failed to read board lock status" });
  }
});

// ─── ProCare Connection Status ─────────────────────────────────────────────────
// GET /api/pro/connection-status — returns the caller's active ProCare connection
// Used by the More page to show connected-state card vs. code-input card.
router.get("/connection-status", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const [activeLink] = await db
      .select({
        proUserId: clientLinks.proUserId,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        professionalRole: users.professionalRole,
      })
      .from(clientLinks)
      .innerJoin(users, eq(users.id, clientLinks.proUserId))
      .where(and(eq(clientLinks.clientUserId, userId), eq(clientLinks.active, true)));

    if (!activeLink) {
      return res.json({ connected: false });
    }

    const [studio] = await db
      .select({ id: studios.id, name: studios.name, type: studios.type })
      .from(studios)
      .where(eq(studios.ownerUserId, activeLink.proUserId));

    const providerName = activeLink.firstName && activeLink.lastName
      ? `${activeLink.firstName} ${activeLink.lastName}`
      : activeLink.firstName || activeLink.username || "Your Provider";

    return res.json({
      connected: true,
      provider: {
        userId: activeLink.proUserId,
        name: providerName,
        role: activeLink.professionalRole || "trainer",
        studioName: studio?.name || null,
        studioId: studio?.id || null,
      },
    });
  } catch (error) {
    console.error("❌ [connection-status] Error:", error);
    res.status(500).json({ error: "Failed to fetch connection status" });
  }
});

// ─── Client Self-Disconnect ─────────────────────────────────────────────────────
// POST /api/pro/disconnect-self — authenticated client disconnects from their provider
router.post("/disconnect-self", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const [activeLink] = await db
      .select()
      .from(clientLinks)
      .where(and(eq(clientLinks.clientUserId, userId), eq(clientLinks.active, true)));

    if (!activeLink) {
      return res.status(404).json({ error: "No active ProCare connection found" });
    }

    await deactivateProCareClient(userId, activeLink.proUserId, userId, "client_self_disconnect");

    return res.json({ success: true, disconnectedFrom: activeLink.proUserId });
  } catch (error) {
    console.error("❌ [disconnect-self] Error:", error);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pro/clients/:clientId/nutrition-strategy
// Returns active hub configuration, guardrails, and glucose trend for a client.
// Role-gated: physicians see insulin + GLP-1 dose + medications; coaches do not.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/clients/:clientId/nutrition-strategy", async (req: any, res) => {
  try {
    const callerId = getUserId(req);
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({ error: "clientId required" });
    }

    // Verify caller is a professional linked to this client (or an admin)
    const [callerUser] = await db
      .select({ role: users.role, professionalRole: users.professionalRole })
      .from(users)
      .where(eq(users.id, callerId))
      .limit(1);

    const isAdmin = callerUser?.role === "admin";
    const isPhysician = callerUser?.professionalRole === "physician";

    if (!isAdmin) {
      // Must be a coach/trainer/physician with an active link to this client
      const [link] = await db
        .select()
        .from(clientLinks)
        .where(and(eq(clientLinks.proUserId, callerId), eq(clientLinks.clientUserId, clientId), eq(clientLinks.active, true)))
        .limit(1);

      if (!link) {
        return res.status(403).json({ error: "No active ProCare link to this client" });
      }
    }

    // ── Parallel data fetch ────────────────────────────────────────────────
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [diabeticProfile, glycemicRow, recentGlucose, lastShot] = await Promise.all([
      db.select().from(diabetesProfile).where(eq(diabetesProfile.userId, clientId)).limit(1).then(r => r[0] ?? null),
      db.select({ preferredCarbs: userGlycemicSettings.preferredCarbs })
        .from(userGlycemicSettings)
        .where(eq(userGlycemicSettings.userId, clientId))
        .limit(1)
        .then(r => r[0] ?? null),
      db.select()
        .from(glucoseLogs)
        .where(and(eq(glucoseLogs.userId, clientId), gte(glucoseLogs.recordedAt, fourteenDaysAgo)))
        .orderBy(desc(glucoseLogs.recordedAt))
        .limit(20),
      db.select()
        .from(glp1Shots)
        .where(eq(glp1Shots.userId, clientId))
        .orderBy(desc(glp1Shots.dateUtc))
        .limit(1)
        .then(rows => rows[0] ?? null)
    ]);

    // ── Determine active hubs ──────────────────────────────────────────────
    const hasDiabeticHub = diabeticProfile && diabeticProfile.type !== "NONE";
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const hasGlp1Hub = lastShot && new Date(lastShot.dateUtc) > thirtyDaysAgo;

    if (!hasDiabeticHub && !hasGlp1Hub) {
      return res.json({ hasData: false });
    }

    // ── Guardrails (from diabetes profile) ────────────────────────────────
    const guardrails = diabeticProfile?.guardrails as any;
    const dailyCarbLimit = guardrails?.carbLimit ?? null;
    const mealFrequency = Math.max(1, guardrails?.mealFrequency ?? 3);
    const perMealCarbCeiling = dailyCarbLimit ? Math.round(dailyCarbLimit / mealFrequency) : null;
    const preferredCarbs: string[] = (glycemicRow?.preferredCarbs as string[]) ?? [];

    // ── Glucose trend analysis ─────────────────────────────────────────────
    const glucoseValues = recentGlucose.map(g => g.valueMgdl);
    const avgGlucose = glucoseValues.length
      ? Math.round(glucoseValues.reduce((s, v) => s + v, 0) / glucoseValues.length)
      : null;

    let trendLabel: "Stable" | "Elevated" | "High variability" | null = null;
    if (glucoseValues.length >= 3) {
      const mean = avgGlucose!;
      const variance = glucoseValues.reduce((s, v) => s + (v - mean) ** 2, 0) / glucoseValues.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > 45) trendLabel = "High variability";
      else if (mean > 180) trendLabel = "Elevated";
      else trendLabel = "Stable";
    }

    // Sparkline — last 14 readings, oldest first for chart direction
    const sparkline = recentGlucose
      .slice(0, 14)
      .reverse()
      .map(g => ({
        value: g.valueMgdl,
        date: new Date(g.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        context: g.context,
      }));

    // Physician-only: insulin pattern
    let insulinPattern: { avgUnits: number | null; readings: number } | null = null;
    if (isPhysician) {
      const insulinLogs = recentGlucose.filter(g => g.insulinUnits !== null && g.insulinUnits !== undefined);
      if (insulinLogs.length > 0) {
        const total = insulinLogs.reduce((s, g) => s + parseFloat(String(g.insulinUnits ?? 0)), 0);
        insulinPattern = { avgUnits: Math.round((total / insulinLogs.length) * 10) / 10, readings: insulinLogs.length };
      } else {
        insulinPattern = { avgUnits: null, readings: 0 };
      }
    }

    // ── Strategy summary line ──────────────────────────────────────────────
    const parts: string[] = [];
    if (hasDiabeticHub && hasGlp1Hub) {
      parts.push("Dual protocol — GLP-1 phase management with diabetic carb control");
    } else if (hasDiabeticHub) {
      if (trendLabel === "High variability") parts.push("Active glucose management — tightened carb protocol");
      else if (trendLabel === "Elevated") parts.push("Elevated glucose — reduced carb focus");
      else parts.push("Stable diabetic management — moderate carb control");
    } else if (hasGlp1Hub) {
      parts.push("GLP-1 phase management — small portions, high protein priority");
    }
    if (diabeticProfile?.hypoHistory) parts.push("with hypoglycemia precautions");
    const strategySummary = parts.join(" ");

    // ── Build response ─────────────────────────────────────────────────────
    const payload: Record<string, unknown> = {
      hasData: true,
      activeHubs: [
        ...(hasDiabeticHub ? ["diabetic"] : []),
        ...(hasGlp1Hub ? ["glp1"] : []),
      ],
      diabetic: hasDiabeticHub ? {
        type: diabeticProfile!.type,
        a1cPercent: diabeticProfile?.a1cPercent ?? null,
        hypoRisk: diabeticProfile?.hypoHistory ?? false,
        perMealCarbCeiling,
        mealFrequency,
        preferredCarbs,
      } : null,
      glp1: hasGlp1Hub ? {
        lastShotDate: lastShot!.dateUtc,
        daysSinceShot: Math.floor((Date.now() - new Date(lastShot!.dateUtc).getTime()) / (1000 * 60 * 60 * 24)),
        ...(isPhysician ? { doseMg: lastShot!.doseMg, injectionSite: lastShot!.location } : {}),
      } : null,
      glucose: {
        sparkline,
        avgMgdl: avgGlucose,
        trendLabel,
        readingCount: recentGlucose.length,
      },
      strategySummary,
    };

    // Physician-only additions
    if (isPhysician) {
      payload.physicianOnly = {
        insulinPattern,
        medications: diabeticProfile?.medications ?? [],
      };
    }

    console.log(`📊 [nutrition-strategy] Returned data for client ${clientId.substring(0, 8)}... | caller=${isPhysician ? "physician" : "coach"} | hubs=${(payload.activeHubs as string[]).join(",")}`);
    return res.json(payload);

  } catch (error) {
    console.error("❌ [nutrition-strategy] Error:", error);
    return res.status(500).json({ error: "Failed to fetch nutrition strategy" });
  }
});

export default router;
