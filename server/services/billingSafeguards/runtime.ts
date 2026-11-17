import type Stripe from "stripe";
import type { Pool } from "pg";
import { guardedSubscriptionCheckout } from "./checkout";
import { CheckoutOperationStore } from "./store";
import {
  BillingSafetyError, subjectKey, subscriptionSubject, terminalSubscriptionStates, type BillingSubject,
} from "./subjects";
import { subscriptionInventory } from "./inventory";
import { STRIPE_PRICE_IDS } from "../../config/stripePrices";

/** Opt-in only. No env is changed, no DDL is executed, and imports start no workers. */
export function billingSafeguardsEnabled(): boolean {
  return process.env.BILLING_CHECKOUT_SAFEGUARDS_ENABLED === "true";
}
export const BILLING_CHECKOUT_IMPLEMENTATION_VERSION = "durable-subject-checkout-v1";

export function managedBillingPrices(prices: Record<string, string>): Map<string, string> {
  const result = new Map<string, string>();
  for (const [plan, price] of Object.entries(prices)) {
    if (!price) continue;
    if (result.has(price) && result.get(price) !== plan) {
      throw new BillingSafetyError("BILLING_PRICE_CONFIGURATION_CONFLICT", "Billing prices require review.", 503);
    }
    result.set(price, plan);
  }
  const relationshipPrice = process.env.STRIPE_PRICE_PROCARE;
  if (relationshipPrice && !result.has(relationshipPrice)) {
    result.set(relationshipPrice, "mpm_procare_relationship");
  }
  return result;
}

export function billingCheckoutCreator(stripe: Stripe, pool: Pool, subject: BillingSubject) {
  return (params: Stripe.Checkout.SessionCreateParams, legacyOptions?: Stripe.RequestOptions) =>
    !billingSafeguardsEnabled()
      ? stripe.checkout.sessions.create(params, legacyOptions)
      : createBillingCheckout({
          stripe, pool, subject, params, legacyOptions,
          managedPrices: managedBillingPrices(STRIPE_PRICE_IDS),
        });
}

export async function createBillingCheckout(input: {
  stripe: Stripe;
  pool: Pool;
  subject: BillingSubject;
  managedPrices: ReadonlyMap<string, string>;
  params: Stripe.Checkout.SessionCreateParams;
  legacyOptions?: Stripe.RequestOptions;
}): Promise<Stripe.Checkout.Session> {
  if (!billingSafeguardsEnabled()) {
    return input.stripe.checkout.sessions.create(input.params, input.legacyOptions);
  }
  const { stripe, pool, subject } = input;
  // This read-only account identity must agree with every scanned object.
  const [account, balance] = await Promise.all([stripe.accounts.retrieve(), stripe.balance.retrieve()]);
  const deployed = process.env.REPLIT_DEPLOYMENT === "1" || process.env.REPLIT_DEPLOYMENT === "true";
  if (balance.livemode && !deployed) {
    throw new BillingSafetyError("BILLING_LIVE_RUNTIME_REQUIRED", "Only the released Production runtime may change live billing.", 503);
  }
  const key = subjectKey(subject);
  const { rows: history } = await pool.query(
    `SELECT identity_value AS customer_id FROM stripe_identity_owners
     WHERE owner_user_id=$1 AND identity_type='customer'
     UNION SELECT customer_id FROM stripe_billing_events WHERE user_id=$1 AND customer_id IS NOT NULL`,
    [subject.ownerUserId],
  );
  const historicalCustomerIds = new Set<string>(history.map(row => row.customer_id));
  let historicalCustomer: string | undefined;
  const assertNoExistingContract = async () => {
    const inventory = await subscriptionInventory(stripe);
    const terminalCustomers = new Set<string>();
    for (const sub of inventory) {
      if (sub.livemode !== balance.livemode) {
        throw new BillingSafetyError("BILLING_MODE_CONFLICT", "Provider mode needs review.", 503);
      }
      const classified = subscriptionSubject(sub, input.managedPrices);
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const suppliedCustomer = typeof input.params.customer === "string" ? input.params.customer : null;
      if (classified.ambiguous &&
          (sub.metadata?.userId === subject.ownerUserId || customer === suppliedCustomer ||
            historicalCustomerIds.has(customer))) {
        throw new BillingSafetyError("BILLING_IDENTITY_REVIEW_REQUIRED", "An existing MPM contract requires identity review. Do not pay again.");
      }
      if (!classified.subject || subjectKey(classified.subject) !== key) continue;
      if (!terminalSubscriptionStates.has(sub.status)) {
        throw new BillingSafetyError("SUBSCRIPTION_ALREADY_ACTIVE",
          "This billing relationship already has a subscription. Manage or recover the existing subscription instead.", 409);
      }
      terminalCustomers.add(customer);
    }
    if (!input.params.customer) {
      if (terminalCustomers.size > 1) {
        throw new BillingSafetyError("BILLING_CUSTOMER_REVIEW_REQUIRED", "Multiple historical billing customers require review.");
      }
      historicalCustomer = [...terminalCustomers][0];
    }
  };
  await assertNoExistingContract();
  const payload = { ...input.params, ...(historicalCustomer ? { customer: historicalCustomer } : {}) };
  if (payload.customer) delete payload.customer_email;
  return guardedSubscriptionCheckout({
    stripe, store: new CheckoutOperationStore(pool), subject,
    accountId: account.id, livemode: balance.livemode,
    planKey: String(input.params.metadata?.sku ?? input.params.line_items?.[0]?.price ?? ""),
    payload, assertNoExistingContract,
  });
}

/** Serialize only controlled codes, never provider errors or customer/profile payloads. */
export function billingSafetyResponse(error: unknown, res: any): boolean {
  if (!(error instanceof BillingSafetyError)) return false;
  res.status(error.status).json({ code: error.code, error: error.message, billingPath: "/settings",
    canChangePlan: billingSafeguardsEnabled() && error.code === "SUBSCRIPTION_ALREADY_ACTIVE" });
  return true;
}
