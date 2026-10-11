import { sql } from "drizzle-orm";
import { db } from "../db";
import { BusinessPilotActivationError, ORGANIZATION_BILLING_TERMS_VERSION } from "./businessPilotActivationPolicy";

export interface OrganizationPriceQuote {
  priceId: string; unitAmount: number; currency: string;
  interval: string; intervalCount: number; termsVersion: string;
}
export function organizationQuoteFromPrice(price: any, priceId: string): OrganizationPriceQuote {
  if (price.id !== priceId || price.active !== true || !Number.isInteger(price.unit_amount)
      || price.unit_amount < 0 || !price.currency || !price.recurring?.interval
      || !Number.isInteger(price.recurring.interval_count) || price.recurring.interval_count < 1) {
    throw new BusinessPilotActivationError("The Organization price could not be verified.", "PRICE_NOT_VERIFIED", 503);
  }
  return {
    priceId, unitAmount: price.unit_amount, currency: price.currency,
    interval: price.recurring.interval, intervalCount: price.recurring.interval_count,
    termsVersion: ORGANIZATION_BILLING_TERMS_VERSION,
  };
}
export async function recordOrganizationCheckoutConsent(
  reservationId: string, businessId: string, userId: string, quote: OrganizationPriceQuote,
) {
  await db.execute(sql`INSERT INTO organization_checkout_consents
    (reservation_id, business_id, actor_user_id, price_id, unit_amount, currency,
     billing_interval, interval_count, terms_version)
    VALUES (${reservationId}, ${businessId}, ${userId}, ${quote.priceId},
      ${quote.unitAmount}, ${quote.currency}, ${quote.interval}, ${quote.intervalCount}, ${quote.termsVersion})
    ON CONFLICT (reservation_id) DO NOTHING`);
  // An idempotency key is not permission to reuse consent for a different subject/price.
  await assertOrganizationCheckoutConsent(reservationId, businessId, userId, quote.priceId);
}
export async function assertOrganizationCheckoutConsent(
  reservationId: string, businessId: string, userId: string, priceId: string,
) {
  const result: any = await db.execute(sql`SELECT reservation_id FROM organization_checkout_consents
    WHERE reservation_id = ${reservationId} AND business_id = ${businessId}
      AND actor_user_id = ${userId} AND price_id = ${priceId}
      AND terms_version = ${ORGANIZATION_BILLING_TERMS_VERSION} AND quantity = 1`);
  if (!(result.rows ?? result).length) {
    throw new BusinessPilotActivationError("Billing consent could not be verified.", "BILLING_CONSENT_NOT_VERIFIED", 409);
  }
}
