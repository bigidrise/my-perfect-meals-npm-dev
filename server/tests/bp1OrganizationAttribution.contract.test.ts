import fs from "fs";
import path from "path";
import {
  selectAuthorizedWorkspace,
  WorkspaceContextError,
  type WorkspaceOrganizationOption,
} from "../services/organizationWorkspaceService";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const businessSchema = read("server/db/schema/business.ts");
const careSchema = read("server/db/schema/careTeam.ts");
const procareSchema = read("server/db/schema/procare.ts");
const studioSchema = read("server/db/schema/studio.ts");
const migration = read("server/db/migrations/runBp1OrganizationAttributionMigration.ts");
const attribution = read("server/services/bp1OrganizationAttributionService.ts");
const activation = read("server/services/procareActivation.ts");
const businessRoutes = read("server/routes/businessRoutes.ts");
const pilotInvitations = read("server/services/organizationalPilotInvitationService.ts");
const studioRoutes = read("server/routes/studioRoutes.ts");
const careRoutes = read("server/routes/careTeamRoutes.ts");
const inviteService = read("server/services/procareInviteService.ts");
const autoAccept = read("server/services/inviteAutoAccept.ts");

const attributionColumns = [
  "organizationId",
  "locationId",
  "sourceBusinessId",
  "partnerRecordId",
] as const;

const sqlColumns = [
  "organization_id",
  "location_id",
  "source_business_id",
  "partner_record_id",
] as const;

function workspace(
  organizationId: string,
  locationId: string,
): WorkspaceOrganizationOption[] {
  return [{
    id: organizationId,
    name: organizationId,
    role: "admin",
    relationshipType: "internal_staff",
    locations: [{
      id: locationId,
      name: locationId,
      role: "admin",
      isDefault: true,
    }],
  }];
}

