import Stripe from "stripe";

// Organization-only policy. The shared legacy campaign configuration is unchanged.
export const FOUNDING_ORGANIZATION_CAMPAIGN = {
  id: "aafa0a9e-5c3b-495a-a515-20b2b656cc0d",
  name: "Founding Partner Referral Program",
  commissionRate: 50,
  commissionMonths: 48,
} as const;

export function foundingOrganizationPolicyEnabled() {
  return process.env.NODE_ENV === "development";
}

export function organizationRewardfulCampaignId() {
  return foundingOrganizationPolicyEnabled()
    ? FOUNDING_ORGANIZATION_CAMPAIGN.id
    : process.env.REWARDFUL_CAMPAIGN_ID ?? "";
}

export type OrganizationPaymentEvidence = {
  status: string;
  commercialAccessMode: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeLastEventCreatedAt?: Date | null;
  createdAt?: Date | null;
  commercialAccessEndsAt?: Date | null;
};

export function hasRecordedOrganizationPaidActivation(business: OrganizationPaymentEvidence, at = new Date()) {
  const now = at.getTime();
  // Paid transitions clear the pilot window. Retain the organization creation
  // date as a minimum 30-day backstop, in addition to paid billing authority.
  const trialCompleted = !!business.createdAt
    && Number.isFinite(business.createdAt.getTime())
    && business.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000 <= now
    && (!business.commercialAccessEndsAt || business.commercialAccessEndsAt.getTime() <= now);
  return business.status === "active"
    && business.commercialAccessMode === "paid"
    && trialCompleted
    && !!business.stripeCustomerId?.startsWith("cus_")
    && !!business.stripeSubscriptionId?.startsWith("sub_")
    && !!business.stripeLastEventCreatedAt;
}

export function assertFoundingOrganizationCampaign(campaign: {
  id: string;
  name: string;
  reward_type: string;
  commission_percent: number;
  max_commission_period_months: number | null;
}) {
  if (campaign.id !== FOUNDING_ORGANIZATION_CAMPAIGN.id
    || campaign.name !== FOUNDING_ORGANIZATION_CAMPAIGN.name
    || campaign.reward_type !== "percent"
    || campaign.commission_percent !== FOUNDING_ORGANIZATION_CAMPAIGN.commissionRate
    || campaign.max_commission_period_months !== FOUNDING_ORGANIZATION_CAMPAIGN.commissionMonths) {
    throw new Error("The organization Rewardful campaign does not match the approved 50% / 48-month terms.");
  }
}

// Read-only verification immediately before creation. No Stripe mutations.
export async function verifyOrganizationRewardfulPayment(
  business: OrganizationPaymentEvidence,
  stripeClient?: Pick<Stripe, "subscriptions" | "invoices">,
): Promise<boolean> {
  if (!hasRecordedOrganizationPaidActivation(business)) return false;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!stripeClient && !key) return false;
  const stripe = stripeClient ?? new Stripe(key!, { timeout: 15000, maxNetworkRetries: 0 });
  const subscription = await stripe.subscriptions.retrieve(business.stripeSubscriptionId!);
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer : subscription.customer.id;
  if (subscription.status !== "active" || customerId !== business.stripeCustomerId
    || (subscription.trial_end != null && subscription.trial_end * 1000 > Date.now())
    || !subscription.latest_invoice) return false;
  const invoice = typeof subscription.latest_invoice === "string"
    ? await stripe.invoices.retrieve(subscription.latest_invoice) : subscription.latest_invoice;
  return invoice.status === "paid" && invoice.amount_paid > 0;
}
