import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

describe("Organization workspace Stage 2 contracts", () => {
  const schema = read("../db/schema/business.ts");
  const migration = read("../db/migrations/runOrganizationWorkspaceMigration.ts");
  const routes = read("../routes/businessRoutes.ts");
  const dashboard = read("../../client/src/pages/BusinessDashboard.tsx");
  const pilotInvitations = read("../services/organizationalPilotInvitationService.ts");

  test("legacy Business workforce and invitation rows receive explicit Location attribution", () => {
    expect(schema).toContain('locationId: uuid("location_id")');
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS location_id");
    expect(migration).toContain("SET location_id = l.id");
    expect(migration).toContain("l.source_business_id = bm.business_id");
    expect(migration).toContain("l.source_business_id = bi.business_id");
  });

  test("Dashboard authority comes from the exact active Organization and Location", () => {
    expect(routes).toContain("resolveActiveWorkspace(userId, sessionSelection)");
    expect(routes).toContain("eq(businesses.organizationId, context.organizationId)");
    expect(routes).toContain("resolveDashboardBusiness(req, \"admin_or_owner\")");
    expect(routes).toContain("organizationId: context.organizationId");
    expect(routes).toContain("locationId: context.locationId");
  });

  test("Team roster is canonical, Location-scoped, alphabetical, and exposes basic identity fields", () => {
    expect(routes).toContain(".from(locationMemberships)");
    expect(routes).toContain("eq(locationMemberships.locationId, locationId)");
    expect(routes).toContain("name: users.username");
    expect(routes).toContain("email: users.email");
    expect(routes).toContain("role: locationMemberships.role");
    expect(routes).toContain("status: locationMemberships.status");
    expect(routes).toContain("lower(coalesce(${users.username}, ${users.email}))");
  });

  test("team and client invitations are filtered and stamped by selected Location", () => {
    expect(routes).toContain("eq(businessInvitations.locationId, locationId)");
    expect(routes).toContain("locationId,");
    expect(pilotInvitations).toContain("locationId: input.locationId");
  });

  test("accepted clients come only from accepted Location-scoped client invitations", () => {
    expect(routes).toContain("eq(businessInvitations.invitationType, \"client\")");
    expect(routes).toContain("eq(businessInvitations.status, \"accepted\")");
    expect(routes).toContain("eq(businessInvitations.locationId, locationId)");
    expect(routes).toContain(".innerJoin(users, eq(users.id, businessInvitations.acceptedByUserId))");
  });

  test("team acceptance synchronizes Organization and Location membership", () => {
    expect(routes).toContain("tx.insert(organizationMemberships)");
    expect(routes).toContain("tx.insert(locationMemberships)");
    expect(routes).toContain("locationId: lockedInvite.locationId");
    expect(routes).toContain("INVITATION_WORKSPACE_MISSING");
  });

  test("Location removal revokes only the selected Location membership", () => {
    expect(routes).toContain(".update(locationMemberships)");
    expect(routes).toContain('set({ status: "revoked", updatedAt: new Date() })');
    expect(routes).toContain("eq(locationMemberships.locationId, locationId)");
  });

  test("Dashboard switches persisted workspaces and clears stale roster state", () => {
    expect(dashboard).toContain('fetch("/api/business/workspace/options"');
    expect(dashboard).toContain('fetch("/api/business/workspace/active"');
    expect(dashboard).toContain('fetch("/api/business/workspace/select"');
    expect(dashboard).toContain("setOwnerData(null)");
    expect(dashboard).toContain("setMemberData(null)");
    expect(dashboard).toContain("await fetchData()");
  });

  test("basic People UI includes email, role, status, pending invitations, and client search", () => {
    expect(dashboard).toContain("Team / People");
    expect(dashboard).toContain("{m.email || \"\"}");
    expect(dashboard).toContain("Invitation Pending");
    expect(dashboard).toContain("Search clients");
    const roster = dashboard.slice(
      dashboard.indexOf("Team / People"),
      dashboard.indexOf("{/* Client Invitations */}"),
    );
    expect(roster).not.toContain("certification");
    expect(roster).not.toContain("phone");
    expect(roster).not.toContain("address");
  });

  test("complimentary access durations and one-time professional introduction remain unchanged", () => {
    expect(routes).toContain("CLIENT_TRIAL_DURATIONS = [7, 14, 30]");
    expect(routes).toContain("interval '30 days'");
    expect(routes).toContain("priorGrant");
  });
});