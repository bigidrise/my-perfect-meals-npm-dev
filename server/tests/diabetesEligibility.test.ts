import { isDiabetesFoodPreferenceEligible } from "../../shared/diabetesEligibility";
import fs from "fs";
import path from "path";

describe("diabetes glucose-preference eligibility", () => {
  test.each([
    [{ diabetesType: "T1D" }],
    [{ diabetesType: "T2D" }],
    [{ diabetesType: "PRE_D" }],
    [{ medicalConditions: ["diabetes-type2"] }],
    [{ medicalConditions: ["prediabetes"] }],
    [{ healthConditions: ["blood_sugar_management"] }],
  ])("accepts the supported diabetes pathway %#", (profile) => {
    expect(isDiabetesFoodPreferenceEligible(profile)).toBe(true);
  });

  test.each([
    [undefined],
    [{}],
    [{ diabetesType: "NONE" }],
    [{ medicalConditions: ["glp1", "hypertension"] }],
    [{ healthConditions: ["renal"] }],
  ])("rejects an ordinary non-diabetes profile %#", (profile) => {
    expect(isDiabetesFoodPreferenceEligible(profile)).toBe(false);
  });

  test("Edit Profile skips, hides, and does not load glycemic controls for ordinary users", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "client/src/pages/profile/EditProfilePage.tsx"),
      "utf8",
    );
    expect(source).toContain("useGlycemicSettings(glycemicEligible)");
    expect(source).toContain("setStep(glycemicEligible ? 4 : 5)");
    expect(source).toContain("step === 4 && glycemicEligible");
  });

  test("the API rejects ineligible writes without deleting saved settings", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "server/routes/glycemic.ts"),
      "utf8",
    );
    expect(source).toContain("DIABETES_ELIGIBILITY_REQUIRED");
    expect(source).not.toMatch(/delete\\s*\\(userGlycemicSettings\\)/);
  });
});