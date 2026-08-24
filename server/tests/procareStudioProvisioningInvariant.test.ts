import * as fs from "fs";
import * as path from "path";
import { isStudioProviderRole } from "../services/procareStudioReadiness";

const root = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("ProCare Studio provisioning invariant", () => {
  it.each([
    ["trainer", true],
    ["physician", true],
    ["dietitian", true],
    ["nurse_practitioner", true],
    ["business", false],
    [null, false],
  ])("classifies Studio-capable role %p safely", (role, expected) => {
    expect(isStudioProviderRole(role)).toBe(expected);
  });

  it("provisions a Studio at the final training milestone after MFA", () => {
    const source = read("routes/procareTrainingRoutes.ts");
    expect(source).toMatch(/router\.post\("\/complete",\s*requireAuth,\s*requireMfa,/);
    expect(source).toContain("getProviderStudioReadiness(userId");
    expect(source).toContain("ensureProviderStudioReady(userId");
  });

  it("prepares a provider Studio before persisting a provider invitation", () => {
    const source = read("routes/careTeamRoutes.ts");
    const provisionIndex = source.indexOf("ensureProviderStudioReady(userId)");
    const inviteInsertIndex = source.indexOf(".insert(careInvite)");

    expect(source).toMatch(/router\.post\("\/invite",\s*requireAuth,\s*requireEmailService,\s*requireMfa,/);
    expect(provisionIndex).toBeGreaterThan(-1);
    expect(inviteInsertIndex).toBeGreaterThan(provisionIndex);
    expect(source).toContain("setupRequired: true");
  });

  it("applies the same readiness rule to every provider-created Studio invitation", () => {
    const studioRoutes = read("routes/studioRoutes.ts");
    const manualCreate = studioRoutes.indexOf('router.post("/", async');
    const manualReadiness = studioRoutes.indexOf("getProviderStudioReadiness(userId)", manualCreate);
    const inviteRoute = studioRoutes.indexOf('router.post("/:studioId/invite", async');
    const inviteReadiness = studioRoutes.indexOf("getProviderStudioReadiness(userId)", inviteRoute);

    expect(manualReadiness).toBeGreaterThan(manualCreate);
    expect(inviteReadiness).toBeGreaterThan(inviteRoute);
  });

  it("keeps provisioning and legacy acceptance idempotent, then repairs legacy providers in both runtimes", () => {
    const bridge = read("services/studioBridge.ts");
    const readiness = read("services/procareStudioReadiness.ts");
    const activation = read("services/procareActivation.ts");
    const development = read("index.ts");
    const production = read("prod.ts");

    expect(bridge).toContain(".onConflictDoNothing()");
    expect(bridge).toContain("Ensure historical Studios recover their required internal billing row");
    expect(activation).toContain("ensureStudioForTrainer(proUserId)");
    expect(readiness).toContain('eq(users.role, "coach")');
    expect(readiness).toContain("unclearProviderRole");
    expect(development).toContain('backfillEligibleProviderStudios("development_boot")');
    expect(production).toContain('backfillEligibleProviderStudios("production_boot")');
  });
});