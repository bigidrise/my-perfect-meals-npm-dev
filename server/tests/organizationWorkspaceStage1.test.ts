import fs from "fs";
import path from "path";
import {
  selectAuthorizedWorkspace,
  WorkspaceContextError,
  type WorkspaceOrganizationOption,
} from "../services/organizationWorkspaceService";

const organizationA: WorkspaceOrganizationOption = {
  id: "org-a",
  name: "Organization A",
  role: "owner",
  locations: [
    { id: "location-a", name: "Main Location", role: "owner", isDefault: true },
  ],
};
const organizationB: WorkspaceOrganizationOption = {
  id: "org-b",
  name: "Organization B",
  role: "admin",
  locations: [
    { id: "location-b", name: "North Clinic", role: "admin", isDefault: false },
  ],
};

describe("Organization workspace Stage 1 context", () => {
  test("A/D: an authorized user resolves an Organization Main Location", () => {
    const result = selectAuthorizedWorkspace(
      [organizationA],
      { organizationId: "org-a", locationId: "location-a" },
    );
    expect(result.organizationId).toBe("org-a");
    expect(result.locationId).toBe("location-a");
    expect(result.autoSelected).toBe(false);
  });

  test("B: one Organization can expose multiple authorized Locations", () => {
    const multiLocation = {
      ...organizationA,
      locations: [
        ...organizationA.locations,
        { id: "location-a2", name: "South Clinic", role: "admin", isDefault: false },
      ],
    };
    expect(() => selectAuthorizedWorkspace(
      [multiLocation],
      { organizationId: "org-a", locationId: "location-a2" },
    )).not.toThrow();
  });

  test("E: an unauthorized Location is rejected", () => {
    expect(() => selectAuthorizedWorkspace(
      [organizationA],
      { organizationId: "org-a", locationId: "location-b" },
    )).toThrow(expect.objectContaining({
      code: "INVALID_WORKSPACE_SELECTION",
      status: 403,
    }));
  });

  test("F: a Location cannot be paired with another Organization", () => {
    expect(() => selectAuthorizedWorkspace(
      [organizationA, organizationB],
      { organizationId: "org-b", locationId: "location-a" },
    )).toThrow(WorkspaceContextError);
  });

  test("G: exactly one authorized Location is selected deterministically", () => {
    const result = selectAuthorizedWorkspace([organizationA]);
    expect(result.locationId).toBe("location-a");
    expect(result.autoSelected).toBe(true);
  });

  test("H: multiple authorized Locations require an explicit selection", () => {
    expect(() => selectAuthorizedWorkspace([organizationA, organizationB]))
      .toThrow(expect.objectContaining({
        code: "WORKSPACE_SELECTION_REQUIRED",
        status: 409,
      }));
  });

  test("J: revoked or inactive access is absent and fails closed", () => {
    expect(() => selectAuthorizedWorkspace([]))
      .toThrow(expect.objectContaining({
        code: "NO_AUTHORIZED_WORKSPACE",
        status: 404,
      }));
  });
});

describe("Organization workspace Stage 1 schema and route contracts", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../db/migrations/runOrganizationWorkspaceMigration.ts"),
    "utf8",
  );
  const service = fs.readFileSync(
    path.resolve(__dirname, "../services/organizationWorkspaceService.ts"),
    "utf8",
  );
  const routes = fs.readFileSync(
    path.resolve(__dirname, "../routes/organizationWorkspaceRoutes.ts"),
    "utf8",
  );
  const businessRoutes = fs.readFileSync(
    path.resolve(__dirname, "../routes/businessRoutes.ts"),
    "utf8",
  );
  const checkout = fs.readFileSync(
    path.resolve(__dirname, "../routes/stripeCheckout.ts"),
    "utf8",
  );

  test("A/B/C: Location schema supports one or many Locations with one parent each", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS organization_locations");
    expect(migration).toContain(
      "organization_id uuid NOT NULL REFERENCES organizations(id)",
    );
    expect(migration).toContain("organization_locations_one_default_uniq");
  });

  test("I: validated selection is persisted in both durable and session context", () => {
    expect(service).toContain("userWorkspaceSelections");
    expect(routes).toContain("req.session.activeOrganizationId");
    expect(routes).toContain("req.session.activeLocationId");
    expect(routes).toContain("persistWorkspaceSelection");
  });

  test("K: discovery requires active Organization and Location authorization", () => {
    expect(service).toContain("organizationMemberships.status, \"active\"");
    expect(service).toContain("locationMemberships.status, \"active\"");
    expect(service).toContain("organizationLocations.status, \"active\"");
    expect(service).toContain("organizations.activeStatus, \"active\"");
  });

  test("single-location compatibility provisions Main Location for legacy businesses", () => {
    expect(migration).toContain("'Main Location'");
    expect(migration).toContain("source_business_id");
    expect(migration).toContain("JOIN users u ON u.id = bm.user_id");
    expect(businessRoutes).toContain("ensureCanonicalWorkspaceForBusiness");
  });

  test("Stage 1 leaves Stripe and invitation mechanics unchanged", () => {
    expect(checkout).toContain('getTrustedCheckoutPlan("clinical_business_monthly")');
    expect(checkout).toContain("const requestedSeats = 1");
    expect(businessRoutes).toContain("CLIENT_TRIAL_DURATIONS");
    expect(businessRoutes).toContain("interval '30 days'");
  });

  test("Stage 1 does not remove the deferred legacy membership restriction", () => {
    expect(businessRoutes).toContain("ALREADY_IN_ANOTHER_BUSINESS");
  });
});