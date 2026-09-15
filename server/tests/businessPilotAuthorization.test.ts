import fs from "fs";
import path from "path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const schema = read("server/db/schema/businessPilotAuthorization.ts");
const service = read("server/services/businessPilotAuthorizationService.ts");
const migration = read("server/db/migrations/runBusinessPilotAuthorizationMigration.ts");
const devBoot = read("server/index.ts");
const prodBoot = read("server/prod.ts");
const auth = read("server/routes/auth.session.ts");
const businessRoutes = read("server/routes/businessRoutes.ts");
const effectiveAccess = read("server/services/effectiveAccess.ts");
const accessTier = read("server/lib/accessTier.ts");
const requireAuth = read("server/middleware/requireAuth.ts");
const drizzleConfig = read("drizzle.config.ts");

describe("BP1 Business Pilot authorization server core", () => {
  test("canonical schema has bounded lifecycle, provenance, claim, and lifecycle fields", () => {
    expect(schema).toContain('"business_pilot_authorizations"');
    for (const field of [
      "id: uuid",
      "authorizedEmail",
      "normalizedAuthorizedEmail",
      "createdByUserId",
      "startsAt",
      "expiresAt",
      "durationPolicy",
      "durationDays",
      "accessProvenance",
      "claimedUserId",
      "claimedAt",
      "organizationId",
      "notes",
      "internalMetadata",
      "revokedAt",
      "endedAt",
      "convertedAt",
    ]) expect(schema).toContain(field);
    expect(schema).toContain("'pending', 'active', 'expired', 'revoked', 'converted'");
    expect(schema).toContain("openEmailUnique");
    expect(schema).toContain("business_pilot");
  });

  test("migration parity uses the same canonical table, lifecycle, provenance, and open-email uniqueness", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS business_pilot_authorizations");
    expect(migration).toContain("status IN ('pending', 'active', 'expired', 'revoked', 'converted')");
    expect(migration).toContain("access_provenance = 'business_pilot'");
    expect(migration).toContain("duration_days integer");
    expect(migration).toContain("business_pilot_authorizations_open_email_unique");
    expect(devBoot).toContain("runBusinessPilotAuthorizationMigration");
    expect(prodBoot).toContain("runBusinessPilotAuthorizationMigration");
    expect(prodBoot).toContain('migrationName: "production-readiness-schema"');
  });

  test("claim normalizes and serializes by email, then binds only the immutable user claim", () => {
    expect(service).toContain("normalizedEmail(input.email)");
    expect(service).toContain("pg_advisory_xact_lock");
    expect(service).toContain("claimedUserId: input.userId");
    expect(service).toContain("claimedAt: new Date()");
    expect(service).not.toMatch(/insert\\(businesses\\)|insert\\(businessMembers\\)|insert\\(organizationalPilots\\)/);
    expect(service).not.toMatch(/planLookupKey|professionalRole|studio/i);
  });

  test("claim rejects wrong email, double claim, expired, and revoked authorizations", () => {
    expect(service).toContain("AUTHORIZATION_EMAIL_MISMATCH");
    expect(service).toContain("AUTHORIZATION_ALREADY_CLAIMED");
    expect(service).toContain("AUTHORIZATION_EXPIRED");
    expect(service).toContain("AUTHORIZATION_REVOKED");
  });

  test("create defaults to a 30-day fixed authorization when route supplies no duration", () => {
    expect(service).toContain("storedDurationDays");
    expect(service).toContain("durationPolicy ?? \"fixed\"");
    expect(service).toContain("An authorization is not a commercial clock");
    expect(service).toContain("startsAt && durationPolicy !== \"indefinite\"");
    expect(businessRoutes).toContain("createBusinessPilotAuthorization");
  });

  test("organization validation is separate from organization membership", () => {
    expect(service).toContain("organizations.id");
    expect(service).toContain("ORGANIZATION_NOT_FOUND");
    expect(service).not.toContain("insert(organizationMemberships)");
    expect(service).not.toContain("insert(businessMembers)");
  });

  test("BP authorization is not user-level access and cannot elevate general access or ProCare", () => {
    expect(accessTier).not.toContain("businessPilotAccess");
    expect(effectiveAccess).not.toContain("businessPilot");
    expect(effectiveAccess).not.toContain("accessProvenance");
    expect(requireAuth).not.toContain("businessPilot");
    expect(auth).not.toContain("businessPilotAccess");
    expect(auth).not.toContain("businessPilotAuthorizationId");
  });

  test("signup claims after insert and suppresses only the personal trial", () => {
    const insertPosition = auth.indexOf("tx.insert(users)");
    const claimPosition = auth.indexOf("await claimBusinessPilotAuthorizationInTransaction");
    expect(insertPosition).toBeGreaterThanOrEqual(0);
    expect(claimPosition).toBeGreaterThan(insertPosition);
    expect(auth).toContain("&& !businessPilotAuthorization");
    expect(auth).not.toMatch(/claimBusinessPilotAuthorizationInTransaction[\\s\\S]{0,500}(insert\\(organizations\\)|insert\\(businessMembers\\)|planLookupKey)/);
  });

  test("organization association requires an active canonical owner/admin membership and never creates it", () => {
    expect(service).toContain("attachClaimedBusinessPilotAuthorizationToOrganization");
    expect(service).toContain("CANONICAL_ADMIN_MEMBERSHIP_REQUIRED");
    expect(service).toContain('inArray(organizationMemberships.role, ["owner", "admin"])');
    expect(service).toContain('eq(organizationMemberships.status, "active")');
    expect(service).toContain("organizationMemberships.organizationId");
    expect(service).not.toContain("users.organizationId");
    expect(service).not.toContain("insert(organizationMemberships)");
    expect(businessRoutes).toContain("ensureCanonicalWorkspaceForBusiness");
    expect(businessRoutes).toContain("associateClaimedBusinessPilotAfterWorkspace");
    expect(service).toContain("activateBusinessPilotOrganizationWindow");
    expect(service).toContain("commercialAccessMode");
    expect(service).toContain("eq(businesses.organizationId, input.organizationId)");
    expect(service).toContain("commercialAccessEndsAt: new Date()");
  });

  test("activation starts the organization clock, additive extension preserves it, and indefinite/revoke reconcile it", () => {
    expect(service).toContain("authorization.startsAt ?? new Date()");
    expect(service).toContain("authorization.durationDays ?? 30");
    expect(service).toContain("const baseEnd = linkedBusiness.commercialAccessEndsAt ?? new Date()");
    expect(service).toContain("baseEnd > now ? baseEnd : now");
    expect(service).toContain("policy === \"indefinite\" ? \"authorized_arrangement\" : \"onboarding_pilot\"");
    expect(service).toContain("current.organizationId");
    expect(service).toContain("commercialAccessEndsAt: policy === \"indefinite\" ? null : nextExpiresAt");
  });

  test("canonical mutations require authenticated admin middleware and preserve legacy routes", () => {
    expect(businessRoutes).toMatch(/post\("\/business-pilot-authorizations", requireAuth, requireAdmin/);
    expect(businessRoutes).toMatch(/get\("\/business-pilot-authorizations", requireAuth, requireAdmin/);
    expect(businessRoutes).toMatch(/business-pilot-authorizations\/:authorizationId\/extend", requireAuth, requireAdmin/);
    expect(businessRoutes).toMatch(/business-pilot-authorizations\/:authorizationId\/revoke", requireAuth, requireAdmin/);
    expect(businessRoutes).toContain('router.post("/pilot-authorizations"');
  });

  test("schema participates in Drizzle discovery and database schema registration", () => {
    expect(drizzleConfig).toContain("./server/db/schema/businessPilotAuthorization.ts");
    expect(read("server/db.ts")).toContain("businessPilotAuthorizations");
  });
});