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

        const subscriptionType = metadata.subscriptionType ?? "individual";
        const seatCount = metadata.seatCount ? Number(metadata.seatCount) : 1;

        await updateUserSubscription({
          userId,
          lookupKey: sku,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });

        if (subscriptionType === "business_seat") {
          const { businesses, businessMembers } = await import("../db/schema/business");
          const { eq: eqBiz, sql: drizzleSql } = await import("drizzle-orm");

          // ── Step 1: Create or update the Business record ─────────────────
          let bizId = "";
          let orgName = "";
          try {
            const [existing] = await db.select().from(businesses).where(eqBiz(businesses.ownerUserId, userId)).limit(1);

            if (!existing) {
              // Atomic: business row + owner membership in one transaction so partial failure
              // leaves no orphaned record. Replay enters the existing branch and repairs.
              await db.transaction(async (tx) => {
                const [newBiz] = await tx.insert(businesses).values({
                  name: "My Business Team",
                  ownerUserId: userId,
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: subscriptionId,
                  plan: sku,
                  seatLimit: seatCount,
                  status: "active",
                }).returning();
                await tx.insert(businessMembers).values({
                  businessId: newBiz.id,
                  userId,
                  role: "owner",
                  status: "active",
                });
                bizId = newBiz.id;
                orgName = newBiz.name;
              });
              console.log(`✅ [webhook] Business created | id=${bizId} | owner=${userId} | seats=${seatCount}`);
            } else {
              // Guard: if the org is already active under a DIFFERENT subscription, this
              // checkout session is a stale/unauthorized duplicate — ignore it to protect
              // the existing billing state.
              const isIntendedSubscription =
                existing.status === "pending_billing" ||
                existing.stripeSubscriptionId === subscriptionId ||
                existing.stripeSubscriptionId === null;

              if (!isIntendedSubscription) {
                console.warn(
                  `⚠️ [webhook] Ignoring checkout for already-active org with mismatched subscription | ` +
                  `bizId=${existing.id} | existingSub=${existing.stripeSubscriptionId} | newSub=${subscriptionId}`,
                );
                // Skip further processing — do not overwrite billing state or send email
                break;
              }

              // Update core fields and repair missing owner membership in one transaction
              await db.transaction(async (tx) => {
                await tx.update(businesses).set({
                  seatLimit: seatCount,
                  stripeSubscriptionId: subscriptionId,
                  stripeCustomerId: customerId,
                  status: "active",
                  updatedAt: new Date(),
                }).where(eqBiz(businesses.id, existing.id));
                const [ownerMember] = await tx
                  .select({ id: businessMembers.id })
                  .from(businessMembers)
                  .where(drizzleSql`business_id = ${existing.id} AND user_id = ${userId}`)
                  .limit(1);
                if (!ownerMember) {
                  await tx.insert(businessMembers).values({
                    businessId: existing.id,
                    userId,
                    role: "owner",
                    status: "active",
                  });
                  console.log(`🔧 [webhook] Repaired missing owner membership | bizId=${existing.id} | owner=${userId}`);
                }
              });
              bizId = existing.id;
              orgName = existing.name;
              console.log(`✅ [webhook] Business updated | id=${bizId} | seats=${seatCount}`);
            }
          } catch (bizErr) {
            // Propagate so the outer handler returns 500 and Stripe retries the event
            console.error("❌ [webhook] Business creation/update failed:", bizErr);
            throw bizErr;
          }

          // ── Step 2: Welcome email — two-column idempotency ──────────────────
          //
          // welcomeEmailKey  — stable UUID written once before the first send attempt and
          //                    NEVER cleared. Passed to Resend as the idempotency key so
          //                    Resend deduplicates concurrent and retried requests on its end.
          //
          // welcomeEmailSentAt — written ONLY after sendBusinessWelcomeEmail returns true.
          //                      Checked first; if already set, the whole block is skipped.
          //
          // On failure: welcomeEmailKey stays set (next Stripe replay reuses it → Resend
          // deduplicates), welcomeEmailSentAt stays null, and we throw so the outer handler
          // returns 500 and Stripe retries. No-email-address case returns 200 — retrying
          // can't help if the owner has no address.
          if (bizId) {
            // Skip if already confirmed delivered
            const [current] = await db
              .select({ welcomeEmailSentAt: businesses.welcomeEmailSentAt, welcomeEmailKey: businesses.welcomeEmailKey } as any)
              .from(businesses)
              .where(eqBiz(businesses.id, bizId))
              .limit(1) as any[];

            if ((current as any)?.welcomeEmailSentAt) {
              console.log(`ℹ️ [webhook] Business welcome email already confirmed for bizId=${bizId} — skipping`);
            } else {
              // Atomically write the stable provider idempotency key (set once, never cleared)
              await db
                .update(businesses)
                .set({ welcomeEmailKey: drizzleSql`gen_random_uuid()::text` } as any)
                .where(drizzleSql`id = ${bizId} AND welcome_email_key IS NULL`);

              // Read back whichever key is now set (ours or a prior concurrent attempt's)
              const [withKey] = await db
                .select({ key: (businesses as any).welcomeEmailKey })
                .from(businesses)
                .where(eqBiz(businesses.id, bizId))
                .limit(1) as any[];

              const providerKey: string | null = (withKey as any)?.key ?? null;

              const { sendBusinessWelcomeEmail } = await import("../services/emailService");
              const [owner] = await db
                .select({ email: users.email, firstName: users.firstName })
                .from(users)
                .where(eqBiz(users.id, userId))
                .limit(1);

              if (!owner?.email) {
                console.warn(`[webhook] No email address for owner ${userId} — welcome email skipped | bizId=${bizId}`);
              } else {
                const APP_URL = process.env.PUBLIC_APP_URL || "https://app.myperfectmeals.ai";
                const sent = await sendBusinessWelcomeEmail({
                  to: owner.email,
                  ownerName: owner.firstName || "there",
                  orgName,
                  seatCount,
                  dashboardUrl: `${APP_URL}/business-dashboard`,
                  idempotencyKey: providerKey ?? undefined,
                });

                if (sent) {
                  // Mark confirmed delivery — only now is the email considered sent
                  await db
                    .update(businesses)
                    .set({ welcomeEmailSentAt: new Date() } as any)
                    .where(eqBiz(businesses.id, bizId));
                  console.log(`✅ [webhook] Business welcome email delivered | bizId=${bizId}`);
                } else {
                  // welcomeEmailKey stays set so the next Stripe replay reuses the same
                  // Resend idempotency key and Resend deduplicates at the provider level.
                  throw new Error(`[webhook] Welcome email delivery failed for bizId=${bizId} — Stripe will retry`);
                }
              }
            }
          }

          console.log(
            `✅ [webhook] checkout.session.completed — business_seat | user ${userId} → ${sku} | seats=${seatCount} | total=$${(44.99 * seatCount).toFixed(2)}/mo`,
          );
        } else {
          console.log(`✅ [webhook] checkout.session.completed — user ${userId} → ${sku}`);
        }
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

            // CONVENTION NOTE — business membership reactivation:
            // This handler currently restores access only on the `users` table
            // (planLookupKey, accessTier) via updateUserSubscription.  It does NOT
            // auto-reactivate a businessMembers row that was previously set to
            // status="removed" by the owner or an automated cleanup job.
            //
            // If a future change adds logic to flip a businessMembers row back to
            // status="active" here (e.g. to auto-restore a lapsed-then-renewed
            // business member), that code MUST also call:
            //
            //   await clearRemovalNotice(db, userId, businessId);
            //
            // which is defined in server/routes/businessRoutes.ts.  Failure to do
            // so will leave the stale removal-notice banner visible to the
            // reactivated member.  The same rule applies to any other webhook
            // event handler (customer.subscription.updated, etc.) that may one
            // day write status="active" to businessMembers.
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

          // Sync seat count for business subscriptions when quantity changes
          if (lookupKey === "clinical_business_monthly") {
            try {
              const { businesses } = await import("../db/schema/business");
              const newQty = subscription.items.data[0]?.quantity ?? null;
              if (newQty !== null && newQty > 0) {
                await db
                  .update(businesses)
                  .set({ seatLimit: newQty, updatedAt: new Date() })
                  .where(eq(businesses.ownerUserId, user.id));
                console.log(`✅ [webhook] business seatLimit synced → ${newQty} | owner=${user.id}`);
              }
            } catch (seatErr) {
              console.error("❌ [webhook] failed to sync business seatLimit:", seatErr);
            }
          }
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
