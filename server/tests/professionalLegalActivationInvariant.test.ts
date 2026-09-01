import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");

describe("professional legal activation invariant", () => {
  test("new-account signup cannot directly activate ProCare", () => {
    const source = fs.readFileSync(
      path.join(root, "server/routes/auth.session.ts"),
      "utf8",
    );
    const signupStart = source.indexOf('router.post("/api/auth/signup"');
    const upgradeStart = source.indexOf('router.post("/api/auth/upgrade-to-procare"');
    const signupSource = source.slice(signupStart, upgradeStart);

    expect(signupStart).toBeGreaterThanOrEqual(0);
    expect(upgradeStart).toBeGreaterThan(signupStart);
    expect(signupSource).toContain("professionalSetupRequired: professionalSetupRequested");
    expect(signupSource).not.toContain("userValues.isProCare = true");
    expect(signupSource).not.toContain('userValues.planLookupKey = "mpm_procare_monthly"');
  });

  test("authenticated profile assertions cannot activate paid ProCare", () => {
    const source = fs.readFileSync(
      path.join(root, "server/routes/auth.session.ts"),
      "utf8",
    );
    const upgradeStart = source.indexOf('router.post("/api/auth/upgrade-to-procare"');
    const upgradeSource = source.slice(upgradeStart);

    expect(upgradeSource).toContain('code: "PROCARE_SELF_UPGRADE_RETIRED"');
    expect(upgradeSource).toContain("verified billing");
    expect(upgradeSource).not.toContain("isProCare: true");
    expect(upgradeSource).not.toContain('planLookupKey: "mpm_procare_monthly"');
  });

  test("legal status supports both professional role-specific flows", () => {
    const source = fs.readFileSync(
      path.join(root, "server/routes/legalRoutes.ts"),
      "utf8",
    );

    expect(source).toContain('"professional", "physician", "patient_physician", "attestation"');
  });

  test("Studio readiness enforces attestation and role-specific agreements", () => {
    const source = fs.readFileSync(
      path.join(root, "server/services/procareStudioReadiness.ts"),
      "utf8",
    );

    expect(source).toContain('checkLegalAcceptance(providerUserId, "attestation")');
    expect(source).toContain("checkLegalAcceptance(providerUserId, legalFlow)");
    expect(source).toContain("const missing = [...attestation.missing, ...legal.missing]");
    expect(source).toContain("missing,");
  });

  test("every provider-originated action propagates the legal recovery flow", () => {
    const studioRoutes = fs.readFileSync(
      path.join(root, "server/routes/studioRoutes.ts"),
      "utf8",
    );
    const careTeamRoutes = fs.readFileSync(
      path.join(root, "server/routes/careTeamRoutes.ts"),
      "utf8",
    );

    expect(studioRoutes.match(/flow: readiness\.flow/g)?.length).toBeGreaterThanOrEqual(2);
    expect(careTeamRoutes).toContain("flow: provisioned.flow");
    expect(careTeamRoutes).toContain("missing: provisioned.missing");
  });
});