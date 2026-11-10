import { assertOrganizationChargeAllowed, BusinessPilotActivationError } from "./businessPilotActivationPolicy";

/** Purchase authority only. Never gates delivery/reconciliation of an already paid subscription. */
export function organizationPaidContinuationEnabled(): boolean {
  return process.env.ORGANIZATION_PAID_CONTINUATION_ENABLED === "true";
}

export function assertOrganizationPaidContinuationPurchaseAllowed(business: {
  status: string;
  commercialAccessMode: string | null;
  commercialAccessEndsAt: Date | string | null;
}, now = new Date()) {
  if (business.commercialAccessMode !== "onboarding_pilot") return;
  if (!organizationPaidContinuationEnabled()) {
    throw new BusinessPilotActivationError(
      "Organization paid continuation awaits release approval.", "ORGANIZATION_CONTINUATION_NOT_RELEASED", 503,
    );
  }
  if (business.status !== "active") {
    throw new BusinessPilotActivationError(
      "This Organization requires billing review before continuation.", "ORGANIZATION_CONTINUATION_INELIGIBLE", 409,
    );
  }
  assertOrganizationChargeAllowed(business, now);
}

export function assertOrganizationContinuationPrice(quote: {
  unitAmount: number; currency: string; interval: string; intervalCount: number;
}) {
  if (quote.unitAmount !== 4499 || quote.currency.toLowerCase() !== "usd"
    || quote.interval !== "month" || quote.intervalCount !== 1) {
    throw new BusinessPilotActivationError(
      "The Organization subscription must be USD $44.99 per month. No checkout was started.",
      "ORGANIZATION_PRICE_MISMATCH", 503,
    );
  }
}
