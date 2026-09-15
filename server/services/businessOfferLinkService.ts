import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import {
  businessOfferEntitlements,
  businessOfferLinks,
} from "../db/schema/businessOfferLinks";
import { organizations } from "../db/schema/organizations";
import { organizationLocations } from "../db/schema/workspaces";

export const BUSINESS_OFFER_DURATIONS = [7, 14, 30] as const;
export type BusinessOfferDuration = typeof BUSINESS_OFFER_DURATIONS[number];

function assertDuration(value: number): asserts value is BusinessOfferDuration {
  if (!BUSINESS_OFFER_DURATIONS.includes(value as BusinessOfferDuration)) {
    throw new Error("INVALID_BUSINESS_OFFER_DURATION");
  }
}

const entitlementEnd = (start: Date, days: number) =>
  new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

export function businessOfferJoinPath(publicToken: string, referralToken: string): string {
  const via = encodeURIComponent(referralToken);
  return `/join/business-offer?via=${via}#token=${encodeURIComponent(publicToken)}`;
}

export async function ensureDefaultBusinessOffers(input: {
  actorUserId: string;
  organizationId: string;
  locationId: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.organizationId}))`);
    const [organization] = await tx.select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.id, input.organizationId), eq(organizations.activeStatus, "active")))
      .limit(1);
    const [location] = await tx.select({ id: organizationLocations.id })
      .from(organizationLocations)
      .where(and(
        eq(organizationLocations.id, input.locationId),
        eq(organizationLocations.organizationId, input.organizationId),
        eq(organizationLocations.status, "active"),
      ))
      .limit(1);
    if (!organization || !location) throw new Error("BUSINESS_OFFER_WORKSPACE_INACTIVE");

    const [affiliate] = await tx.select().from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.organizationId, input.organizationId))
      .limit(1);
    if (
      !affiliate?.rewardfulAffiliateId ||
      !affiliate.rewardfulReferralToken ||
      affiliate.rewardfulState !== "active"
    ) {
      throw new Error("BUSINESS_OFFER_REWARDFUL_REQUIRED");
    }

    for (const duration of BUSINESS_OFFER_DURATIONS) {
      await tx.insert(businessOfferLinks).values({
        organizationId: input.organizationId,
        locationId: input.locationId,
        affiliateAccountId: affiliate.id,
        rewardfulAffiliateId: affiliate.rewardfulAffiliateId,
        rewardfulReferralToken: affiliate.rewardfulReferralToken,
        name: `${duration}-Day Free Access`,
        trialDays: duration,
        createdByUserId: input.actorUserId,
      }).onConflictDoNothing({
        target: [
          businessOfferLinks.organizationId,
          businessOfferLinks.locationId,
          businessOfferLinks.trialDays,
        ],
      });
    }

    return tx.select().from(businessOfferLinks)
      .where(and(
        eq(businessOfferLinks.organizationId, input.organizationId),
        eq(businessOfferLinks.locationId, input.locationId),
      ))
      .orderBy(asc(businessOfferLinks.trialDays));
  });
}

export async function inspectBusinessOffer(publicToken: string) {
  const [offer] = await db.select({
    id: businessOfferLinks.id,
    organizationName: organizations.name,
    trialDays: businessOfferLinks.trialDays,
    name: businessOfferLinks.name,
    status: businessOfferLinks.status,
    startsAt: businessOfferLinks.startsAt,
    expiresAt: businessOfferLinks.expiresAt,
    maxRedemptions: businessOfferLinks.maxRedemptions,
    rewardfulReferralToken: businessOfferLinks.rewardfulReferralToken,
    organizationStatus: organizations.activeStatus,
    locationStatus: organizationLocations.status,
    affiliateState: userAffiliateAccounts.rewardfulState,
    affiliateId: userAffiliateAccounts.rewardfulAffiliateId,
  }).from(businessOfferLinks)
    .innerJoin(organizations, eq(organizations.id, businessOfferLinks.organizationId))
    .innerJoin(organizationLocations, eq(organizationLocations.id, businessOfferLinks.locationId))
    .innerJoin(userAffiliateAccounts, eq(userAffiliateAccounts.id, businessOfferLinks.affiliateAccountId))
    .where(eq(businessOfferLinks.publicToken, publicToken))
    .limit(1);
  if (!offer) return null;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(businessOfferEntitlements)
    .where(eq(businessOfferEntitlements.offerId, offer.id));
  const now = new Date();
  const available = offer.status === "active"
    && offer.organizationStatus === "active"
    && offer.locationStatus === "active"
    && offer.affiliateState === "active"
    && Boolean(offer.affiliateId)
    && (!offer.startsAt || offer.startsAt <= now)
    && (!offer.expiresAt || offer.expiresAt > now)
    && (offer.maxRedemptions == null || Number(count) < offer.maxRedemptions);
  return { ...offer, redemptionCount: Number(count ?? 0), available };
}

export async function redeemBusinessOffer(publicToken: string, userId: string, existingTx?: any) {
  const run = async (tx: any) => {
    const [offer] = await tx.select().from(businessOfferLinks)
      .where(eq(businessOfferLinks.publicToken, publicToken)).limit(1);
    if (!offer) throw new Error("BUSINESS_OFFER_NOT_FOUND");
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${offer.id}))`);
    const [existing] = await tx.select().from(businessOfferEntitlements)
      .where(and(
        eq(businessOfferEntitlements.offerId, offer.id),
        eq(businessOfferEntitlements.userId, userId),
      )).limit(1);
    if (existing) return { entitlement: existing, alreadyRedeemed: true };

    const now = new Date();
    const [valid] = await tx.select({ id: businessOfferLinks.id })
      .from(businessOfferLinks)
      .innerJoin(organizations, and(
        eq(organizations.id, businessOfferLinks.organizationId),
        eq(organizations.activeStatus, "active"),
      ))
      .innerJoin(organizationLocations, and(
        eq(organizationLocations.id, businessOfferLinks.locationId),
        eq(organizationLocations.organizationId, businessOfferLinks.organizationId),
        eq(organizationLocations.status, "active"),
      ))
      .innerJoin(userAffiliateAccounts, and(
        eq(userAffiliateAccounts.id, businessOfferLinks.affiliateAccountId),
        eq(userAffiliateAccounts.organizationId, businessOfferLinks.organizationId),
        eq(userAffiliateAccounts.rewardfulAffiliateId, businessOfferLinks.rewardfulAffiliateId),
        eq(userAffiliateAccounts.rewardfulState, "active"),
      ))
      .where(and(
        eq(businessOfferLinks.id, offer.id),
        eq(businessOfferLinks.status, "active"),
        or(isNull(businessOfferLinks.startsAt), lte(businessOfferLinks.startsAt, now)),
        or(isNull(businessOfferLinks.expiresAt), gt(businessOfferLinks.expiresAt, now)),
      )).limit(1);
    if (!valid) throw new Error("BUSINESS_OFFER_UNAVAILABLE");
    assertDuration(offer.trialDays);
    if (offer.maxRedemptions != null) {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` })
        .from(businessOfferEntitlements)
        .where(eq(businessOfferEntitlements.offerId, offer.id));
      if (Number(count) >= offer.maxRedemptions) throw new Error("BUSINESS_OFFER_CAPACITY");
    }
    const [user] = await tx.select({
      id: users.id,
      attributionOrganizationId: users.attributionOrganizationId,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("USER_NOT_FOUND");

    const [entitlement] = await tx.insert(businessOfferEntitlements).values({
      userId,
      offerId: offer.id,
      organizationId: offer.organizationId,
      locationId: offer.locationId,
      affiliateAccountId: offer.affiliateAccountId,
      rewardfulAffiliateId: offer.rewardfulAffiliateId,
      rewardfulReferralToken: offer.rewardfulReferralToken,
      grantedDurationDays: offer.trialDays,
      startsAt: now,
      endsAt: entitlementEnd(now, offer.trialDays),
    }).returning();
    if (!user.attributionOrganizationId) {
      await tx.update(users).set({ attributionOrganizationId: offer.organizationId })
        .where(and(eq(users.id, userId), isNull(users.attributionOrganizationId)));
    }
    return { entitlement, alreadyRedeemed: false };
  };
  return existingTx ? run(existingTx) : db.transaction(run);
}

export async function getActiveBusinessOfferEntitlement(userId: string, now = new Date()) {
  const [entitlement] = await db.select().from(businessOfferEntitlements)
    .where(and(
      eq(businessOfferEntitlements.userId, userId),
      eq(businessOfferEntitlements.status, "active"),
      lte(businessOfferEntitlements.startsAt, now),
      gt(businessOfferEntitlements.endsAt, now),
    )).orderBy(asc(businessOfferEntitlements.redeemedAt)).limit(1);
  return entitlement ?? null;
}

export async function getBusinessOfferCheckoutAttribution(userId: string) {
  const [row] = await db.select({
    organizationId: businessOfferEntitlements.organizationId,
    affiliateId: businessOfferEntitlements.rewardfulAffiliateId,
    referralToken: businessOfferEntitlements.rewardfulReferralToken,
    offerId: businessOfferEntitlements.offerId,
  }).from(businessOfferEntitlements)
    .innerJoin(users, and(
      eq(users.id, userId),
      eq(users.attributionOrganizationId, businessOfferEntitlements.organizationId),
    ))
    .where(eq(businessOfferEntitlements.userId, userId))
    .orderBy(asc(businessOfferEntitlements.redeemedAt))
    .limit(1);
  return row ?? null;
}