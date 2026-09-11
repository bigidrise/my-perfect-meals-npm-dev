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

export function deriveOrganizationPartnerLifecycle(input: {
  rewardfulAffiliateId: string | null;
  rewardfulState: string;
  business: {
    status: "active" | "cancelled" | "past_due" | "pending_billing";
    commercialAccessMode: "onboarding_pilot" | "paid" | "authorized_arrangement" | null;
    commercialAccessStartedAt: Date | null;
    commercialAccessEndsAt: Date | null;
  } | null;
  now?: Date;
}) {
  if (input.rewardfulAffiliateId) {
    return {
      state: input.rewardfulState === "active" ? "active" : "setup_in_progress",
      setupAvailable: true,
      reason: input.rewardfulState === "active" ? "rewardful_active" : "rewardful_linked",
      commercialState: null,
    } as const;
  }
  if (input.rewardfulState === "setup_in_progress") {
    return {
      state: "setup_in_progress" as const,
      setupAvailable: false,
      reason: "rewardful_creation_in_progress",
      commercialState: null,
    };
  }
  if (!input.business) {
    return {
      state: "not_available" as const,
      setupAvailable: false,
      reason: "organization_commercial_record_missing",
      commercialState: null,
    };
  }
  const commercialState = deriveBusinessCommercialState(input.business, input.now);
  const expiredOnboardingPilot =
    input.business.commercialAccessMode === "onboarding_pilot" &&
    commercialState === "commercial_required";
  const establishedOrganization =
    input.business.commercialAccessMode !== "onboarding_pilot" &&
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

export async function resolveOrganizationPartnerLifecycle(
  organizationId: string,
  account: typeof userAffiliateAccounts.$inferSelect,
  now = new Date(),
) {
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

  return deriveOrganizationPartnerLifecycle({
    rewardfulAffiliateId: account.rewardfulAffiliateId,
    rewardfulState: account.rewardfulState ?? "not_activated",
    business: business ?? null,
    now,
  });
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