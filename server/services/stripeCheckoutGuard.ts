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

function hasStudioBillingMarker(metadata: Stripe.Metadata | null | undefined): boolean {
  return metadata?.serviceType === "studio" ||
    metadata?.subscriptionType === "studio" ||
    Boolean(metadata?.studioId);
}

function assertStudioIdentityKnown(
  customerId: string,
  metadata: Stripe.Metadata | null | undefined,
  studioCustomerIds: Set<string>,
): void {
  if (hasStudioBillingMarker(metadata) && !studioCustomerIds.has(customerId)) {
    throw new CheckoutBillingConflictError(
      "BILLING_IDENTITY_REVIEW_REQUIRED",
      "A Stripe customer is marked for Studio billing but has no verified Studio billing record.",
    );
  }
}

async function customerHasVerifiedUserIdentity(
  stripe: Stripe,
  customerId: string,
  userId: string,
  studioCustomerIds: Set<string>,
): Promise<boolean> {
  const [subscriptions, sessions] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 }),
    stripe.checkout.sessions.list({ customer: customerId, limit: 100 }),
  ]);
  if (subscriptions.has_more || sessions.has_more) {
    throw new CheckoutBillingConflictError(
      "BILLING_IDENTITY_REVIEW_REQUIRED",
      "Stripe identity history exceeds the checkout verification limit.",
    );
  }
  for (const item of subscriptions.data) {
    assertStudioIdentityKnown(customerId, item.metadata, studioCustomerIds);
    if (item.metadata?.userId === userId && !hasStudioBillingMarker(item.metadata)) return true;
  }
  for (const item of sessions.data) {
    assertStudioIdentityKnown(customerId, item.metadata, studioCustomerIds);
    if (item.metadata?.userId === userId && !hasStudioBillingMarker(item.metadata)) return true;
  }
  return false;
}

export async function resolveCanonicalCheckoutCustomer(input: {
  stripe: Stripe;
  user: CheckoutBillingUser;
  /** Customer IDs independently bound to an owned Studio, never Personal customers. */
  studioCustomerIds?: string[];
  persistCustomerId: (customerId: string) => Promise<void>;
}): Promise<Stripe.Customer> {
  const { stripe, user } = input;
  const studioCustomerIds = new Set(input.studioCustomerIds ?? []);

  if (user.stripeCustomerId && !studioCustomerIds.has(user.stripeCustomerId)) {
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
  if (metadataMatches.has_more) {
    throw new CheckoutBillingConflictError(
      "BILLING_IDENTITY_REVIEW_REQUIRED",
      "Stripe customer history exceeds the checkout verification limit.",
    );
  }
  for (const candidate of metadataMatches.data) {
    assertStudioIdentityKnown(candidate.id, candidate.metadata, studioCustomerIds);
  }
  const verifiedById = new Map(
    metadataMatches.data
      .filter((candidate) => !studioCustomerIds.has(candidate.id))
      .map((candidate) => [candidate.id, candidate]),
  );

  // Email is only a candidate-discovery mechanism. A candidate is accepted
  // only when Stripe-owned subscription/session metadata names this exact
  // application user ID.
  const emailCandidates = await stripe.customers.list({
    email: user.email,
    limit: 100,
  });
  await Promise.all(emailCandidates.data.map(async (candidate) => {
    assertStudioIdentityKnown(candidate.id, candidate.metadata, studioCustomerIds);
    if (
      !studioCustomerIds.has(candidate.id)
      &&
      !verifiedById.has(candidate.id)
      && await customerHasVerifiedUserIdentity(stripe, candidate.id, user.id, studioCustomerIds)
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
  /** Exact Studio subscriptions already verified against studio_billing + snapshot. */
  studioSubscriptionIds?: string[];
}): Promise<{ subscription: Stripe.Subscription; planLookupKey: LookupKey } | null> {
  const candidates: Stripe.Subscription[] = [];
  const studioSubscriptionIds = new Set(input.studioSubscriptionIds ?? []);

  if (input.storedSubscriptionId && !studioSubscriptionIds.has(input.storedSubscriptionId)) {
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
  if (listed.has_more) {
    throw new CheckoutBillingConflictError(
      "BILLING_IDENTITY_REVIEW_REQUIRED",
      "Stripe subscription history exceeds the checkout verification limit.",
    );
  }
  for (const subscription of listed.data) {
    if (!candidates.some((candidate) => candidate.id === subscription.id)) {
      candidates.push(subscription);
    }
  }

  for (const subscription of candidates) {
    if (studioSubscriptionIds.has(subscription.id)) continue;
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

// A saved canonical customer does not prove that another customer claiming the
// same app user is inactive. Check those customers before opening new Checkout.
export async function assertNoOtherActiveUserSubscription(input: {
  stripe: Stripe;
  userId: string;
  email: string;
  canonicalCustomerId: string;
  ownedCustomerIds?: string[];
  historicalCustomerIds?: string[];
  studioCustomerIds?: string[];
  studioSubscriptionIds?: string[];
}): Promise<void> {
  const { stripe, userId, email, canonicalCustomerId } = input;
  const [metadataMatches, emailCandidates] = await Promise.all([
    stripe.customers.search({
      query: `metadata['userId']:'${stripeSearchLiteral(userId)}'`,
      limit: 100,
    }),
    stripe.customers.list({ email, limit: 100 }),
  ]);
  if (metadataMatches.has_more || emailCandidates.has_more) {
    throw new CheckoutBillingConflictError(
      "BILLING_IDENTITY_REVIEW_REQUIRED",
      "Stripe customer history exceeds the checkout verification limit.",
    );
  }
  const candidates = new Map([
    ...metadataMatches.data,
    ...emailCandidates.data,
  ].map((customer) => [customer.id, customer]));
  const owned = new Set(input.ownedCustomerIds ?? []);
  const studioCustomers = new Set(input.studioCustomerIds ?? []);
  const allIds = new Set([
    ...candidates.keys(),
    ...owned,
    ...(input.historicalCustomerIds ?? []),
    ...studioCustomers,
  ]);
  for (const customerId of allIds) {
    if (customerId === canonicalCustomerId) continue;
    // Do not infer Personal identity from a Studio-owned customer's metadata,
    // but still scan its subscriptions below: any non-Studio subscription is
    // a blocker and may indicate an ambiguous shared legacy customer.
    if (studioCustomers.has(customerId)) {
      if (await findBlockingMpmSubscription({
        stripe,
        customerId,
        studioSubscriptionIds: input.studioSubscriptionIds,
      })) {
        throw new CheckoutBillingConflictError(
          "BILLING_IDENTITY_REVIEW_REQUIRED",
          "A Personal subscription is already active on a separately claimed Studio customer.",
        );
      }
      continue;
    }
    const candidate = candidates.get(customerId);
    if (candidate) assertStudioIdentityKnown(customerId, candidate.metadata, studioCustomers);
    if (!owned.has(customerId) &&
        candidate?.metadata?.userId !== userId &&
        !(await customerHasVerifiedUserIdentity(stripe, customerId, userId, studioCustomers))) continue;
    if (await findBlockingMpmSubscription({
      stripe,
      customerId,
      studioSubscriptionIds: input.studioSubscriptionIds,
    })) {
      throw new CheckoutBillingConflictError(
        "BILLING_IDENTITY_REVIEW_REQUIRED",
        "Another Stripe customer has an active subscription for this account.",
      );
    }
  }
}