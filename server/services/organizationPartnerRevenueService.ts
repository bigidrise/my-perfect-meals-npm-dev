import { eq } from "drizzle-orm";
import { db } from "../db";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { businesses } from "../db/schema/business";
import { organizations } from "../db/schema/organizations";
import { partnerRecords } from "../db/schema/partnerRecords";
import { deriveBusinessCommercialState } from "./businessCommercialAccessService";

export const ORGANIZATION_PARTNER_TERMS = {
  customerDiscount: 10,
  commissionRate: 40,
  commissionMonths: 60,
} as const;

type DatabaseExecutor = Pick<typeof db, "insert">;

export function affiliateAccountScope(organizationId: string) {
  return eq(userAffiliateAccounts.organizationId, organizationId);
}

export function partnerRecordScope(organizationId: string) {
  return eq(partnerRecords.organizationId, organizationId);
}

export type OrganizationPartnerLifecycleState =
  | "not_available"
  | "setup_available"
  | "setup_in_progress"
  | "active";

export async function resolveOrganizationPartnerLifecycle(
  organizationId: string,
  account: typeof userAffiliateAccounts.$inferSelect,
  now = new Date(),
) {
  if (account.rewardfulAffiliateId) {
    return {
      state: account.rewardfulState === "active" ? "active" : "setup_in_progress",
      setupAvailable: true,
      reason: account.rewardfulState === "active" ? "rewardful_active" : "rewardful_linked",
      commercialState: null,
    } as const;
  }

  const [business] = await db
    .select({
      status: businesses.status,
      commercialAccessMode: businesses.commercialAccessMode,
      commercialAccessStartedAt: businesses.commercialAccessStartedAt,
      commercialAccessEndsAt: businesses.commercialAccessEndsAt,
    })
    .from(organizations)
    .innerJoin(businesses, eq(businesses.id, organizations.sourceBusinessId))
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!business) {
    return {
      state: "not_available" as const,
      setupAvailable: false,
      reason: "organization_commercial_record_missing",
      commercialState: null,
    };
  }

  const commercialState = deriveBusinessCommercialState(business, now);
  const expiredOnboardingPilot =
    business.commercialAccessMode === "onboarding_pilot" &&
    commercialState === "commercial_required";
  const establishedOrganization =
    business.commercialAccessMode !== "onboarding_pilot" &&
    commercialState === "commercially_active";
  const setupAvailable = expiredOnboardingPilot || establishedOrganization;

  return {
    state: setupAvailable ? "setup_available" as const : "not_available" as const,
    setupAvailable,
    reason: setupAvailable
      ? expiredOnboardingPilot
        ? "onboarding_pilot_completed"
        : "organization_commercially_active"
      : commercialState === "pilot_active"
        ? "onboarding_pilot_active"
        : "organization_commercial_access_required",
    commercialState,
  };
}

export async function ensureOrganizationPartnerRevenueShell(
  executor: DatabaseExecutor,
  input: { userId: string; organizationId: string; organizationName?: string | null },
) {
  await executor
    .insert(userAffiliateAccounts)
    .values({
      userId: input.userId,
      organizationId: input.organizationId,
      affiliateTrack: "business_affiliate",
      requiredPhases: "phase_1_and_2",
      rewardfulState: "not_activated",
    })
    .onConflictDoNothing({ target: userAffiliateAccounts.organizationId });

  await executor
    .insert(partnerRecords)
    .values({
      userId: input.userId,
      organizationId: input.organizationId,
      partnerName: input.organizationName ?? null,
      partnerTypes: [],
      customerDiscount: ORGANIZATION_PARTNER_TERMS.customerDiscount,
      commissionRate: ORGANIZATION_PARTNER_TERMS.commissionRate,
      commissionMonths: ORGANIZATION_PARTNER_TERMS.commissionMonths,
      status: "not_activated",
    })
    .onConflictDoNothing({ target: partnerRecords.organizationId });
}