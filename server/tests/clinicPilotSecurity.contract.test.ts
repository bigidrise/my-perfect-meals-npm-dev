import fs from "fs";
import path from "path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Clinic pilot security integration contracts", () => {
  const route = read("server/routes/clinicPilotRoutes.ts");
  const dev = read("server/index.ts");
  const prod = read("server/prod.ts");
  const signup = read("server/routes/auth.session.ts");

  it("keeps raw tokens out of server URL paths and management responses", () => {
    expect(route).not.toMatch(/\/inspect\/:token/);
    expect(route).not.toMatch(/router\.(get|post)\([^)]*:token/);
    expect(route).toContain('req.get("x-clinic-enrollment-token")');
    expect(route).toContain('req.body?.token');
    expect(route).not.toMatch(/tokenHash:\s*clinicPilotEnrollmentLinks\.tokenHash/);
    expect(route).toContain("joinPath: `/join/clinic#token=${created.rawToken}`");
    expect(read("client/src/pages/ClinicPilotJoinPage.tsx")).not.toContain("/join/clinic/:token");
    expect(read("client/src/pages/Auth.tsx")).not.toContain("clinicPilotToken=${");
  });

  it("keeps the public clinic join page outside authenticated navigation shells", () => {
    expect(read("client/src/components/AppRouter.tsx")).toContain(
      'if (location.startsWith("/join/clinic"))',
    );
    expect(read("client/src/components/Router.tsx")).toContain(
      '!location.startsWith("/join/clinic")',
    );
  });

  it("uses established CSRF and write-rate-limit middleware before clinic routes", () => {
    expect(dev.indexOf("registerCsrfProtection(app)")).toBeLessThan(
      dev.indexOf('app.use("/api/clinic-pilot"'),
    );
    expect(dev.indexOf('app.use("/api", apiRateLimit)')).toBeLessThan(
      dev.indexOf('app.use("/api/clinic-pilot"'),
    );
    expect(prod.indexOf("registerCsrfProtection(app)")).toBeLessThan(
      prod.indexOf('app.use("/api/clinic-pilot"'),
    );
    expect(prod.indexOf('app.use("/api", apiRateLimit)')).toBeLessThan(
      prod.indexOf('app.use("/api/clinic-pilot"'),
    );
  });

  it("requires authentication and MFA for every management mutation/read", () => {
    expect(route).toContain('router.post("/links/:pilotId", requireAuth, requireMfa');
    expect(route).toContain('router.get("/links", requireAuth, requireMfa');
    expect(route).toContain('router.post("/links/:linkId/revoke", requireAuth, requireMfa');
    expect(route).toContain('router.post("/enroll", requireAuth');
  });

  it("binds list/create/revoke authority to the requested link business", () => {
    expect(route).toContain("isBusinessAdmin(actor(req), businessId)");
    expect(route).toContain("isBusinessAdmin(actor(req), link.businessId)");
    expect(route).toContain('eq(businessMembers.role, "admin")');
    expect(route).toContain('eq(businessMembers.status, "active")');
  });

  it("enrolls during signup through the same database transaction", () => {
    expect(signup).toContain("db.transaction(async (tx)");
    expect(signup).toContain("enrollClinicPatientInTransaction(tx");
  });
});