describe("BP1 organization attribution contract", () => {
  test("schema and additive migration have parity for every canonical snapshot column", () => {
    for (const column of attributionColumns) {
      expect(businessSchema).toContain(`${column}:`);
      expect(careSchema).toContain(`${column}:`);
      expect(procareSchema).toContain(`${column}:`);
      expect(studioSchema).toContain(`${column}:`);
    }
    for (const column of sqlColumns) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(migration).toContain("ALTER TABLE business_invitations");
    expect(migration).toContain("ALTER TABLE care_invite");
    expect(migration).toContain("ALTER TABLE studio_invites");
    expect(migration).toContain("ALTER TABLE studio_memberships");
    expect(migration).toContain("ALTER TABLE client_links");
    expect(migration).toContain("ALTER TABLE client_subscriptions");
    expect(migration).toContain("ALTER TABLE care_team_member");
  });

  test("the migration is registered in both development and production boot paths", () => {
    const developmentBoot = read("server/index.ts");
    const productionBoot = read("server/prod.ts");
    expect(developmentBoot).toContain("bp1-organization-attribution");
    expect(developmentBoot).toContain("runBp1OrganizationAttributionMigration");
    expect(productionBoot).toContain("runBp1OrganizationAttributionMigration");
  });

  test("active workspace resolution requires an explicit selection for Amber-like multi-org users", () => {
    const options = [
      ...workspace("amber-org-a", "amber-location-a"),
      ...workspace("amber-org-b", "amber-location-b"),
    ];

    expect(() => selectAuthorizedWorkspace(options)).toThrow(WorkspaceContextError);
    try {
      selectAuthorizedWorkspace(options);
    } catch (error) {
      expect(error).toMatchObject({ code: "WORKSPACE_SELECTION_REQUIRED", status: 409 });
    }

    expect(selectAuthorizedWorkspace(options, {
      organizationId: "amber-org-b",
      locationId: "amber-location-b",
    })).toMatchObject({
      organizationId: "amber-org-b",
      locationId: "amber-location-b",
      autoSelected: false,
    });
  });

  test("stale or mismatched workspace selections are rejected server-side", () => {
    const options = workspace("active-org", "active-location");
    expect(() => selectAuthorizedWorkspace(options, {
      organizationId: "revoked-org",
      locationId: "revoked-location",
    })).toThrow(WorkspaceContextError);
    expect(() => selectAuthorizedWorkspace(options, {
      organizationId: "active-org",
      locationId: "wrong-location",
    })).toThrow(WorkspaceContextError);
    expect(attribution).toContain("discoverAuthorizedWorkspaces(actorUserId)");
    expect(attribution).toContain("selectAuthorizedWorkspace(options, workspace)");
    expect(attribution).toContain("validateBp1Attribution");
    expect(businessRoutes).toContain("resolveBp1Attribution(userId");
  });

  test("provider Studio attribution uses active canonical membership or exact Studio binding, never users.organizationId", () => {
    expect(attribution).toContain("resolveProviderStudioAttribution");
    expect(attribution).toContain("if (studio.orgId)");
    expect(attribution).toContain("discoverAuthorizedWorkspaces(providerUserId)");
    expect(attribution).not.toContain("eq(users.organizationId");
    expect(studioRoutes).toContain("resolveProviderStudioAttribution(userId, studio, selectedWorkspace)");
    expect(careRoutes).toContain("resolveProviderStudioAttribution(userId, providerStudio, selectedWorkspace)");
    expect(studioRoutes).toContain("WorkspaceContextError");
    expect(careRoutes).toContain("WorkspaceContextError");
  });

  test("standard and bulk/pilot invitations stamp every row from server attribution", () => {
    expect(businessRoutes).toContain("attributionColumns(attribution)");
    expect(businessRoutes).toContain("partnerRecordId: _clientPartnerRecordId");
    expect(businessRoutes).toContain("The selected workspace does not match this Business account.");
    expect(pilotInvitations).toContain("resolveBp1Attribution(input.invitedByUserId");
    expect(pilotInvitations).toContain("...attributionColumns(attribution)");
    expect(pilotInvitations).not.toContain("input.partnerRecordId");
  });

  test("acceptance propagates immutable attribution to all relationship records", () => {
    for (const source of [activation, studioRoutes, careRoutes, inviteService, autoAccept]) {
      for (const column of attributionColumns) {
        expect(source).toContain(column);
      }
    }
    expect(studioRoutes).toContain("activateProCareClient(userId, studio.ownerUserId, \"studio_invite\", undefined");
    expect(inviteService).toContain("activateProCareClient(userId, r.proUserId, \"studio_token_invite\", undefined");
    expect(activation).toContain("studioMemberships");
    expect(activation).toContain("clientLinks");
    expect(studioSchema).toContain("clientSubscriptions");
    expect(careSchema).toContain("careTeamMember");
  });

  test("global relationship uniqueness cannot silently overwrite another organization", () => {
    expect(activation).toContain('throw new ActivationError("ATTRIBUTION_CONFLICT"');
    expect(activation).toContain("This client relationship cannot be overwritten across Organizations.");
    expect(studioRoutes).toContain('err.code === "ATTRIBUTION_CONFLICT"');
    expect(businessRoutes).toContain('code: "INVITATION_ATTRIBUTION_MISMATCH"');
  });

  test("partner records are looked up in the attributed Organization scope", () => {
    expect(attribution).toContain("ensureOrganizationPartnerRevenueShell");
    expect(attribution).toContain("eq(partnerRecords.organizationId, organizationId)");
    expect(attribution).toContain("partnerRecordId: partner ? String(partner.id) : null");
    expect(attribution).toContain("eq(partnerRecords.organizationId, attribution.organizationId)");
  });

  test("BP1 attribution does not introduce Rewardful or commission behavior", () => {
    for (const source of [migration, attribution, activation, pilotInvitations, inviteService]) {
      expect(source).not.toMatch(/Rewardful|RewardfulApi|rewardfulApi|commission/i);
    }
    expect(businessRoutes).not.toContain("getRewardful");
    expect(studioRoutes).not.toContain("Rewardful");
    expect(careRoutes).not.toContain("Rewardful");
  });
});