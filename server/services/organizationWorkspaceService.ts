import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { businesses, businessMembers } from "../db/schema/business";
import {
  DEFAULT_ORG_FEATURE_FLAGS,
  organizations,
} from "../db/schema/organizations";
import {
  locationMemberships,
  organizationLocations,
  organizationMemberships,
  userWorkspaceSelections,
} from "../db/schema/workspaces";
import { users } from "@shared/schema";
import { ensureOrganizationPartnerRevenueShell } from "./organizationPartnerRevenueService";

export type WorkspaceLocationOption = {
  id: string;
  name: string;
  role: string;
  isDefault: boolean;
};

export type WorkspaceOrganizationOption = {
  id: string;
  name: string;
  role: string;
  locations: WorkspaceLocationOption[];
};

export type ActiveWorkspaceContext = {
  organizationId: string;
  organizationName: string;
  organizationRole: string;
  locationId: string;
  locationName: string;
  locationRole: string;
  autoSelected: boolean;
};

export class WorkspaceContextError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NO_AUTHORIZED_WORKSPACE"
      | "WORKSPACE_SELECTION_REQUIRED"
      | "INVALID_WORKSPACE_SELECTION",
    public readonly status: number,
  ) {
    super(message);
  }
}

export function selectAuthorizedWorkspace(
  organizationsForUser: WorkspaceOrganizationOption[],
  selected?: { organizationId: string; locationId: string } | null,
): ActiveWorkspaceContext {
  const available = organizationsForUser.flatMap((organization) =>
    organization.locations.map((location) => ({ organization, location })));

  if (selected) {
    const exact = available.find(({ organization, location }) =>
      organization.id === selected.organizationId
      && location.id === selected.locationId);
    if (!exact) {
      throw new WorkspaceContextError(
        "The selected Organization or Location is inactive or no longer available to this account.",
        "INVALID_WORKSPACE_SELECTION",
        403,
      );
    }
    return {
      organizationId: exact.organization.id,
      organizationName: exact.organization.name,
      organizationRole: exact.organization.role,
      locationId: exact.location.id,
      locationName: exact.location.name,
      locationRole: exact.location.role,
      autoSelected: false,
    };
  }

  if (available.length === 0) {
    throw new WorkspaceContextError(
      "No active Organization Location is available to this account.",
      "NO_AUTHORIZED_WORKSPACE",
      404,
    );
  }
  if (available.length > 1) {
    throw new WorkspaceContextError(
      "Select an Organization and Location before continuing.",
      "WORKSPACE_SELECTION_REQUIRED",
      409,
    );
  }

  const [{ organization, location }] = available;
  return {
    organizationId: organization.id,
    organizationName: organization.name,
    organizationRole: organization.role,
    locationId: location.id,
    locationName: location.name,
    locationRole: location.role,
    autoSelected: true,
  };
}

export async function discoverAuthorizedWorkspaces(
  userId: string,
): Promise<WorkspaceOrganizationOption[]> {
  const rows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationRole: organizationMemberships.role,
      locationId: organizationLocations.id,
      locationName: organizationLocations.name,
      locationRole: locationMemberships.role,
      isDefault: organizationLocations.isDefault,
    })
    .from(locationMemberships)
    .innerJoin(
      organizationLocations,
      eq(organizationLocations.id, locationMemberships.locationId),
    )
    .innerJoin(
      organizations,
      eq(organizations.id, organizationLocations.organizationId),
    )
    .leftJoin(
      businesses,
      eq(businesses.id, organizations.sourceBusinessId),
    )
    .innerJoin(
      organizationMemberships,
      and(
        eq(organizationMemberships.organizationId, organizations.id),
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.status, "active"),
      ),
    )
    .where(and(
      eq(locationMemberships.userId, userId),
      eq(locationMemberships.status, "active"),
      eq(organizationLocations.status, "active"),
      eq(organizations.activeStatus, "active"),
      or(
        isNull(organizations.sourceBusinessId),
        eq(businesses.status, "active"),
      ),
    ))
    .orderBy(organizations.name, organizationLocations.name);

  const grouped = new Map<string, WorkspaceOrganizationOption>();
  for (const row of rows) {
    let organization = grouped.get(row.organizationId);
    if (!organization) {
      organization = {
        id: row.organizationId,
        name: row.organizationName,
        role: row.organizationRole,
        locations: [],
      };
      grouped.set(row.organizationId, organization);
    }
    organization.locations.push({
      id: row.locationId,
      name: row.locationName,
      role: row.locationRole,
      isDefault: row.isDefault,
    });
  }
  return [...grouped.values()];
}

export async function persistWorkspaceSelection(
  userId: string,
  organizationId: string,
  locationId: string,
): Promise<ActiveWorkspaceContext> {
  const options = await discoverAuthorizedWorkspaces(userId);
  const context = selectAuthorizedWorkspace(options, { organizationId, locationId });
  await db
    .insert(userWorkspaceSelections)
    .values({ userId, organizationId, locationId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userWorkspaceSelections.userId,
      set: { organizationId, locationId, updatedAt: new Date() },
    });
  return context;
}

