import { ONCOLOGY_SYMPTOM_OPTIONS } from "../../shared/oncologySupportSelection";
import { buildOncologySupportPrompt } from "../services/guardrails/prompt/oncologySupportPromptBuilder";
import { buildUniversalConditionGuidance } from "../services/universalMedicalGuidance";
import { validateOncologyMealSafety } from "../services/guardrails/validators/oncologySupportValidator";
import { scoreOncologyMealQuality } from "../services/guardrails/validators/oncologyQualityScorer";
import { applyOncologySymptomPriority } from "../services/guardrails/prompt/oncologySymptomPriority";

jest.mock("../db", () => ({ pool: { query: jest.fn(async () => ({ rows: [] })) } }));

const originalEnv = process.env.NODE_ENV;
const originalDeployment = process.env.REPLIT_DEPLOYMENT;
const originalProduction = process.env.VITE_IS_PRODUCTION_PROJECT;
const context = (symptoms: any[] = []) => ({
  enabled: true, symptoms, emphasis: { highProteinNutrientDensity: true },
  source: "physician" as const, updatedBy: "test-clinician", updatedAt: null,
});
beforeEach(() => {
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  delete process.env.VITE_IS_PRODUCTION_PROJECT;
});
afterAll(() => {
  process.env.NODE_ENV = originalEnv;
  if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT; else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  if (originalProduction === undefined) delete process.env.VITE_IS_PRODUCTION_PROJECT; else process.env.VITE_IS_PRODUCTION_PROJECT = originalProduction;
});

describe("Development oncology tolerance precedence", () => {
  it("leaves the no-symptom protocol unchanged and respects disabling", () => {
    const prompt = buildOncologySupportPrompt(context());
    expect(prompt).toContain("MANDATORY FIBER ANCHOR");
    expect(prompt).toContain("lemon/lemon zest");
    expect(prompt).not.toContain("ONCOLOGY TOLERANCE PRIORITY");
    expect(buildOncologySupportPrompt({ ...context(), enabled: false })).toBe("");
  });
  it.each(ONCOLOGY_SYMPTOM_OPTIONS)("activates existing guidance for $value", async ({ value }) => {
    const prompt = buildOncologySupportPrompt(context([value]));
    const blocks = await buildUniversalConditionGuidance({
      userId: "test-patient", healthConditions: [], oncologySupportContext: context([value]),
    });
    const expected = {
      low_appetite: "smaller", nausea: "strongly aromatic",
      mouth_sensitivity: "acidic", fatigue_low_prep: "15 minutes", gi_sensitivity: "low-residue",
    }[value];
    expect(prompt).toContain(expected);
    expect(blocks.join("\n").toLowerCase()).toContain(value === "gi_sensitivity" ? "softened" : expected);
    expect(prompt).toContain("ONCOLOGY TOLERANCE PRIORITY");
  });
  it("preserves simultaneous symptom guidance and hard restrictions", () => {
    const prompt = buildOncologySupportPrompt(context(ONCOLOGY_SYMPTOM_OPTIONS.map(o => o.value)));
    for (const label of ["Low Appetite", "Nausea", "Mouth Sensitivity", "Fatigue Low Prep", "Gi Sensitivity"]) expect(prompt).toContain(`[${label}]`);
    expect(prompt).toContain("Allergies, intolerances, dietary identity, clinician-directed eliminations");
    expect(prompt).toContain("STRICTLY FORBIDDEN");
    expect(prompt).toContain("Do not recommend supplements or medications");
  });
  it("removes forced fiber and incompatible booster suggestions", async () => {
    const symptoms = ["gi_sensitivity", "mouth_sensitivity"] as const;
    const prompt = buildOncologySupportPrompt(context([...symptoms]));
    expect(prompt).not.toContain("=== MANDATORY FIBER ANCHOR ===");
    expect(prompt).not.toContain("lemon/lemon zest");
    expect(prompt).not.toContain("✅ FIBER ANCHOR");
    const blocks = await buildUniversalConditionGuidance({ userId: "test-patient", healthConditions: [], oncologySupportContext: context([...symptoms]) });
    expect(blocks.join("\n")).not.toContain("FIBER ANCHOR: Every meal");
    expect(prompt).toContain("no mandatory fiber anchor");
    expect(applyOncologySymptomPriority("BOOSTERS: garlic clove + turmeric + lemon juice", symptoms)).not.toContain("lemon juice");
  });
  it("does not force fiber or extra fat back through the quality scorer", () => {
    const meal = { name: "Soft cod rice bowl", ingredients: ["cod", "white rice", "cooked carrot"] };
    expect(scoreOncologyMealQuality(meal).approvedForDisplay).toBe(false);
    const result = scoreOncologyMealQuality(meal, ["gi_sensitivity"]);
    expect(result.approvedForDisplay).toBe(true);
    expect(result.missingRequirements).not.toContain("real fiber anchor (quinoa/oats/lentils/sweet potato — not just greens)");
    expect(result.breakdown.caps).not.toContain("no-fiber-anchor");
  });
  it("retains prohibited ingredients and cure protections with symptom flags", () => {
    for (const ingredient of ["bacon", "honey", "hydrogenated oil"]) {
      expect(validateOncologyMealSafety({ name: "Test meal", ingredients: [ingredient] }, ["gi_sensitivity"]).isValid).toBe(false);
    }
    expect(validateOncologyMealSafety({ name: "Test meal", description: "This cures cancer", ingredients: ["eggs"] }, ["mouth_sensitivity"]).isValid).toBe(false);
    expect(validateOncologyMealSafety({ name: "Soft eggs", ingredients: ["eggs", "lemon juice"] }, ["mouth_sensitivity"]).isValid).toBe(false);
    expect(validateOncologyMealSafety({ name: "Soft eggs", ingredients: ["eggs"] }, ["mouth_sensitivity"]).isValid).toBe(true);
    expect(validateOncologyMealSafety({ name: "Fish with lemon", ingredients: ["fish", "lemon juice"] }).isValid).toBe(true);
  });
  it.each(["production", "test"])("does not change %s runtime rules", env => {
    process.env.NODE_ENV = env;
    const prompt = buildOncologySupportPrompt(context(["gi_sensitivity"]));
    expect(prompt).toContain("MANDATORY FIBER ANCHOR");
    expect(prompt).not.toContain("ONCOLOGY TOLERANCE PRIORITY");
    expect(validateOncologyMealSafety({ name: "Eggs", ingredients: ["eggs", "lemon"] }, ["mouth_sensitivity"]).isValid).toBe(true);
  });
  it("is also disabled in deployments and the Production workspace", () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    expect(buildOncologySupportPrompt(context(["gi_sensitivity"]))).not.toContain("ONCOLOGY TOLERANCE PRIORITY");
    delete process.env.REPLIT_DEPLOYMENT;
    process.env.VITE_IS_PRODUCTION_PROJECT = "true";
    expect(buildOncologySupportPrompt(context(["gi_sensitivity"]))).not.toContain("ONCOLOGY TOLERANCE PRIORITY");
  });
});
