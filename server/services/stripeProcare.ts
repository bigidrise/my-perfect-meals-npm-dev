import Stripe from "stripe";

let stripe: Stripe | null = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
  });
} else {
  console.warn("⚠️ STRIPE_SECRET_KEY not found - Payment features disabled");
}

function getStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please add STRIPE_SECRET_KEY.");
  }
  return stripe;
}

export { stripe };

const BLOCKING_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
]);

export class ProcareCheckoutConflictError extends Error {
  constructor(
    readonly code:
      | "PROCARE_SUBSCRIPTION_ALREADY_ACTIVE"
      | "PROCARE_BILLING_IDENTITY_REVIEW_REQUIRED"
      | "PROCARE_CHECKOUT_ALREADY_COMPLETED",
    message: string,
  ) {
    super(message);
    this.name = "ProcareCheckoutConflictError";
  }
}

function belongsToProcareRelationship(
  subscription: Stripe.Subscription,
  clientUserId: string,
  proUserId: string,
): boolean {
  return subscription.metadata?.clientUserId === clientUserId
    && subscription.metadata?.proUserId === proUserId;
}

export async function findBlockingProcareSubscription(input: {
  stripeClient?: Stripe;
  customerId: string;
  clientUserId: string;
  proUserId: string;
  storedSubscriptionIds?: string[];
}): Promise<Stripe.Subscription | null> {
  const stripeClient = input.stripeClient ?? getStripe();
  const candidates = new Map<string, Stripe.Subscription>();

  for (const subscriptionId of new Set(input.storedSubscriptionIds ?? [])) {
    try {
      const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
      candidates.set(subscription.id, subscription);
    } catch {
      throw new ProcareCheckoutConflictError(
        "PROCARE_BILLING_IDENTITY_REVIEW_REQUIRED",
        "A stored ProCare subscription could not be verified safely.",
      );
    }
  }

  const listed = await stripeClient.subscriptions.list({
    customer: input.customerId,
    status: "all",
    limit: 100,
  });
  for (const subscription of listed.data) {
    candidates.set(subscription.id, subscription);
  }

  for (const subscription of candidates.values()) {
    const stored = input.storedSubscriptionIds?.includes(subscription.id) ?? false;
    if (
      BLOCKING_SUBSCRIPTION_STATUSES.has(subscription.status)
      && (stored || belongsToProcareRelationship(
        subscription,
        input.clientUserId,
        input.proUserId,
      ))
    ) {
      return subscription;
    }
  }
  return null;
}

export async function retrieveProcareCheckoutSession(
  sessionId: string,
  stripeClient: Stripe = getStripe(),
): Promise<Stripe.Checkout.Session> {
  return stripeClient.checkout.sessions.retrieve(sessionId);
}

export function classifyProcareCheckoutSession(input: {
  session: Stripe.Checkout.Session;
  customerId: string;
  clientUserId: string;
  proUserId: string;
  clientLinkId: string;
  checkoutReservationId: string;
}): "reuse" | "rotate" {
  const { session } = input;
  const sessionCustomerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id;
  if (
    sessionCustomerId !== input.customerId
    || session.metadata?.userId !== input.clientUserId
    || session.metadata?.clientUserId !== input.clientUserId
    || session.metadata?.proUserId !== input.proUserId
    || session.metadata?.clientLinkId !== input.clientLinkId
    || session.metadata?.checkoutReservationId !== input.checkoutReservationId
  ) {
    throw new ProcareCheckoutConflictError(
      "PROCARE_BILLING_IDENTITY_REVIEW_REQUIRED",
      "The stored ProCare checkout belongs to a different billing identity.",
    );
  }
  if (session.status === "open" && session.url) return "reuse";
  if (session.status === "expired" || session.status === "complete") return "rotate";
  throw new ProcareCheckoutConflictError(
    "PROCARE_CHECKOUT_ALREADY_COMPLETED",
    "A prior ProCare checkout requires review before another purchase.",
  );
}

/**
 * Create or retrieve a Stripe Connect account for a pro user
 * Using Express account to enable automatic transfers
 */
export async function createConnectAccount(email?: string): Promise<string> {
  const account = await getStripe().accounts.create({
    type: "express",
    email,
    capabilities: {
      transfers: { requested: true },
    },
  });
  return account.id;
}

/**
 * Create an account onboarding link for a pro to complete their Stripe setup
 */
export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<string> {
  const link = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/**
 * Check if a Connect account has completed onboarding
 */
export async function isAccountActive(accountId: string): Promise<boolean> {
  const account = await getStripe().accounts.retrieve(accountId);
  return account.charges_enabled && account.details_submitted;
}

/**
 * Create a checkout session for client subscription ($29.99/month)
 */
export async function createCheckoutSession({
  stripeClient = getStripe(),
  customerId,
  clientUserId,
  proUserId,
  clientLinkId,
  checkoutReservationId,
  successUrl,
  cancelUrl,
  priceId,
}: {
  stripeClient?: Stripe;
  customerId: string;
  clientUserId: string;
  proUserId: string;
  clientLinkId: string;
  checkoutReservationId: string;
  successUrl: string;
  cancelUrl: string;
  priceId: string;
}): Promise<{ id: string; url: string }> {
  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer: customerId,
    metadata: {
      userId: clientUserId,
      clientUserId,
      proUserId,
      clientLinkId,
      checkoutReservationId,
      subscriptionType: "procare_client",
    },
    subscription_data: {
      metadata: {
        userId: clientUserId,
        clientUserId,
        proUserId,
        clientLinkId,
        checkoutReservationId,
        subscriptionType: "procare_client",
      },
    },
  }, {
    idempotencyKey:
      `mpm-procare-checkout:${clientUserId}:${proUserId}:${checkoutReservationId}`,
  });
  
  if (!session.url) {
    throw new Error("Stripe session created but no checkout URL returned");
  }
  return { id: session.id, url: session.url };
}

/**
 * Transfer $10 to a pro's Connect account
 */
export async function transferToPro(
  accountId: string,
  amountCents: number,
  description: string
): Promise<string> {
  const transfer = await getStripe().transfers.create({
    amount: amountCents,
    currency: "usd",
    destination: accountId,
    description,
  });
  return transfer.id;
}

/**
 * Verify webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(payload, signature, secret);
}
