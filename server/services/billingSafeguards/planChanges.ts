import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type Stripe from "stripe";
import { assertPersonalCheckoutPlan, BillingSafetyError, subjectKey, subscriptionSubject, terminalSubscriptionStates } from "./subjects";
import { subscriptionInventory } from "./inventory";

export interface PlanChangeInput {
  stripe: Stripe;
  pool: Pool;
  ownerUserId: string;
  customerId: string;
  subscriptionId: string;
  managedPrices: ReadonlyMap<string, string>;
}

async function providerAuthority(stripe: Stripe) {
  const [account, balance] = await Promise.all([stripe.accounts.retrieve(), stripe.balance.retrieve()]);
  const deployed = process.env.REPLIT_DEPLOYMENT === "1" || process.env.REPLIT_DEPLOYMENT === "true";
  if (balance.livemode && !deployed) {
    throw new BillingSafetyError("BILLING_LIVE_RUNTIME_REQUIRED", "Only the released Production runtime may change live billing.", 503);
  }
  return { accountId: account.id, livemode: balance.livemode };
}

async function currentSubscription(input: PlanChangeInput, authority: Awaited<ReturnType<typeof providerAuthority>>) {
  const key = subjectKey({ kind: "personal", ownerUserId: input.ownerUserId });
  const inventory = await subscriptionInventory(input.stripe);
  const matches = inventory.filter(sub => {
    if (sub.livemode !== authority.livemode) {
      throw new BillingSafetyError("BILLING_MODE_CONFLICT", "Provider mode requires review.", 503);
    }
    const classified = subscriptionSubject(sub, input.managedPrices);
    if (classified.ambiguous && sub.metadata?.userId === input.ownerUserId) {
      throw new BillingSafetyError("BILLING_IDENTITY_REVIEW_REQUIRED", "Existing billing needs identity review.");
    }
    return classified.subject && subjectKey(classified.subject) === key &&
      !terminalSubscriptionStates.has(sub.status);
  });
  const sub = matches[0];
  if (matches.length !== 1 || !sub || sub.id !== input.subscriptionId ||
      (typeof sub.customer === "string" ? sub.customer : sub.customer.id) !== input.customerId ||
      sub.status !== "active" || sub.cancel_at_period_end || sub.cancel_at ||
      sub.pending_update || sub.schedule || sub.items.data.length !== 1) {
    throw new BillingSafetyError("BILLING_PLAN_CHANGE_REVIEW_REQUIRED",
      "Plan changes require one verified continuing Personal/Family subscription.");
  }
  return sub;
}

