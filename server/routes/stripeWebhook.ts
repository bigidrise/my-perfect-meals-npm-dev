import { Router } from "express";
import Stripe from "stripe";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  updateUserSubscription,
  cancelUserSubscription,
  resolveSubscriptionUser,
  resolveStripeEventUser,
} from "../services/subscriptionService";
import { clientLinks } from "../db/schema/procare";
import { businesses } from "../db/schema/business";
import { deactivateProCareClient } from "../services/procareActivation";
import type { LookupKey } from "../../client/src/data/planSkus";
import { isProCarePlanKey } from "@shared/planFeatures";
import {
  claimBillingEvent,
  completeBillingEvent,
  failBillingEvent,
} from "../services/stripeBillingEventService";
import { planFromSubscription } from "../services/stripePlanCatalog";
import { assertStripeBillingOwnership } from "../services/stripeRuntimePolicy";

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
function eventRank(type: string): number {
  switch (type) {
    case "customer.subscription.deleted": return 100;
    case "invoice.payment_failed": return 85;
    case "customer.subscription.updated": return 75;
    case "invoice.payment_succeeded": return 65;
    case "customer.subscription.created": return 55;
    case "checkout.session.completed": return 50;
    default: return 0;
  }
}

function stripeObjectId(value: string | { id: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function storesAsPersonalPlan(planLookupKey: string): boolean {
  return planLookupKey !== "clinical_business_monthly";
}

async function syncBusinessBillingState(input: {
  ownerUserId: string;
  subscriptionId: string;
  status: "active" | "cancelled" | "past_due";
  seatLimit?: number | null;
}): Promise<void> {
  const update: {
    status: "active" | "cancelled" | "past_due";
    updatedAt: Date;
    seatLimit?: number;
  } = {
    status: input.status,
    updatedAt: new Date(),
  };
  if (input.seatLimit != null && input.seatLimit > 0) {
    update.seatLimit = input.seatLimit;
  }

  await db
    .update(businesses)
    .set(update)
    .where(and(
      eq(businesses.ownerUserId, input.ownerUserId),
      eq(businesses.stripeSubscriptionId, input.subscriptionId),
    ));

  // Deliberately do not mutate businessMembers here. Billing recovery restores
  // organization availability only; removed members may be restored solely by
  // the explicit clearRemovalNotice flow in businessRoutes.ts.
}

function eventObjectIdentity(event: Stripe.Event): {
  customerId: string | null;
  subscriptionId: string | null;
  userId: string | null;
} {
  const object = event.data.object as any;
  const customerId = typeof object.customer === "string"
    ? object.customer
    : object.customer?.id ?? null;
  const subscriptionId = object.object === "subscription"
    ? object.id
    : typeof object.subscription === "string"
      ? object.subscription
      : object.subscription?.id ?? null;
  return {
    customerId,
    subscriptionId,
    userId: object.metadata?.userId ?? null,
  };
}

const CLINICAL_PLAN_KEYS = ["mpm_ultimate", "mpm_ultimate_monthly", "mpm_ultimate_plan_2999"];

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
    assertStripeBillingOwnership(process.env.STRIPE_SECRET_KEY ?? "");
  } catch (error) {
    console.error("[webhook] Refusing live billing event outside production owner");
    return res.status(503).send("Stripe billing runtime is not authorized");
  }

  const identity = eventObjectIdentity(event);
  const claim = await claimBillingEvent({
    eventId: event.id,
    eventType: event.type,
    eventCreatedAt: new Date(event.created * 1000),
    customerId: identity.customerId,
    subscriptionId: identity.subscriptionId,
    userId: identity.userId,
    source: "webhook",
  });
  if (claim === "duplicate") {
    return res.json({ received: true, duplicate: true });
  }

  let processedUserId: string | null = identity.userId;
  let eventWasHandled = true;
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

        const subscriptionId = stripeObjectId(session.subscription as any);
        const customerId = stripeObjectId(session.customer as any);
        if (!subscriptionId || !customerId) {
          throw new Error("Completed checkout is missing subscription or customer identity");
        }
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (subscription.metadata?.userId !== userId) {
          throw new Error("Completed checkout subscription identity does not match the MPM user");
        }
        const trustedPlan = planFromSubscription(subscription, sku);
        if (!trustedPlan) {
          throw new Error("Completed checkout price is not mapped to the supplied trusted SKU");
        }
        if (subscription.status !== "active" && subscription.status !== "trialing") {
          throw new Error(`Completed checkout subscription is not active (${subscription.status})`);
        }

        const subscriptionType = metadata.subscriptionType ?? "individual";
        const seatCount = metadata.seatCount ? Number(metadata.seatCount) : 1;

        const mutationResult = await updateUserSubscription({
          userId,
          lookupKey: trustedPlan.planLookupKey,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          mutation: {
            eventId: event.id,
            eventCreatedAt: new Date(event.created * 1000),
            eventRank: eventRank(event.type),
            source: "webhook",
          },
          storeAsPersonalPlan: subscriptionType !== "business_seat",
        });
        processedUserId = userId;
        if (!mutationResult.updated) {
          if (mutationResult.reason !== "STALE_EVENT") {
            throw new Error(
              `Completed checkout could not be assigned safely (${mutationResult.reason})`,
            );
          }
          await completeBillingEvent(event.id, "ignored", userId);
          return res.json({ received: true, ignored: "stale_event" });
        }

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
              plan: trustedPlan.planLookupKey,
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
            `✅ [webhook] checkout.session.completed — business_seat | user ${userId} → ${trustedPlan.planLookupKey} | seats=${seatCount} | total=$${(44.99 * seatCount).toFixed(2)}/mo`,
          );
        } else {
          console.log(`✅ [webhook] checkout.session.completed — user ${userId} → ${trustedPlan.planLookupKey}`);
        }
        break;
      }

      // ── Renewal or recovery: restore access if it was revoked ────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = stripeObjectId(invoice.customer as any);
        const subscriptionId = (invoice as any).subscription as string | null;

        if (!customerId || !subscriptionId) {
          console.log(`[webhook] invoice.payment_succeeded — no customerId/subscriptionId, skipping`);
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const user = await resolveStripeEventUser({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          metadataUserId: subscription.metadata?.userId,
          allowMetadataBootstrap: true,
        });
        if (!user) {
          console.warn(`[webhook] invoice.payment_succeeded — ambiguous or missing owner for customer ${customerId}`);
          break;
        }

        const trustedPlan = planFromSubscription(subscription);
        if (trustedPlan && (subscription.status === "active" || subscription.status === "trialing")) {
            const mutationResult = await updateUserSubscription({
              userId: user.id,
              lookupKey: trustedPlan.planLookupKey,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              mutation: {
                eventId: event.id,
                eventCreatedAt: new Date(event.created * 1000),
                eventRank: eventRank(event.type),
                source: "webhook",
              },
              storeAsPersonalPlan: storesAsPersonalPlan(trustedPlan.planLookupKey),
            });
            if (!mutationResult.updated && mutationResult.reason !== "STALE_EVENT") {
              throw new Error(
                `Invoice payment could not be assigned safely (${mutationResult.reason})`,
              );
            }
            processedUserId = user.id;
            if (
              mutationResult.updated
              && trustedPlan.planLookupKey === "clinical_business_monthly"
            ) {
              await syncBusinessBillingState({
                ownerUserId: user.id,
                subscriptionId,
                status: "active",
                seatLimit: subscription.items.data[0]?.quantity,
              });
            }
            console.log(
              mutationResult.updated
                ? `✅ [webhook] invoice.payment_succeeded — access synchronized for user ${user.id} → ${trustedPlan.planLookupKey}`
                : `ℹ️ [webhook] invoice.payment_succeeded — stale event ignored for user ${user.id}`,
            );
        } else {
          console.log(`[webhook] invoice.payment_succeeded — subscription not active or price not trusted`);
        }
        break;
      }

      // ── Payment failed: revoke access ────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = stripeObjectId(invoice.customer as any);
        const subscriptionId = (invoice as any).subscription as string | null;
        if (!customerId || !subscriptionId) {
          console.warn("[webhook] invoice.payment_failed — missing customer or subscription identity");
          break;
        }

        const failedSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        const failedPlan = planFromSubscription(failedSubscription);
        if (!failedPlan) {
          console.warn(
            "[webhook] invoice.payment_failed — subscription price is not mapped to a trusted plan",
          );
          break;
        }
        const cancelled = await cancelUserSubscription(customerId, subscriptionId, {
          eventId: event.id,
          eventCreatedAt: new Date(event.created * 1000),
          eventRank: eventRank(event.type),
          source: "webhook",
        }, storesAsPersonalPlan(failedPlan.planLookupKey));
        processedUserId = cancelled.user?.id ?? null;
        if (
          cancelled.updated
          && cancelled.user
          && failedPlan.planLookupKey === "clinical_business_monthly"
        ) {
          await syncBusinessBillingState({
            ownerUserId: cancelled.user.id,
            subscriptionId,
            status: "past_due",
          });
        }
        console.warn(
          cancelled.updated
            ? `⚠️ [webhook] invoice.payment_failed — access revoked for customer ${customerId}`
            : `ℹ️ [webhook] invoice.payment_failed — no eligible entitlement mutation (${cancelled.reason})`,
        );
        break;
      }

      // ── Subscription deleted: revoke access + terminate ProCare relationships ──
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = stripeObjectId(subscription.customer as any);
        if (!customerId) {
          console.warn("[webhook] customer.subscription.deleted — missing customer identity");
          break;
        }
        const cancelledPlan = planFromSubscription(subscription);
        if (!cancelledPlan) {
          console.warn(
            "[webhook] customer.subscription.deleted — subscription price is not mapped to a trusted plan",
          );
          break;
        }
        const cancelledLookupKey = cancelledPlan.planLookupKey;
        const affectedUser = await resolveSubscriptionUser(customerId, subscription.id);
        if (!affectedUser) {
          console.warn(`[webhook] customer.subscription.deleted — ambiguous or missing owner for customer ${customerId}`);
          break;
        }

        const cancellation = await cancelUserSubscription(customerId, subscription.id, {
          eventId: event.id,
          eventCreatedAt: new Date(event.created * 1000),
          eventRank: eventRank(event.type),
          source: "webhook",
        }, storesAsPersonalPlan(cancelledLookupKey));
        if (!cancellation.updated) {
          console.warn(
            cancellation.reason === "STALE_EVENT"
              ? `[webhook] customer.subscription.deleted — stale event ignored without side effects`
              : `[webhook] customer.subscription.deleted — no exact stored owner (${cancellation.reason})`,
          );
          break;
        }
        processedUserId = affectedUser.id;
        if (
          cancellation.updated
          && cancelledLookupKey === "clinical_business_monthly"
        ) {
          await syncBusinessBillingState({
            ownerUserId: affectedUser.id,
            subscriptionId: subscription.id,
            status: "cancelled",
          });
        }
        console.log(`⚠️ [webhook] customer.subscription.deleted — access revoked for customer ${customerId}`);

        const planKey = cancelledLookupKey;
        if (CLINICAL_PLAN_KEYS.includes(planKey) && affectedUser.isProCare) {
          console.log(`🔌 [webhook] Clinical cancelled — terminating ProCare client relationships for user ${affectedUser.id}`);
          await terminateProCareRelationships(affectedUser.id, "client");
        } else if (isProCarePlanKey(planKey)) {
          console.log(`🔌 [webhook] ProCare cancelled — terminating all coach relationships for user ${affectedUser.id}`);
          await terminateProCareRelationships(affectedUser.id, "coach");
        }
        break;
      }

      // ── Plan upgrade / downgrade / reactivation ──────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = stripeObjectId(subscription.customer as any);
        if (!customerId) {
          console.warn(`[webhook] ${event.type} — missing customer identity`);
          break;
        }
        const trustedPlan = planFromSubscription(subscription);

        if (!trustedPlan) {
          console.log(`[webhook] ${event.type} — price is not mapped to a trusted plan, skipping`);
          break;
        }

        const user = await resolveStripeEventUser({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          metadataUserId: subscription.metadata?.userId,
          allowMetadataBootstrap: true,
        });
        if (!user) {
          console.warn(`[webhook] ${event.type} — ambiguous or missing owner for customer ${customerId}`);
          break;
        }
        processedUserId = user.id;

        if (subscription.status === "active" || subscription.status === "trialing") {
          const mutationResult = await updateUserSubscription({
            userId: user.id,
            lookupKey: trustedPlan.planLookupKey,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            mutation: {
              eventId: event.id,
              eventCreatedAt: new Date(event.created * 1000),
              eventRank: eventRank(event.type),
              source: "webhook",
            },
            storeAsPersonalPlan: storesAsPersonalPlan(trustedPlan.planLookupKey),
          });
          if (!mutationResult.updated && mutationResult.reason !== "STALE_EVENT") {
            throw new Error(
              `${event.type} could not be assigned safely (${mutationResult.reason})`,
            );
          }
          console.log(
            mutationResult.updated
              ? `✅ [webhook] ${event.type} — user ${user.id} → ${trustedPlan.planLookupKey} (${subscription.status})`
              : `ℹ️ [webhook] ${event.type} — stale event ignored for user ${user.id}`,
          );

          if (
            mutationResult.updated
            && trustedPlan.planLookupKey === "clinical_business_monthly"
          ) {
            try {
              const newQty = subscription.items.data[0]?.quantity ?? null;
              await syncBusinessBillingState({
                ownerUserId: user.id,
                subscriptionId: subscription.id,
                status: "active",
                seatLimit: newQty,
              });
              console.log(`✅ [webhook] business state synchronized | owner=${user.id}`);
            } catch (seatErr) {
              console.error("❌ [webhook] failed to sync business billing state:", seatErr);
              throw seatErr;
            }
          }
        } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
          const cancellation = await cancelUserSubscription(customerId, subscription.id, {
            eventId: event.id,
            eventCreatedAt: new Date(event.created * 1000),
            eventRank: eventRank(event.type),
            source: "webhook",
          }, storesAsPersonalPlan(trustedPlan.planLookupKey));
          if (
            cancellation.updated
            && cancellation.user
            && trustedPlan.planLookupKey === "clinical_business_monthly"
          ) {
            await syncBusinessBillingState({
              ownerUserId: cancellation.user.id,
              subscriptionId: subscription.id,
              status: subscription.status === "unpaid" ? "past_due" : "cancelled",
            });
          }
          console.log(`⚠️ [webhook] customer.subscription.updated — user ${user.id} revoked (status: ${subscription.status})`);
        } else {
          console.log(`[webhook] customer.subscription.updated — user ${user.id} status ${subscription.status}, no action`);
        }
        break;
      }

      default:
        eventWasHandled = false;
        console.log(`ℹ️ [webhook] Unhandled event type: ${event.type}`);
    }

    await completeBillingEvent(
      event.id,
      eventWasHandled ? "processed" : "ignored",
      processedUserId,
    );
    return res.json({ received: true });
  } catch (err: any) {
    await failBillingEvent(event.id, err);
    console.error("❌ [webhook] Handler error:", err);
    return res.status(500).send("Webhook handler error");
  }
});

export default router;
