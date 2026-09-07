import type Stripe from "stripe";
import type { LookupKey } from "../../client/src/data/planSkus";
import { planFromSubscription } from "./stripePlanCatalog";

export class CheckoutBillingConflictError extends Error {
  constructor(
    readonly code:
      | "BILLING_IDENTITY_REVIEW_REQUIRED"
      | "BILLING_CUSTOMER_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "CheckoutBillingConflictError";
  }
}

export interface CheckoutBillingUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;

export function consumerCheckoutIdempotencyKey(
  userId: string,
  plan: LookupKey,
  now = Date.now(),
): string {
  return `mpm-consumer-checkout:${userId}:${plan}:${Math.floor(now / CHECKOUT_WINDOW_MS)}`;
}

function stripeSearchLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function customerUserId(customer: Stripe.Customer): string | null {
  return customer.metadata?.userId?.trim() || null;
}

async function customerHasVerifiedUserIdentity(
  stripe: Stripe,
  customerId: string,
  userId: string,
): Promise<boolean> {
  const [subscriptions, sessions] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 }),
    stripe.checkout.sessions.list({ customer: customerId, limit: 100 }),
  ]);
  return subscriptions.data.some((item) => item.metadata?.userId === userId)
    || sessions.data.some((item) => item.metadata?.userId === userId);
}

export async function resolveCanonicalCheckoutCustomer(input: {
  stripe: Stripe;
  user: CheckoutBillingUser;
  persistCustomerId: (customerId: string) => Promise<void>;
}): Promise<Stripe.Customer> {
  const { stripe, user } = input;

  if (user.stripeCustomerId) {
    const stored = await stripe.customers.retrieve(user.stripeCustomerId);
    if (stored.deleted) {
      throw new CheckoutBillingConflictError(
        "BILLING_CUSTOMER_INVALID",
        "The stored billing customer is no longer available.",
      );
    }
    const activeCustomer = stored as Stripe.Customer;
    const metadataUserId = customerUserId(activeCustomer);
    if (metadataUserId && metadataUserId !== user.id) {
      throw new CheckoutBillingConflictError(
        "BILLING_IDENTITY_REVIEW_REQUIRED",
        "The stored billing customer belongs to a different application identity.",
      );
    }
    if (!metadataUserId) {
      return stripe.customers.update(activeCustomer.id, {
        metadata: { ...activeCustomer.metadata, userId: user.id },
      });
    }
    return activeCustomer;
  }

  const metadataMatches = await stripe.customers.search({
    query: `metadata['userId']:'${stripeSearchLiteral(user.id)}'`,
    limit: 10,
  });
  const verifiedById = new Map(
    metadataMatches.data.map((candidate) => [candidate.id, candidate]),
  );

  // Email is only a candidate-discovery mechanism. A candidate is accepted
  // only when Stripe-owned subscription/session metadata names this exact
  // application user ID.
  const emailCandidates = await stripe.customers.list({
    email: user.email,
    limit: 100,
  });
  await Promise.all(emailCandidates.data.map(async (candidate) => {
    if (
      !verifiedById.has(candidate.id)
      && await customerHasVerifiedUserIdentity(stripe, candidate.id, user.id)
    ) {
      verifiedById.set(candidate.id, candidate);
    }
  }));

  const verified = [...verifiedById.values()];
  if (verified.length > 1) {
    throw new CheckoutBillingConflictError(
      "BILLING_IDENTITY_REVIEW_REQUIRED",
      "Multiple Stripe customers claim the same application identity.",
    );
  }

  let customer = verified[0];
  if (!customer) {
    customer = await stripe.customers.create({
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
      metadata: { userId: user.id },
    }, {
      idempotencyKey: `mpm-customer:${user.id}`,
    });
  }

  await input.persistCustomerId(customer.id);
  return customer;
}

export async function findBlockingMpmSubscription(input: {
  stripe: Stripe;
  customerId: string;
  storedSubscriptionId?: string | null;
}): Promise<{ subscription: Stripe.Subscription; planLookupKey: LookupKey } | null> {
  const candidates: Stripe.Subscription[] = [];

  if (input.storedSubscriptionId) {
    try {
      candidates.push(await input.stripe.subscriptions.retrieve(input.storedSubscriptionId));
    } catch {
      // The local reference may be stale; authoritative customer listing below
      // still prevents a duplicate active subscription.
    }
  }

  const listed = await input.stripe.subscriptions.list({
    customer: input.customerId,
    status: "all",
    limit: 100,
  });
  for (const subscription of listed.data) {
    if (!candidates.some((candidate) => candidate.id === subscription.id)) {
      candidates.push(subscription);
    }
  }

  for (const subscription of candidates) {
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) continue;
    const trustedPlan = planFromSubscription(subscription);
    if (trustedPlan) {
      return {
        subscription,
        planLookupKey: trustedPlan.planLookupKey as LookupKey,
      };
    }
  }
  return null;
}