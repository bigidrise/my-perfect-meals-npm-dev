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

  it("retires the five-page completion endpoint and uses canonical certification as training authority", () => {
    const legacySource = read("routes/procareTrainingRoutes.ts");
    const certificationSource = read("routes/certificationRoutes.ts");
    expect(legacySource).toContain("PROCARE_LEGACY_TRAINING_RETIRED");
    expect(legacySource).not.toContain("ensureProviderStudioReady(userId");
    expect(legacySource).not.toContain('certificationType: "procare_training"');
    expect(certificationSource).toContain("certType === PROCARE_CERTIFICATION_TYPE");
    expect(certificationSource).toContain("procareTrainingCompleted: true");
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

  it("uses the authoritative Academy progression for every Phase 1 consumer", () => {
    const middleware = read("middleware/requirePhase1Cert.ts");
    const readiness = read("services/procareStudioReadiness.ts");
    const certificationRoutes = read("routes/certificationRoutes.ts");

    for (const source of [middleware, readiness, certificationRoutes]) {
      expect(source).toContain("getAcademyProgression");
      expect(source).toContain("progression.phase1.complete");
    }

    expect(middleware).not.toContain("userCertifications");
    expect(readiness).not.toContain("userCertifications");
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