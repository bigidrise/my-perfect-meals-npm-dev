import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { partnerRecords } from "../db/schema/partnerRecords";

export const ORGANIZATION_PARTNER_TERMS = {
  customerDiscount: 10,
  commissionRate: 40,
  commissionMonths: 60,
} as const;

type DatabaseExecutor = Pick<typeof db, "insert">;

export function affiliateAccountScope(userId: string, organizationId: string) {
  return and(
    eq(userAffiliateAccounts.userId, userId),
    eq(userAffiliateAccounts.organizationId, organizationId),
  );
}

export function partnerRecordScope(userId: string, organizationId: string) {
  return and(
    eq(partnerRecords.userId, userId),
    eq(partnerRecords.organizationId, organizationId),
  );
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