export async function resolveActiveWorkspace(
  userId: string,
  sessionSelection?: { organizationId: string; locationId: string } | null,
): Promise<ActiveWorkspaceContext> {
  const options = await discoverAuthorizedWorkspaces(userId);
  if (sessionSelection) {
    return selectAuthorizedWorkspace(options, sessionSelection);
  }

  const [stored] = await db
    .select({
      organizationId: userWorkspaceSelections.organizationId,
      locationId: userWorkspaceSelections.locationId,
    })
    .from(userWorkspaceSelections)
    .where(eq(userWorkspaceSelections.userId, userId))
    .limit(1);

  if (stored) {
    try {
      return selectAuthorizedWorkspace(options, stored);
    } catch (error) {
      if (
        !(error instanceof WorkspaceContextError)
        || error.code !== "INVALID_WORKSPACE_SELECTION"
      ) {
        throw error;
      }
      // A saved selection can outlive billing or access changes. Recover below
      // from the currently authorized active workspace instead of trapping the
      // user in an unpaid or revoked organization.
    }
  }

  const context = selectAuthorizedWorkspace(options);
  if (context.autoSelected) {
    await db
      .insert(userWorkspaceSelections)
      .values({
        userId,
        organizationId: context.organizationId,
        locationId: context.locationId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userWorkspaceSelections.userId,
        set: {
          organizationId: context.organizationId,
          locationId: context.locationId,
          updatedAt: new Date(),
        },
      });
  }
  return context;
}

export async function ensureCanonicalWorkspaceForBusiness(
  businessId: string,
): Promise<{ organizationId: string; locationId: string }> {
  return db.transaction(async (tx) => {
    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!business) throw new Error("Business not found while provisioning workspace.");

    let organizationId = business.organizationId;
    if (!organizationId) {
      const [insertedOrganization] = await tx
        .insert(organizations)
        .values({
          slug: `business-${business.id}`,
          name: business.name,
          activeStatus: business.status === "cancelled" ? "inactive" : "active",
          organizationType: "enterprise",
          dataAccessMode: "standalone",
          sourceBusinessId: business.id,
          featureFlags: DEFAULT_ORG_FEATURE_FLAGS,
        })
        .onConflictDoNothing({ target: organizations.sourceBusinessId })
        .returning({ id: organizations.id });
      if (insertedOrganization) {
        organizationId = insertedOrganization.id;
      } else {
        const [existingOrganization] = await tx
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.sourceBusinessId, business.id))
          .limit(1);
        organizationId = existingOrganization?.id ?? null;
      }
      if (!organizationId) {
        throw new Error("Could not establish the canonical Organization.");
      }
      await tx
        .update(businesses)
        .set({ organizationId, updatedAt: new Date() })
        .where(eq(businesses.id, business.id));
    }

    const [insertedLocation] = await tx
      .insert(organizationLocations)
      .values({
        organizationId,
        name: "Main Location",
        status: business.status === "cancelled" ? "inactive" : "active",
        isDefault: true,
        sourceBusinessId: business.id,
      })
      .onConflictDoNothing({ target: organizationLocations.sourceBusinessId })
      .returning({ id: organizationLocations.id });
    let locationId = insertedLocation?.id;
    if (!locationId) {
      const [existingLocation] = await tx
        .select({ id: organizationLocations.id })
        .from(organizationLocations)
        .where(eq(organizationLocations.sourceBusinessId, business.id))
        .limit(1);
      locationId = existingLocation?.id;
    }
    if (!locationId) throw new Error("Could not establish the default Location.");

    const members = await tx
      .select({ userId: businessMembers.userId, role: businessMembers.role, status: businessMembers.status })
      .from(businessMembers)
      .innerJoin(users, eq(users.id, businessMembers.userId))
      .where(eq(businessMembers.businessId, business.id));
    for (const member of members) {
      const organizationRole =
        member.role === "owner" ? "owner"
          : member.role === "admin" ? "admin"
            : "member";
      const accessStatus = member.status === "active" ? "active" : "revoked";
      await tx
        .insert(organizationMemberships)
        .values({
          organizationId,
          userId: member.userId,
          role: organizationRole,
          status: accessStatus,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [organizationMemberships.organizationId, organizationMemberships.userId],
          set: { role: organizationRole, status: accessStatus, updatedAt: new Date() },
        });
      await tx
        .insert(locationMemberships)
        .values({
          locationId,
          userId: member.userId,
          role: member.role,
          status: accessStatus,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [locationMemberships.locationId, locationMemberships.userId],
          set: { role: member.role, status: accessStatus, updatedAt: new Date() },
        });
    }

    await ensureOrganizationPartnerRevenueShell(tx, {
      userId: business.ownerUserId,
      organizationId,
      organizationName: business.name,
    });

    return { organizationId, locationId };
  });
}