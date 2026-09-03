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
import { applyBusinessSubscriptionTransition } from "../services/businessSubscriptionService";

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

        if (subscriptionType === "business_seat") {
          const { businesses } = await import("../db/schema/business");
          const { eq: eqBiz, sql: drizzleSql } = await import("drizzle-orm");
          const businessId = metadata.businessId ?? subscription.metadata?.businessId;
          const checkoutReservationId =
            metadata.checkoutReservationId
            ?? subscription.metadata?.checkoutReservationId;
          const transition = await applyBusinessSubscriptionTransition({
            ownerUserId: userId,
            businessId,
            checkoutReservationId,
            checkoutSessionId: session.id,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: "active",
            seatLimit: seatCount,
            mutation: {
              eventId: event.id,
              eventCreatedAt: new Date(event.created * 1000),
              eventRank: eventRank(event.type),
              source: "webhook",
            },
          });
          processedUserId = userId;
          if (!transition.updated) {
            if (transition.reason === "STALE_EVENT") {
              await completeBillingEvent(event.id, "ignored", userId);
              return res.json({ received: true, ignored: "stale_event" });
            }
            throw new Error(
              `Business checkout could not be assigned safely (${transition.reason})`,
            );
          }
          const bizId = transition.businessId;
          const orgName = transition.businessName;

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
            if (trustedPlan.planLookupKey === "clinical_business_monthly") {
              const transition = await applyBusinessSubscriptionTransition({
                ownerUserId: user.id,
                businessId: subscription.metadata?.businessId,
                checkoutReservationId: subscription.metadata?.checkoutReservationId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                status: "active",
                seatLimit: subscription.items.data[0]?.quantity,
                mutation: {
                  eventId: event.id,
                  eventCreatedAt: new Date(event.created * 1000),
                  eventRank: eventRank(event.type),
                  source: "webhook",
                },
              });
              if (!transition.updated && transition.reason !== "STALE_EVENT") {
                throw new Error(
                  `Business invoice payment could not be assigned safely (${transition.reason})`,
                );
              }
              processedUserId = user.id;
              console.log(
                transition.updated
                  ? `✅ [webhook] invoice.payment_succeeded — business access synchronized for user ${user.id}`
                  : `ℹ️ [webhook] invoice.payment_succeeded — stale business event ignored for user ${user.id}`,
              );
            } else {
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
              });
              if (!mutationResult.updated && mutationResult.reason !== "STALE_EVENT") {
                throw new Error(
                  `Invoice payment could not be assigned safely (${mutationResult.reason})`,
                );
              }
              processedUserId = user.id;
              console.log(
                mutationResult.updated
                  ? `✅ [webhook] invoice.payment_succeeded — access synchronized for user ${user.id} → ${trustedPlan.planLookupKey}`
                  : `ℹ️ [webhook] invoice.payment_succeeded — stale event ignored for user ${user.id}`,
              );
            }
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
        if (failedPlan.planLookupKey === "clinical_business_monthly") {
          const owner = await resolveStripeEventUser({
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            metadataUserId: failedSubscription.metadata?.userId,
            allowMetadataBootstrap: true,
          });
          if (!owner) break;
          const transition = await applyBusinessSubscriptionTransition({
            ownerUserId: owner.id,
            businessId: failedSubscription.metadata?.businessId,
            checkoutReservationId: failedSubscription.metadata?.checkoutReservationId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: "past_due",
            mutation: {
              eventId: event.id,
              eventCreatedAt: new Date(event.created * 1000),
              eventRank: eventRank(event.type),
              source: "webhook",
            },
          });
          if (!transition.updated && transition.reason !== "STALE_EVENT") {
            throw new Error(`Business payment failure could not be applied (${transition.reason})`);
          }
          processedUserId = owner.id;
        } else {
          const cancelled = await cancelUserSubscription(customerId, subscriptionId, {
            eventId: event.id,
            eventCreatedAt: new Date(event.created * 1000),
            eventRank: eventRank(event.type),
            source: "webhook",
          });
          processedUserId = cancelled.user?.id ?? null;
        }
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
        const affectedUser = cancelledLookupKey === "clinical_business_monthly"
          ? await resolveStripeEventUser({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
              metadataUserId: subscription.metadata?.userId,
              allowMetadataBootstrap: true,
            })
          : await resolveSubscriptionUser(customerId, subscription.id);
        if (!affectedUser) {
          console.warn(`[webhook] customer.subscription.deleted — ambiguous or missing owner for customer ${customerId}`);
          break;
        }

        const cancellation = cancelledLookupKey === "clinical_business_monthly"
          ? await applyBusinessSubscriptionTransition({
              ownerUserId: affectedUser.id,
              businessId: subscription.metadata?.businessId,
              checkoutReservationId: subscription.metadata?.checkoutReservationId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
              status: "cancelled",
              mutation: {
                eventId: event.id,
                eventCreatedAt: new Date(event.created * 1000),
                eventRank: eventRank(event.type),
                source: "webhook",
              },
            })
          : await cancelUserSubscription(customerId, subscription.id, {
              eventId: event.id,
              eventCreatedAt: new Date(event.created * 1000),
              eventRank: eventRank(event.type),
              source: "webhook",
            });
        if (!cancellation.updated) {
          console.warn(
            cancellation.reason === "STALE_EVENT"
              ? `[webhook] customer.subscription.deleted — stale event ignored without side effects`
              : `[webhook] customer.subscription.deleted — no exact stored owner (${cancellation.reason})`,
          );
          break;
        }
        processedUserId = affectedUser.id;
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
          const mutationResult = trustedPlan.planLookupKey === "clinical_business_monthly"
            ? await applyBusinessSubscriptionTransition({
                ownerUserId: user.id,
                businessId: subscription.metadata?.businessId,
                checkoutReservationId: subscription.metadata?.checkoutReservationId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id,
                status: "active",
                seatLimit: subscription.items.data[0]?.quantity,
                mutation: {
                  eventId: event.id,
                  eventCreatedAt: new Date(event.created * 1000),
                  eventRank: eventRank(event.type),
                  source: "webhook",
                },
              })
            : await updateUserSubscription({
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
        } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
          const cancellation = trustedPlan.planLookupKey === "clinical_business_monthly"
            ? await applyBusinessSubscriptionTransition({
                ownerUserId: user.id,
                businessId: subscription.metadata?.businessId,
                checkoutReservationId: subscription.metadata?.checkoutReservationId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id,
                status: subscription.status === "unpaid" ? "past_due" : "cancelled",
                mutation: {
                  eventId: event.id,
                  eventCreatedAt: new Date(event.created * 1000),
                  eventRank: eventRank(event.type),
                  source: "webhook",
                },
              })
            : await cancelUserSubscription(customerId, subscription.id, {
                eventId: event.id,
                eventCreatedAt: new Date(event.created * 1000),
                eventRank: eventRank(event.type),
                source: "webhook",
              });
          if (!cancellation.updated && cancellation.reason !== "STALE_EVENT") {
            throw new Error(`${event.type} cancellation could not be applied (${cancellation.reason})`);
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