export async function previewPersonalPlanChange(
  input: PlanChangeInput & { targetPlanKey: string; targetPriceId: string },
) {
  assertPersonalCheckoutPlan(input.targetPlanKey);
  if (input.managedPrices.get(input.targetPriceId) !== input.targetPlanKey) {
    throw new BillingSafetyError("BILLING_PRICE_INVALID", "The selected plan is not configured.");
  }
  const authority = await providerAuthority(input.stripe);
  const sub = await currentSubscription(input, authority);
  const before = sub.items.data[0];
  const price = await input.stripe.prices.retrieve(input.targetPriceId);
  const priorPrice = before.price;
  if (!price.active || !price.unit_amount || !priorPrice.unit_amount || price.currency !== priorPrice.currency ||
      price.recurring?.usage_type === "metered" || priorPrice.recurring?.usage_type === "metered" ||
      price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 ||
      priorPrice.recurring?.interval !== "month" || priorPrice.recurring.interval_count !== 1 ||
      before.quantity !== 1 || price.id === priorPrice.id) {
    throw new BillingSafetyError("BILLING_PLAN_CHANGE_UNSUPPORTED", "This plan change requires billing review.");
  }
  const quote = {
    amountDueNow: 0, currency: price.currency, monthlyAmount: price.unit_amount,
    nextRenewalAt: before.current_period_end,
    billingCycleAnchor: sub.billing_cycle_anchor,
    disclosure: "Your existing subscription changes immediately. No charge or prorated credit is created now. Your current renewal date stays the same; the selected monthly price applies at that renewal. Existing discounts, taxes, and credit balances may affect the final invoice.",
  };
  const key = subjectKey({ kind: "personal", ownerUserId: input.ownerUserId });
  const client = await input.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      [`mpm-plan-change:${authority.accountId}:${authority.livemode}:${key}`]);
    await client.query(`UPDATE billing_plan_change_operations SET state='expired'
      WHERE subject_key=$1 AND account_id=$2 AND livemode=$3 AND state='pending' AND expires_at<now()`,
      [key, authority.accountId, authority.livemode]);
    await client.query(
      `INSERT INTO billing_plan_change_operations
       (operation_id,subject_key,owner_user_id,subscription_id,customer_id,previous_price_id,target_price_id,target_plan_key,quote,account_id,livemode,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()+interval '15 minutes') ON CONFLICT DO NOTHING`,
      [randomUUID(), key, input.ownerUserId, sub.id, input.customerId, priorPrice.id, price.id, input.targetPlanKey,
        JSON.stringify(quote), authority.accountId, authority.livemode],
    );
    const { rows } = await client.query(
      `SELECT operation_id,target_price_id,quote,state,expires_at FROM billing_plan_change_operations
        WHERE subject_key=$1 AND account_id=$2 AND livemode=$3
        AND state IN ('pending','applying','review_required')`, [key, authority.accountId, authority.livemode],
    );
    const op = rows[0];
    if (!op || op.target_price_id !== price.id || op.state !== "pending") {
      throw new BillingSafetyError("BILLING_PLAN_CHANGE_PENDING", "Another plan change needs verification.");
    }
    await client.query("COMMIT");
    return { operationId: op.operation_id, ...op.quote, expiresAt: op.expires_at };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function confirmPersonalPlanChange(input: PlanChangeInput & {
  operationId: string; acceptedDisclosure: boolean;
}) {
  if (!input.acceptedDisclosure || !/^[a-f0-9-]{36}$/i.test(input.operationId)) {
    throw new BillingSafetyError("BILLING_CONSENT_REQUIRED", "Confirm the disclosed plan change first.", 400);
  }
  const authority = await providerAuthority(input.stripe);
  const { rows } = await input.pool.query(
    `SELECT * FROM billing_plan_change_operations WHERE operation_id=$1 AND owner_user_id=$2
      AND subscription_id=$3 AND customer_id=$4 AND account_id=$5 AND livemode=$6`,
    [input.operationId, input.ownerUserId, input.subscriptionId, input.customerId,
      authority.accountId, authority.livemode],
  );
  const op = rows[0];
  if (!op) throw new BillingSafetyError("BILLING_PLAN_CHANGE_INVALID", "This plan-change confirmation is invalid.");
  if (op.state === "applied") return { applied: true, subscriptionId: input.subscriptionId };
  if (op.state === "review_required" || op.state === "expired" ||
      (op.state === "pending" && new Date(op.expires_at).getTime() <= Date.now()) ||
      Date.now() - new Date(op.created_at).getTime() >= 23 * 60 * 60 * 1000) {
    throw new BillingSafetyError("BILLING_PLAN_CHANGE_EXPIRED", "The plan-change confirmation needs review or a new preview.");
  }
  const sub = await currentSubscription(input, authority);
  if (sub.items.data[0].current_period_end !== op.quote.nextRenewalAt ||
      sub.billing_cycle_anchor !== op.quote.billingCycleAnchor) {
    throw new BillingSafetyError("BILLING_RENEWAL_CHANGED", "The subscription renewed. Review a fresh plan-change preview.");
  }
  const currentPrice = sub.items.data[0].price.id;
  // A timeout may have applied the provider mutation. Verify it instead of charging/creating again.
  if (currentPrice !== op.previous_price_id && currentPrice !== op.target_price_id) {
    throw new BillingSafetyError("BILLING_PLAN_CHANGED", "The subscription changed; billing review is required.");
  }
  if (currentPrice === op.target_price_id && sub.metadata?.mpmPlanChangeOperation !== op.operation_id) {
    throw new BillingSafetyError("BILLING_PLAN_CHANGED", "The requested change cannot be attributed safely.");
  }
  const claimed = await input.pool.query(`UPDATE billing_plan_change_operations SET state='applying'
    WHERE operation_id=$1 AND ((state='pending' AND expires_at>now()) OR state='applying')
    AND created_at>now()-interval '23 hours' RETURNING operation_id`, [op.operation_id]);
  if (claimed.rowCount !== 1) {
    const latest = await input.pool.query("SELECT state FROM billing_plan_change_operations WHERE operation_id=$1", [op.operation_id]);
    if (latest.rows[0]?.state === "applied") return { applied: true, subscriptionId: sub.id };
    throw new BillingSafetyError("BILLING_PLAN_CHANGE_EXPIRED", "Review a fresh plan-change preview.");
  }
  if (currentPrice !== op.target_price_id) {
    await input.stripe.subscriptions.update(sub.id, {
      items: [{ id: sub.items.data[0].id, price: op.target_price_id, quantity: 1 }],
      proration_behavior: "none", billing_cycle_anchor: "unchanged",
      payment_behavior: "error_if_incomplete",
      metadata: { ...sub.metadata, sku: op.target_plan_key, mpmPlanChangeOperation: op.operation_id },
    }, { idempotencyKey: `mpm-plan-change:${authority.accountId}:${op.operation_id}` });
  }
  const after = await input.stripe.subscriptions.retrieve(sub.id);
  if (after.id !== sub.id || after.items.data[0]?.price.id !== op.target_price_id ||
      after.metadata?.mpmPlanChangeOperation !== op.operation_id ||
      after.items.data[0]?.current_period_end !== op.quote.nextRenewalAt ||
      after.billing_cycle_anchor !== op.quote.billingCycleAnchor || after.livemode !== authority.livemode ||
      (typeof after.customer === "string" ? after.customer : after.customer.id) !== input.customerId) {
    throw new BillingSafetyError("BILLING_PLAN_CHANGE_UNVERIFIED", "The plan change needs provider verification. Do not check out again.");
  }
  await input.pool.query("UPDATE billing_plan_change_operations SET state='applied' WHERE operation_id=$1", [op.operation_id]);
  return { applied: true, subscriptionId: sub.id };
}
