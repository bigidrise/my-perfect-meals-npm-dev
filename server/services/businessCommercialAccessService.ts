import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { businessAccessGrants, businesses } from "../db/schema/business";

export const BUSINESS_ONBOARDING_PILOT_DAYS = 30;
export const PERMANENT_COMPLIMENTARY_BUSINESS_ACCESS =
  "permanent_complimentary_business_access" as const;

type CommercialBusiness = Pick<
  typeof businesses.$inferSelect,
  "status" | "commercialAccessMode" | "commercialAccessStartedAt" | "commercialAccessEndsAt"
>;

export type BusinessCommercialState =
  | "pilot_active"
  | "commercially_active"
  | "commercial_required";

export function deriveBusinessCommercialState(
  business: CommercialBusiness,
  now = new Date(),
): BusinessCommercialState {
  if (business.commercialAccessMode === "onboarding_pilot") {
    return business.commercialAccessEndsAt && now < business.commercialAccessEndsAt
      ? "pilot_active"
      : "commercial_required";
  }
  if (
    business.commercialAccessMode === "paid" ||
    business.commercialAccessMode === "authorized_arrangement"
  ) {
    return business.status === "active" ? "commercially_active" : "commercial_required";
  }
  // Compatibility: existing paid and authorized-pilot organizations predate
  // commercial_access_mode. Their established status remains authoritative.
  return business.status === "active" ? "commercially_active" : "commercial_required";
}

export function createBusinessOnboardingWindow(now = new Date()) {
  const endsAt = new Date(now);
  endsAt.setUTCDate(endsAt.getUTCDate() + BUSINESS_ONBOARDING_PILOT_DAYS);
  return { startedAt: now, endsAt };
}

export async function hasPermanentComplimentaryBusinessAccess(userId: string) {
  const [grant] = await db
    .select({ id: businessAccessGrants.id })
    .from(businessAccessGrants)
    .where(and(
      eq(businessAccessGrants.userId, userId),
      eq(
        businessAccessGrants.grantType,
        PERMANENT_COMPLIMENTARY_BUSINESS_ACCESS,
      ),
      isNull(businessAccessGrants.revokedAt),
    ))
    .limit(1);
  return Boolean(grant);
}