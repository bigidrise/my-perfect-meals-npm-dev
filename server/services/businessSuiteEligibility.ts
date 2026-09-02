import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db";
import { businessInvitations, businessMembers, businesses } from "../db/schema/business";
import { organizationalPilots } from "../db/schema/pilotProgram";
import { normalizeEmailIdentity, resolveEmailIdentityForUser } from "./emailIdentityService";

export const BUSINESS_SUITE_ENTRY_ROLES = [
  "owner",
  "admin",
  "coach",
  "trainer",
  "physician",
  "nurse",
  "staff",
] as const;

export type BusinessSuiteRole = typeof BUSINESS_SUITE_ENTRY_ROLES[number];
export type BusinessSuiteCommercialState =
  | "pilot"
  | "active_paid"
  | "suspended"
  | "ended"
  | "pending";

export interface BusinessSuiteOrganizationEligibility {
  businessId: string;
  organizationName: string;
  membershipId: string;
  membershipStatus: "active";
  role: BusinessSuiteRole;
  commercialState: BusinessSuiteCommercialState;
  canEnter: boolean;
  denialReason: string | null;
}

export interface BusinessSuitePendingInvitation {
  invitationId: string;
  businessId: string;
  organizationName: string;
  role: string;
  expiresAt: Date;
}

export interface BusinessSuiteEligibility {
  canSeeWorkspace: boolean;
  canEnter: boolean;
  selectionRequired: boolean;
  selectedOrganization: BusinessSuiteOrganizationEligibility | null;
  organizations: BusinessSuiteOrganizationEligibility[];
  pendingInvitations: BusinessSuitePendingInvitation[];
  denialReason: string | null;
}

export function evaluateBusinessCommercialState(input: {
  businessStatus: string;
  businessPlan: string;
  pilotStatus?: string | null;
  pilotStartAt?: Date | null;
  pilotEndAt?: Date | null;
  now?: Date;
}): { state: BusinessSuiteCommercialState; active: boolean; reason: string | null } {
  const now = input.now ?? new Date();
  if (input.businessStatus !== "active") {
    const ended = input.businessStatus === "cancelled";
    return {
      state: ended ? "ended" : "suspended",
      active: false,
      reason: ended ? "BUSINESS_ENDED" : "BUSINESS_SUSPENDED",
    };
  }

  if (input.businessPlan !== "organizational_pilot") {
    return { state: "active_paid", active: true, reason: null };
  }

  const activePilot =
    input.pilotStatus === "active" &&
    input.pilotStartAt != null &&
    input.pilotEndAt != null &&
    input.pilotStartAt <= now &&
    input.pilotEndAt > now;
  if (activePilot) return { state: "pilot", active: true, reason: null };

  const pending = input.pilotStatus === "preparing";
  return {
    state: pending ? "pending" : "ended",
    active: false,
    reason: pending ? "PILOT_NOT_ACTIVE" : "PILOT_ENDED",
  };
}

export async function resolveBusinessSuiteEligibility(input: {
  userId: string;
  selectedBusinessId?: string | null;
  now?: Date;
}): Promise<BusinessSuiteEligibility> {
  const now = input.now ?? new Date();
  const membershipRows = await db
    .select({
      membershipId: businessMembers.id,
      membershipStatus: businessMembers.status,
      role: businessMembers.role,
      businessId: businesses.id,
      organizationName: businesses.name,
      businessStatus: businesses.status,
      businessPlan: businesses.plan,
      pilotStatus: organizationalPilots.status,
      pilotStartAt: organizationalPilots.pilotStartAt,
      pilotEndAt: organizationalPilots.pilotEndAt,
    })
    .from(businessMembers)
    .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
    .leftJoin(organizationalPilots, eq(organizationalPilots.businessId, businesses.id))
    .where(and(
      eq(businessMembers.userId, input.userId),
      eq(businessMembers.status, "active"),
      inArray(businessMembers.role, [...BUSINESS_SUITE_ENTRY_ROLES]),
    ));

  const organizations = membershipRows.map((row) => {
    const commercial = evaluateBusinessCommercialState({
      businessStatus: row.businessStatus,
      businessPlan: row.businessPlan,
      pilotStatus: row.pilotStatus,
      pilotStartAt: row.pilotStartAt,
      pilotEndAt: row.pilotEndAt,
      now,
    });
    return {
      businessId: row.businessId,
      organizationName: row.organizationName,
      membershipId: row.membershipId,
      membershipStatus: "active" as const,
      role: row.role as BusinessSuiteRole,
      commercialState: commercial.state,
      canEnter: commercial.active,
      denialReason: commercial.reason,
    };
  });

  let pendingInvitations: BusinessSuitePendingInvitation[] = [];
  const identity = await resolveEmailIdentityForUser(input.userId);
  if (identity.status === "unique") {
    const normalizedEmail = normalizeEmailIdentity(identity.user.email);
    pendingInvitations = await db
      .select({
        invitationId: businessInvitations.id,
        businessId: businesses.id,
        organizationName: businesses.name,
        role: businessInvitations.role,
        expiresAt: businessInvitations.expiresAt,
      })
      .from(businessInvitations)
      .innerJoin(businesses, eq(businesses.id, businessInvitations.businessId))
      .where(and(
        eq(businessInvitations.email, normalizedEmail),
        eq(businessInvitations.status, "pending"),
        eq(businessInvitations.invitationType, "team_member"),
        gt(businessInvitations.expiresAt, now),
      ));
  }

  const activeOrganizations = organizations.filter((organization) => organization.canEnter);
  const selectedOrganization = input.selectedBusinessId
    ? organizations.find((organization) => organization.businessId === input.selectedBusinessId) ?? null
    : activeOrganizations.length === 1
      ? activeOrganizations[0]
      : null;
  const selectionRequired = !input.selectedBusinessId && activeOrganizations.length > 1;
  const canEnter = selectedOrganization?.canEnter === true;

  return {
    canSeeWorkspace: activeOrganizations.length > 0 || pendingInvitations.length > 0,
    canEnter,
    selectionRequired,
    selectedOrganization,
    organizations,
    pendingInvitations,
    denialReason: canEnter
      ? null
      : selectionRequired
        ? "ORGANIZATION_SELECTION_REQUIRED"
        : input.selectedBusinessId && !selectedOrganization
          ? "ORGANIZATION_NOT_AUTHORIZED"
          : organizations[0]?.denialReason ?? (pendingInvitations.length ? "INVITATION_PENDING" : "NO_BUSINESS_MEMBERSHIP"),
  };
}
