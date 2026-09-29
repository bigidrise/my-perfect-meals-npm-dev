import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { businesses } from "../db/schema/business";
import { organizations } from "../db/schema/organizations";
import { discoverAuthorizedWorkspaces } from "./organizationWorkspaceService";
import { readServiceBillingStatus } from "./serviceBillingStatus";
import type { OrganizationAccessEntry, OrganizationAccessStatus } from "@shared/serviceBilling";

type OwnedBusiness = Pick<typeof businesses.$inferSelect,
  "id" | "name" | "organizationId" | "ownerUserId" | "status" | "commercialAccessMode" |
  "commercialAccessStartedAt" | "commercialAccessEndsAt" | "stripeCustomerId" | "stripeSubscriptionId" |
  "ownerWorkspaceDisconnectedAt"
>;

export function resolveOwnedOrganizationEntry(
  business: OwnedBusiness,
  billing: { state: "active" | "ending" | "expired" | "needs_review"; paidThrough: string | null } | null,
  now: Date = new Date(),
  hasWorkspace: boolean = Boolean(business.organizationId),
): OrganizationAccessEntry {
  const attachment = {
    addonBusinessId: hasWorkspace ? business.id : null,
    canDisconnectAddon: hasWorkspace && business.status === "active" &&
      business.ownerWorkspaceDisconnectedAt == null,
    canReconnectAddon: hasWorkspace && business.ownerWorkspaceDisconnectedAt != null,
  };
  if (business.commercialAccessMode === "onboarding_pilot" && !business.stripeSubscriptionId) {
    if (!business.commercialAccessStartedAt || !business.commercialAccessEndsAt) {
      return { name: business.name, state: "needs_review", accessSource: "pilot", paidThrough: null,
        businessId: null, canManageRenewal: false, canReconnect: false, ...attachment,
        canDisconnectAddon: false };
    }
    const active = business.status === "active" &&
      business.commercialAccessStartedAt <= now && business.commercialAccessEndsAt > now;
    return { name: business.name,
      state: active ? "managed_access" : "not_active",
      accessSource: "pilot", paidThrough: null, businessId: null,
      canManageRenewal: false, canReconnect: false, ...attachment,
      canDisconnectAddon: attachment.canDisconnectAddon && active };
  }
  if (business.commercialAccessMode === "authorized_arrangement" && !business.stripeSubscriptionId) {
    const active = business.status === "active" &&
      (!business.commercialAccessEndsAt || business.commercialAccessEndsAt > now);
    return { name: business.name,
      state: active ? "managed_access" : "not_active",
      accessSource: "arrangement", paidThrough: null, businessId: null,
      canManageRenewal: false, canReconnect: false, ...attachment,
      canDisconnectAddon: attachment.canDisconnectAddon && active };
  }
  if (business.commercialAccessMode === "onboarding_pilot" && business.stripeSubscriptionId) {
    return { name: business.name, state: "needs_review", accessSource: "unknown", paidThrough: null,
      businessId: null, canManageRenewal: false, canReconnect: false, ...attachment,
      canDisconnectAddon: false };
  }
  if (!business.stripeCustomerId || !business.stripeSubscriptionId) {
    return { name: business.name, state: "needs_review", accessSource: "unknown", paidThrough: null,
      businessId: null, canManageRenewal: false, canReconnect: false, ...attachment,
      canDisconnectAddon: false };
  }
  if (!billing) return { name: business.name, state: "needs_review", accessSource: "unknown",
    paidThrough: null, businessId: null, canManageRenewal: false, canReconnect: false, ...attachment,
    canDisconnectAddon: false };
  // Subscription and commercial state must agree. Neither one alone proves
  // that the workspace is currently available.
  if ((billing.state === "active" || billing.state === "ending") &&
      business.status !== "active") {
    return { name: business.name, state: "needs_review", accessSource: "paid", paidThrough: null,
      businessId: null, canManageRenewal: false, canReconnect: false, ...attachment,
      canDisconnectAddon: false };
  }
  if (billing.state === "expired" && business.status === "active") {
    return { name: business.name, state: "needs_review", accessSource: "paid", paidThrough: null,
      businessId: null, canManageRenewal: false, canReconnect: false, ...attachment,
      canDisconnectAddon: false };
  }
  const state = billing.state;
  const manageable = business.commercialAccessMode === "paid" &&
    business.status === "active" &&
    (state === "active" || state === "ending");
  const reconnectable = business.commercialAccessMode === "paid" &&
    business.status === "cancelled" && state === "expired";
  return { name: business.name, state,
    accessSource: billing.state === "needs_review" ? "unknown" : "paid",
    paidThrough: billing.paidThrough,
    businessId: manageable || reconnectable ? business.id : null,
    canManageRenewal: manageable,
    canReconnect: reconnectable,
    ...attachment,
    canDisconnectAddon: attachment.canDisconnectAddon &&
      (billing.state === "active" || billing.state === "ending"),
  };
}

/** The owner sees their own historical business even when it is no longer an active workspace. */
export async function getOrganizationAccessStatus(userId: string): Promise<OrganizationAccessStatus> {
  const [workspaces, owned] = await Promise.all([
    discoverAuthorizedWorkspaces(userId),
    db.select({
      id: businesses.id,
      name: businesses.name,
      organizationId: businesses.organizationId,
      ownerUserId: businesses.ownerUserId,
      status: businesses.status,
      commercialAccessMode: businesses.commercialAccessMode,
      commercialAccessStartedAt: businesses.commercialAccessStartedAt,
      commercialAccessEndsAt: businesses.commercialAccessEndsAt,
      stripeCustomerId: businesses.stripeCustomerId,
      stripeSubscriptionId: businesses.stripeSubscriptionId,
      ownerWorkspaceDisconnectedAt: businesses.ownerWorkspaceDisconnectedAt,
    }).from(businesses).where(eq(businesses.ownerUserId, userId)),
  ]);
  const linkedOrganizations = owned.length
    ? await db.select({
        id: organizations.id,
        sourceBusinessId: organizations.sourceBusinessId,
      }).from(organizations).where(inArray(
        organizations.sourceBusinessId,
        owned.map((business) => business.id),
      ))
    : [];
  const entries = await Promise.all(owned.map(async (business) => {
    const billing = business.stripeCustomerId && business.stripeSubscriptionId
      ? await readServiceBillingStatus({
          serviceType: "organization",
          ownerUserId: business.ownerUserId,
          stripeCustomerId: business.stripeCustomerId,
          stripeSubscriptionId: business.stripeSubscriptionId,
          businessId: business.id,
          trustedPlanKey: "clinical_business_monthly",
        })
      : null;
    return resolveOwnedOrganizationEntry(business, billing, new Date(),
      Boolean(business.organizationId || linkedOrganizations.some((link) => link.sourceBusinessId === business.id)));
  }));
  // Legacy business links may live on the organization rather than on the
  // business row. Compare exact IDs so owners do not see a duplicate card.
  for (const workspace of workspaces) {
    if (owned.some((business) => business.organizationId === workspace.id) ||
        linkedOrganizations.some((link) => link.id === workspace.id)) continue;
    entries.push({
      name: workspace.name,
      state: workspace.role === "owner" ? "needs_review" : "managed_access",
      accessSource: workspace.role === "owner" ? "unknown" : "organization",
      paidThrough: null,
      businessId: null,
      canManageRenewal: false,
      canReconnect: false,
    });
  }
  return { organizations: entries };
}