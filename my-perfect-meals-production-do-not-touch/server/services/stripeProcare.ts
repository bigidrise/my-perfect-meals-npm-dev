import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

/**
 * Create or retrieve a Stripe Connect account for a pro user
 * Using Express account to enable automatic transfers
 */
export async function createConnectAccount(email?: string): Promise<string> {
  const account = await stripe.accounts.create({
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
  const link = await stripe.accountLinks.create({
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
  const account = await stripe.accounts.retrieve(accountId);
  return account.charges_enabled && account.details_submitted;
}

/**
 * Create a checkout session for client subscription ($29.99/month)
 */
export async function createCheckoutSession({
  clientEmail,
  clientUserId,
  proUserId,
  successUrl,
  cancelUrl,
  priceId,
}: {
  clientEmail?: string;
  clientUserId: string;
  proUserId: string;
  successUrl: string;
  cancelUrl: string;
  priceId: string;
}): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: clientEmail,
    customer_creation: "if_required",
    metadata: { clientUserId, proUserId },
    subscription_data: {
      metadata: { clientUserId, proUserId },
    },
  });
  
  return session.url || "";
}

/**
 * Transfer $10 to a pro's Connect account
 */
export async function transferToPro(
  accountId: string,
  amountCents: number,
  description: string
): Promise<string> {
  const transfer = await stripe.transfers.create({
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
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
