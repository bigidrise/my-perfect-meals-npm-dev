jest.mock("../db", () => ({
  db: new Proxy({}, { get() { throw new Error("Database access forbidden in Pregnancy pause tests"); } }),
}));

import {
  PREGNANCY_CUSTOMER_AVAILABLE,
  assertPregnancyRecommendationsAvailable,
  pregnancyRecommendationsPaused,
  retainPregnancySupport,
} from "@shared/pregnancyAvailability";
import { resolveConsumerSpecialtyConditions } from "../services/consumerOncologySupport";
import { buildPregnancySupportPrompt } from "../services/guardrails/prompt/pregnancySupportPromptBuilder";
import { scanClinicalFoodSafety } from "../services/healthProtocols/clinicalOutputChecks";
import { derivePregnancyStage } from "@shared/pregnancyStage";
import fs from "node:fs";

describe("temporary Pregnancy customer safety pause", () => {
  it("has one disabled availability control without changing Clinical entitlements", () => {
    expect(PREGNANCY_CUSTOMER_AVAILABLE).toBe(false);
    const source = fs.readFileSync("shared/planFeatures.ts", "utf8");
    expect(source).toContain('"pregnancy",');
    expect(source).toContain("Coming Soon (Clinical)");
  });

  it("rejects new activation but leaves other health selections alone", () => {
    expect(() => resolveConsumerSpecialtyConditions(["pregnancy-support"], [])).toThrow("Coming Soon");
    expect(resolveConsumerSpecialtyConditions(["renal", "thyroid-support"], []))
      .toEqual(["renal", "thyroid-support"]);
  });

  it("retains existing Pregnancy across unrelated edits and Clear All", () => {
    expect(retainPregnancySupport([], ["pregnancy-support"])).toEqual(["pregnancy-support"]);
    expect(resolveConsumerSpecialtyConditions(["renal"], ["pregnancy-support", "cardiac"]))
      .toEqual(["renal", "pregnancy-support"]);
  });

  it.each(["trimester-1", "trimester-2", "trimester-3", "breastfeeding", "postpartum"])(
    "does not rewrite saved %s stage or context", stage => {
      const context = Object.freeze({ stage, active: true, symptoms: Object.freeze(["fatigue"]), isBreastfeeding: false });
      const before = JSON.stringify(context);
      pregnancyRecommendationsPaused(context);
      expect(derivePregnancyStage(stage, "2020-01-01", "manual").resolvedStage).toBe(stage);
      expect(JSON.stringify(context)).toBe(before);
    },
  );

  it.each(["breastfeeding", "postpartum"])("removes unreviewed %s prompt protocols", stage => {
    const prompt = buildPregnancySupportPrompt({ active: true, stage, symptoms: [], isBreastfeeding: false } as any);
    expect(prompt).toContain("Coming Soon");
    expect(prompt).toContain("Do not recommend breastfeeding/postpartum-specific");
    expect(prompt).not.toMatch(/500|DHA.*(?:mg|mcg)|BODY RECOMPOSITION/);
    const violations = scanClinicalFoodSafety(
      { name: "Rice", ingredients: ["rice"], instructions: [] },
      { pregnancySupportContext: { active: true, stage } } as any,
    );
    expect(violations).toEqual(expect.arrayContaining([expect.objectContaining({ category: "pregnancy" })]));
  });

  it("also pauses lactation combined with another stage without changing non-Pregnancy behavior", () => {
    expect(pregnancyRecommendationsPaused({ active: true, stage: "trimester-2", isBreastfeeding: true })).toBe(true);
    expect(pregnancyRecommendationsPaused({ active: true, stage: "trimester-2" })).toBe(false);
    expect(pregnancyRecommendationsPaused({ active: false, stage: "breastfeeding" })).toBe(false);
    expect(() => assertPregnancyRecommendationsAvailable({ active: true, stage: "breastfeeding" }))
      .toThrow("Coming Soon");
    expect(() => assertPregnancyRecommendationsAvailable({ active: true, stage: "trimester-2" })).not.toThrow();
    expect(() => assertPregnancyRecommendationsAvailable(null)).not.toThrow();
    const food = { name: "Rice", ingredients: ["rice"] };
    const normal = scanClinicalFoodSafety(food, {} as any);
    const paused = scanClinicalFoodSafety(food, {
      pregnancySupportContext: { active: true, stage: "postpartum" },
      alphaGalContext: { active: true },
    } as any);
    expect(normal).toEqual([]);
    expect(paused.some(v => v.category === "pregnancy")).toBe(true);
  });

  it("keeps Alpha-gal checks active beside the pause", () => {
    const violations = scanClinicalFoodSafety(
      { name: "Beef", ingredients: ["beef"] },
      {
        pregnancySupportContext: { active: true, stage: "breastfeeding" },
        alphaGalContext: { active: true },
      } as any,
    );
    expect(violations.some(v => v.category === "pregnancy")).toBe(true);
    expect(violations.some(v => v.category === "alpha-gal")).toBe(true);
  });
});
