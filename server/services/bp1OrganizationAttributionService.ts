import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { organizations } from "../db/schema/organizations";
import { partnerRecords } from "../db/schema/partnerRecords";
import {
  discoverAuthorizedWorkspaces,
  selectAuthorizedWorkspace,
  WorkspaceContextError,
} from "./organizationWorkspaceService";
import { ensureOrganizationPartnerRevenueShell } from "./organizationPartnerRevenueService";
import { organizationLocations } from "../db/schema/workspaces";
import type { Studio } from "../db/schema/studio";

export type Bp1Attribution = {
  organizationId: string;
  locationId: string;
  sourceBusinessId: string | null;
  partnerRecordId: string | null;
};

async function partnerAttribution(
  organizationId: string,
  actorUserId: string,
): Promise<{ sourceBusinessId: string | null; partnerRecordId: string | null }> {
  const [organization] = await db
    .select({ sourceBusinessId: organizations.sourceBusinessId, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!organization) {
    throw new WorkspaceContextError(
      "The selected Organization is no longer available.",
      "INVALID_WORKSPACE_SELECTION",
      403,
    );
  }
  await ensureOrganizationPartnerRevenueShell(db, {
    userId: actorUserId,
    organizationId,
    organizationName: organization.name,
  });
  const [partner] = await db
    .select({ id: partnerRecords.id })
    .from(partnerRecords)
    .where(eq(partnerRecords.organizationId, organizationId))
    .limit(1);
  return {
    sourceBusinessId: organization.sourceBusinessId ?? null,
    partnerRecordId: partner ? String(partner.id) : null,
  };
}

export async function resolveBp1Attribution(
  actorUserId: string,
  workspace: { organizationId: string; locationId: string },
): Promise<Bp1Attribution> {
  const options = await discoverAuthorizedWorkspaces(actorUserId);
  const context = selectAuthorizedWorkspace(options, workspace);
  const partner = await partnerAttribution(context.organizationId, actorUserId);
  return {
    organizationId: context.organizationId,
    locationId: context.locationId,
    ...partner,
  };
}

/**
 * A provider's users.organizationId is intentionally not consulted here.
 * Studio attribution comes only from an exact Studio binding plus an active
 * canonical provider workspace, or from an explicitly selected workspace.
 */
export async function resolveProviderStudioAttribution(
  providerUserId: string,
  studio: Pick<Studio, "orgId">,
  selected?: { organizationId: string; locationId: string } | null,
): Promise<Bp1Attribution> {
  const options = await discoverAuthorizedWorkspaces(providerUserId);
  let context;
  if (studio.orgId) {
    const bound = options.find((option) => option.id === studio.orgId);
    if (!bound) {
      throw new WorkspaceContextError(
        "This Studio is not bound to an active Organization workspace for this provider.",
        "INVALID_WORKSPACE_SELECTION",
        403,
      );
    }
    if (selected && selected.organizationId !== studio.orgId) {
      throw new WorkspaceContextError(
        "The selected workspace does not match this Studio.",
        "INVALID_WORKSPACE_SELECTION",
        403,
      );
    }
    context = selectAuthorizedWorkspace([bound], selected ?? null);
  } else {
    context = selectAuthorizedWorkspace(options, selected ?? null);
  }
  const partner = await partnerAttribution(context.organizationId, providerUserId);
  return {
    organizationId: context.organizationId,
    locationId: context.locationId,
    ...partner,
  };
}

export function attributionColumns(attribution: Bp1Attribution) {
  return {
    organizationId: attribution.organizationId,
    locationId: attribution.locationId,
    sourceBusinessId: attribution.sourceBusinessId,
    partnerRecordId: attribution.partnerRecordId,
  };
}

export async function validateBp1Attribution(attribution: Bp1Attribution) {
  const [organization] = await db
    .select({ id: organizations.id, sourceBusinessId: organizations.sourceBusinessId, activeStatus: organizations.activeStatus })
    .from(organizations)
    .where(eq(organizations.id, attribution.organizationId))
    .limit(1);
  if (!organization || organization.activeStatus !== "active") {
    throw new WorkspaceContextError("The attributed Organization is inactive.", "INVALID_WORKSPACE_SELECTION", 409);
  }
  const [location] = await db
    .select({ id: organizationLocations.id })
    .from(organizationLocations)
    .where(and(
      eq(organizationLocations.id, attribution.locationId),
      eq(organizationLocations.organizationId, attribution.organizationId),
      eq(organizationLocations.status, "active"),
    ))
    .limit(1);
  if (!location) {
    throw new WorkspaceContextError("The attributed Organization Location is inactive.", "INVALID_WORKSPACE_SELECTION", 409);
  }
  if (
    attribution.sourceBusinessId
    && organization.sourceBusinessId
    && attribution.sourceBusinessId !== organization.sourceBusinessId
  ) {
    throw new WorkspaceContextError("The invitation source Business does not match its Organization.", "INVALID_WORKSPACE_SELECTION", 409);
  }
  if (attribution.partnerRecordId) {
    if (!/^\d+$/.test(attribution.partnerRecordId)) {
      throw new WorkspaceContextError("The attributed Organization partner record is invalid.", "INVALID_WORKSPACE_SELECTION", 409);
    }
    const [partner] = await db
      .select({ id: partnerRecords.id })
      .from(partnerRecords)
      .where(and(
        eq(partnerRecords.organizationId, attribution.organizationId),
        eq(partnerRecords.id, Number(attribution.partnerRecordId)),
      ))
      .limit(1);
    if (!partner) {
      throw new WorkspaceContextError("The attributed Organization partner record is invalid.", "INVALID_WORKSPACE_SELECTION", 409);
    }
  }
}