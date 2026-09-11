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

export type BusinessPilotWindow = {
  startedAt: Date;
  endsAt: Date;
};

export class BusinessPilotClockConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessPilotClockConflictError";
  }
}

function sameInstant(left: Date | null, right: Date): boolean {
  return left?.getTime() === right.getTime();
}

export function resolveAuthoritativeBusinessPilotWindow(
  business: CommercialBusiness,
): BusinessPilotWindow | null {
  if (business.commercialAccessMode !== "onboarding_pilot") return null;
  if (!business.commercialAccessStartedAt || !business.commercialAccessEndsAt) {
    throw new BusinessPilotClockConflictError(
      "An onboarding pilot must have one complete Business commercial-access window.",
    );
  }
  if (business.commercialAccessEndsAt <= business.commercialAccessStartedAt) {
    throw new BusinessPilotClockConflictError(
      "The Business pilot end must be after its start.",
    );
  }
  return {
    startedAt: business.commercialAccessStartedAt,
    endsAt: business.commercialAccessEndsAt,
  };
}

export function planBusinessPilotWindowReconciliation(
  business: CommercialBusiness & {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  },
  preservedWindow: BusinessPilotWindow,
): {
  commercialAccessMode: "onboarding_pilot";
  commercialAccessStartedAt: Date;
  commercialAccessEndsAt: Date;
} | null {
  if (
    business.commercialAccessMode === "paid" ||
    business.commercialAccessMode === "authorized_arrangement" ||
    business.stripeCustomerId ||
    business.stripeSubscriptionId
  ) {
    throw new BusinessPilotClockConflictError(
      "Paid, Stripe-backed, and authorized-arrangement organizations cannot be converted into onboarding pilots.",
    );
  }
  if (preservedWindow.endsAt <= preservedWindow.startedAt) {
    throw new BusinessPilotClockConflictError(
      "The preserved organizational pilot window is invalid.",
    );
  }
  if (business.commercialAccessMode === "onboarding_pilot") {
    const current = resolveAuthoritativeBusinessPilotWindow(business);
    if (
      !current ||
      !sameInstant(current.startedAt, preservedWindow.startedAt) ||
      !sameInstant(current.endsAt, preservedWindow.endsAt)
    ) {
      throw new BusinessPilotClockConflictError(
        "The Business and organizational pilot windows conflict; reconciliation stopped.",
      );
    }
    return null;
  }
  if (business.commercialAccessStartedAt || business.commercialAccessEndsAt) {
    throw new BusinessPilotClockConflictError(
      "A legacy Business has a partial or unexplained commercial-access window; reconciliation stopped.",
    );
  }
  return {
    commercialAccessMode: "onboarding_pilot",
    commercialAccessStartedAt: preservedWindow.startedAt,
    commercialAccessEndsAt: preservedWindow.endsAt,
  };
}

export function assertOrganizationalPilotMirror(
  authoritativeWindow: BusinessPilotWindow,
  mirror: { pilotStartAt: Date | null; pilotEndAt: Date | null },
): void {
  if (
    !sameInstant(mirror.pilotStartAt, authoritativeWindow.startedAt) ||
    !sameInstant(mirror.pilotEndAt, authoritativeWindow.endsAt)
  ) {
    throw new BusinessPilotClockConflictError(
      "The organizational pilot mirror differs from the authoritative Business window.",
    );
  }
}

export type BusinessCommercialState =
  | "pilot_active"
  | "commercially_active"
  | "commercial_required";

export function deriveBusinessCommercialState(
  business: CommercialBusiness,
  now = new Date(),
): BusinessCommercialState {
  if (business.commercialAccessMode === "onboarding_pilot") {
    return business.status === "active" &&
      business.commercialAccessStartedAt &&
      business.commercialAccessStartedAt <= now &&
      business.commercialAccessEndsAt &&
      now < business.commercialAccessEndsAt
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
  return createBusinessPilotWindow(BUSINESS_ONBOARDING_PILOT_DAYS, now);
}

export function createBusinessPilotWindow(durationDays: number, now = new Date()) {
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
    throw new Error("Business pilot duration must be between 1 and 365 days.");
  }
  const endsAt = new Date(now);
  endsAt.setUTCDate(endsAt.getUTCDate() + durationDays);
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