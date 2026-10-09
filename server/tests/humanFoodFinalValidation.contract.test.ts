import { HUMAN_FOOD_CONTEXT_VERSION, type HumanFoodContext } from "../../shared/humanFoodContext";
import type { HumanFoodCandidate } from "../../shared/humanFoodValidation";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import { validateHumanFoodResult } from "../services/humanFoodContext/validateHumanFoodResult";
import { buildHumanFoodPromptBlock } from "../services/humanFoodContext/buildHumanFoodPromptBlock";
import { validateClinicalMacros } from "../services/clinicalMacroGate";
import { buildHumanFoodPromptBlock } from "../services/humanFoodContext/buildHumanFoodPromptBlock";
import { createHumanFoodRequestExecutionState } from "../services/humanFoodContext/requestExecutionState";

function preference(value: string | null = null) {
  return {
    value,
    source: value ? "request" as const : "unavailable" as const,
    available: value != null,
  };
}

function context(overrides: Partial<HumanFoodContext> = {}): HumanFoodContext {
  return {
    version: HUMAN_FOOD_CONTEXT_VERSION,
    status: "resolved",
    creator: "recipe_maker",
    actorUserId: "actor",
    subjectUserId: "subject",
    generationChainId: "chain",
    correlationId: "correlation",
    resolvedAt: "2026-09-03T00:00:00.000Z",
    expiresAt: "2026-09-03T00:05:00.000Z",
    diet: {
      stored: [],
      effective: [],
      source: "profile",
      requestOverride: null,
      adaptationOutcome: "not_needed",
    },
    flavor: {
      heat: preference(),
      seasoningIntensity: preference(),
      broadFlavor: preference(),
      flavorStyle: preference(),
      cuisine: preference(),
      cuisineIntensity: preference(),
      spiceComplexity: preference(),
    },
    safety: {
      allergies: [],
      avoidedFoods: [],
      dislikedFoods: [],
      healthConditions: [],
    },
    authorization: {
      status: "none",
      action: null,
      reservationId: null,
      waivers: [],
    },
    nutrition: null,
    behavior: null,
    diabetesFoodPreferences: null,
    gaps: [],
    notices: [],
    blockedReasons: [],
    internalFingerprint: "context-fingerprint",
    ...overrides,
  };
}

function generatedEvidence(overrides: HumanFoodCandidate["evidence"] = {}) {
  return {
    sourceType: "generated_recipe" as const,
    ingredientEvidence: "structured_generation" as const,
    preparationEvidence: "structured_generation" as const,
    nutritionEvidence: "structured_generation" as const,
    dishIdentityPreserved: true,
    categoryIdentityPreserved: true,
    ...overrides,
  };
}

describe("Chef ordinary fat goal classification", () => {
  const subject = () => context({
    nutrition: {
      prescription: { source: "user_default" },
      projectedRemaining: { calories: 500, carbs: 40, fat: 13 },
      activeConstraints: { consumedStarchExhausted: false },
    } as unknown as NonNullable<HumanFoodContext["nutrition"]>,
  });
  const dinner = () => ({
    name: "Chicken tacos",
    ingredients: [{ name: "chicken breast" }, { name: "cabbage" }, { name: "olive oil" }],
    instructions: ["Grill chicken and serve with cabbage."],
    nutrition: { calories: 300, protein: 35, carbs: 6, fat: 22, starchyCarbs: 0 },
    evidence: generatedEvidence(),
  });
  it("softens only ordinary fat for the opted-in Chef action, not every food surface", () => {
    const existing = validateHumanFoodCandidate(dinner(), subject());
    expect(existing.findings.some(f => f.code === "projected_fat_budget_exceeded")).toBe(true);
    const chef = validateHumanFoodCandidate(dinner(), subject(), { ordinaryFatAsGuidance: true });
    expect(chef.findings.some(f => f.code === "projected_fat_budget_exceeded")).toBe(false);
  });
  it("keeps calorie and carbohydrate findings under the same opt-in", () => {
    const candidate = dinner();
    candidate.nutrition.calories = 600;
    candidate.nutrition.carbs = 50;
    const result = validateHumanFoodCandidate(candidate, subject(), { ordinaryFatAsGuidance: true });
    expect(result.findings.some(f => f.code === "projected_calories_budget_exceeded")).toBe(true);
    expect(result.findings.some(f => f.code === "projected_carbs_budget_exceeded")).toBe(true);
  });
  it("uses the same goal-versus-limit distinction in the actual prompt", () => {
    const prompt = buildHumanFoodPromptBlock(subject(), { ordinaryFatAsGuidance: true });
    expect(prompt).toContain("NOT a meal-blocking ceiling");
    expect(prompt).toContain("Explicitly configured limits and applicable clinical fat restrictions");
    expect(prompt).toContain("500 kcal or 40g total carbohydrate");
    expect(buildHumanFoodPromptBlock(subject())).toContain("or 13g fat");
  });
  it("keeps the independent clinical fat check even when ordinary fat is guidance", () => {
    expect(validateHumanFoodResult(dinner(), subject(), { ordinaryFatAsGuidance: true }).valid).toBe(true);
    expect(validateClinicalMacros("glp1", 35, 15, 6, 22).passed).toBe(false);
  });
  it("does not waive a failed clinical directive proof", () => {
    const candidate = dinner();
    const protectedCandidate = {
      ...candidate,
      evidence: { ...candidate.evidence, clinicalDirectivesCompliant: false },
    };
    const protectedSubject = subject();
    protectedSubject.safety.healthConditions = ["clinician-directed restriction"];
    const result = validateHumanFoodCandidate(protectedCandidate, protectedSubject, {
      ordinaryFatAsGuidance: true,
    });
    expect(result.findings.some(f => f.dimension === "clinical" && f.outcome === "blocked")).toBe(true);
  });
});

describe("Development GLP-1 final evidence gate", () => {
  const oldEnv = process.env.NODE_ENV;
  const oldDeployment = process.env.REPLIT_DEPLOYMENT;
  afterAll(() => {
    process.env.NODE_ENV = oldEnv;
    if (oldDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = oldDeployment;
  });
  it("treats old medication text as history, but enforces an explicitly resolved current authority", () => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    const candidate: HumanFoodCandidate = {
      name: "Potato salad", ingredients: ["potatoes"], instructions: "Prepare and serve.",
      evidence: generatedEvidence(),
    };
    const oldHistory = context({ safety: {
      ...context().safety, healthConditions: ["semaglutide"], glp1MealAuthorityActive: false,
    } });
    const historical = validateHumanFoodCandidate(candidate, oldHistory);
    expect(historical.findings.some((finding) => finding.code === "glp1_evidence_missing")).toBe(false);
    const current = validateHumanFoodCandidate(candidate, context({ safety: {
      ...oldHistory.safety, glp1MealAuthorityActive: true,
    } }));
    expect(current.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "glp1_evidence_missing" }),
    ]));
  });
});

describe("strict Menu exact-requirement evidence", () => {
  const candidate = (overrides: HumanFoodCandidate["evidence"] = {}): HumanFoodCandidate => ({
    name: "Lentil Tomato Stew",
    ingredients: ["lentils", "tomatoes"],
    instructions: "Simmer lentils and tomatoes until tender.",
    nutrition: { calories: 300, protein: 20, carbs: 30, fat: 5, starchyCarbs: 20 },
    evidence: generatedEvidence(overrides),
  });
  const strict = (diets: string[], evidence: HumanFoodCandidate["evidence"], conditions: string[] = []) => {
    const baseline = context();
    return validateHumanFoodCandidate(candidate(evidence), context({
      diet: { ...baseline.diet, effective: diets },
      safety: { ...baseline.safety, healthConditions: conditions },
    }), { evidenceMode: "exact" });
  };
  const ingredient = (status: "pass" | "fail" | "review_required") => ({
    status, source: "ingredient_classifier" as const, nutritionBasis: "not_applicable" as const,
  });
  const medical = (status: "pass" | "fail", source: "diabetes_authority" | "glp1_authority") => ({
    status, source, nutritionBasis: "model_estimate" as const,
  });

  it("accepts the exact ingredient identity, blocks FAIL, and reviews UNKNOWN", () => {
    expect(strict(["vegan"], { requirementEvidence: { "dietary_identity:vegan": ingredient("pass") } }).outcome).toBe("pass");
    expect(strict(["vegan"], { requirementEvidence: { "dietary_identity:vegan": ingredient("fail") } }).outcome).toBe("blocked");
    expect(strict(["vegan"], { requirementEvidence: { "dietary_identity:vegan": ingredient("review_required") } }).outcome).toBe("review_required");
  });

  it("does not let vegan, a generic true, or a scan prove keto or Mediterranean", () => {
    for (const diet of ["keto", "mediterranean"]) {
      const result = strict(["vegan", diet], {
        dietaryIdentityCompliant: true,
        requirementEvidence: {
          "dietary_identity:vegan": ingredient("pass"),
          [`dietary_identity:${diet}`]: { status: "pass", source: "protocol_scan" },
        },
      });
      expect(result.outcome).toBe("review_required");
      expect(result.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: `requirement_evidence_required:dietary_identity:${diet}` }),
      ]));
    }
  });

  const lowCarbBuffaloCandidate = (overrides: HumanFoodCandidate = {}): HumanFoodCandidate => ({
    name: "Buffalo Chicken Cauliflower Casserole",
    description: "Baked chicken, cauliflower, cheddar, and homemade buffalo sauce.",
    ingredients: [
      "chicken breast",
      "cauliflower",
      "cheddar cheese",
      {
        name: "buffalo sauce",
        quantity: "1",
        unit: "tbsp",
        components: [
          { name: "butter", quantity: "1", unit: "tsp" },
          { name: "apple cider vinegar", quantity: "1", unit: "tsp" },
          { name: "cayenne pepper", quantity: "1/4", unit: "tsp" },
        ],
      },
      // The shared final validator requires compound sauce leaves to also be
      // exposed to its normal ingredient and allergen scans.
      "butter",
      "apple cider vinegar",
      "cayenne pepper",
    ],
    instructions: "Mix the named sauce components, coat chicken, add cauliflower and cheddar, then bake.",
    nutrition: { calories: 420, protein: 36, carbs: 10, fat: 26, starchyCarbs: 0 },
    evidence: generatedEvidence({
      requirementEvidence: {
        "dietary_identity:low carb": {
          status: "pass", source: "program_rule_pack", nutritionBasis: "model_estimate",
        },
      },
    }),
    ...overrides,
  });
  const lowCarbContext = () => {
    const baseline = context();
    return context({
      diet: { ...baseline.diet, effective: ["low_carb"] },
      nutrition: {
        prescription: { source: "user_default" },
        resolution: { status: "RESOLVED", reasonCodes: [] },
        projectedRemaining: { calories: 1800, protein: 120, carbs: 200, fat: 70 },
        remaining: { calories: 1800, protein: 120, carbs: 200, fat: 70 },
        activeConstraints: { consumedStarchExhausted: false },
      } as any,
    });
  };

  it("permits only generic non-safety source uncertainty in Menu release mode, without recording positive proof", () => {
    const generated = (ingredient: string): HumanFoodCandidate => ({
      name: "Chocolate Custard",
      ingredients: ["unsweetened cocoa powder", ingredient, "cauliflower"],
      instructions: "Blend and chill.",
      nutrition: { calories: 310, protein: 18, carbs: 12, fat: 20, starchyCarbs: 0 },
      evidence: generatedEvidence({
        requirementEvidence: {
          "dietary_identity:low carb": {
            status: "review_required", source: "program_rule_pack", nutritionBasis: "model_estimate",
          },
        },
      }),
    });
    const cocoa = [{
      ingredient: "unsweetened cocoa powder", category: "non_starchy_fibrous" as const,
      role: "structural", reason: "Named single-source powder.",
    }];
    const strict = validateHumanFoodCandidate(generated("unsweetened almond milk"), lowCarbContext(), {
      evidenceMode: "exact", contextualSourceDecisions: cocoa,
    });
    expect(strict.outcome).toBe("review_required");
    const generic = validateHumanFoodCandidate(generated("unsweetened almond milk"), lowCarbContext(), {
      evidenceMode: "exact", contextualSourceDecisions: cocoa, genericRecipeLowCarbRelease: true,
    });
    expect(generic.outcome).toBe("pass");
    const unsafeSource = validateHumanFoodCandidate(generated("mystery sweetener"), lowCarbContext(), {
      evidenceMode: "exact", contextualSourceDecisions: cocoa, genericRecipeLowCarbRelease: true,
    });
    expect(unsafeSource.outcome).not.toBe("pass");
    const allergyContext = lowCarbContext();
    allergyContext.safety.allergies = ["milk"];
    const allergy = validateHumanFoodCandidate(generated("unsweetened almond milk"), allergyContext, {
      evidenceMode: "exact", contextualSourceDecisions: cocoa, genericRecipeLowCarbRelease: true,
    });
    expect(allergy.outcome).toBe("blocked");
  });

  it("accepts source evidence for the requested casserole without treating cauliflower as starch", () => {
    const result = validateHumanFoodCandidate(
      lowCarbBuffaloCandidate(),
      lowCarbContext(),
      { evidenceMode: "exact", requestedDish: "Buffalo Chicken Cauliflower Casserole" },
    );

    expect(result.outcome).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("uses request-scoped contextual evidence in exact validation without letting it override allergies", () => {
    const candidate = lowCarbBuffaloCandidate({
      ingredients: [
        "chicken breast", "cauliflower", "cheddar cheese",
        { name: "vanilla extract", quantity: "1", unit: "tsp" },
      ],
      instructions: "Bake chicken, cauliflower, and cheddar; finish with the named extract.",
    });
    const decision = [{
      ingredient: "vanilla extract", category: "nonmaterial" as const,
      role: "flavoring", reason: "A small measured flavoring.",
    }];
    expect(validateHumanFoodCandidate(candidate, lowCarbContext(), {
      evidenceMode: "exact",
    }).outcome).toBe("review_required");
    expect(validateHumanFoodCandidate(candidate, lowCarbContext(), {
      evidenceMode: "exact", contextualSourceDecisions: decision,
    }).outcome).toBe("pass");
    const allergic = lowCarbContext();
    allergic.safety.allergies = ["chicken"];
    expect(validateHumanFoodCandidate(candidate, allergic, {
      evidenceMode: "exact", contextualSourceDecisions: decision,
    }).outcome).not.toBe("pass");
  });

  it("does not accept a claimed Low Carb PASS when ingredient or sauce-source evidence is ambiguous", () => {
    const candidate = lowCarbBuffaloCandidate({
      ingredients: [
        "chicken breast",
        "cauliflower",
        "cheddar cheese",
        "buffalo sauce",
      ],
      evidence: generatedEvidence({
        dietaryIdentityCompliant: true,
        requirementEvidence: {
          "dietary_identity:low carb": {
            status: "pass", source: "program_rule_pack", nutritionBasis: "model_estimate",
          },
        },
      }),
    });
    const result = validateHumanFoodCandidate(candidate, lowCarbContext(), { evidenceMode: "exact" });

    expect(result.outcome).toBe("review_required");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "requirement_evidence_required:dietary_identity:low carb",
        dimension: "dietary_identity",
      }),
    ]));
  });

  it("keeps a pasta-containing recipe under review even when its nutrition fits the remaining macro allocation", () => {
    const candidate = lowCarbBuffaloCandidate({
      ingredients: [
        "chicken breast", "cauliflower", "cheddar cheese",
        "whole wheat pasta",
        {
          name: "buffalo sauce", quantity: "1", unit: "tbsp",
          components: [
            { name: "butter", quantity: "1", unit: "tsp" },
            { name: "apple cider vinegar", quantity: "1", unit: "tsp" },
            { name: "cayenne pepper", quantity: "1/4", unit: "tsp" },
          ],
        },
        "butter",
        "apple cider vinegar",
        "cayenne pepper",
      ],
      nutrition: { calories: 500, protein: 36, carbs: 45, fat: 26, starchyCarbs: 20 },
    });
    const result = validateHumanFoodCandidate(candidate, lowCarbContext(), { evidenceMode: "exact" });

    expect(result.outcome).toBe("review_required");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "requirement_evidence_required:dietary_identity:low carb",
      }),
    ]));
    expect(result.findings.some((finding) => finding.code === "projected_carbs_budget_exceeded")).toBe(false);
  });

  it("requires resolved non-fallback subject nutrition before Low Carb proof can pass", () => {
    const candidate = lowCarbBuffaloCandidate();
    const baseline = context();
    const missing = context({
      diet: { ...baseline.diet, effective: ["low_carb"] },
      nutrition: null,
    });
    const fallback = context({
      diet: { ...baseline.diet, effective: ["low_carb"] },
      nutrition: {
        prescription: { source: "fallback" },
        projectedRemaining: { calories: 1800, protein: 120, carbs: 200, fat: 70 },
        remaining: { calories: 1800, protein: 120, carbs: 200, fat: 70 },
        activeConstraints: { consumedStarchExhausted: false },
      } as any,
    });

    for (const currentContext of [missing, fallback]) {
      const result = validateHumanFoodCandidate(candidate, currentContext, { evidenceMode: "exact" });
      expect(result.outcome).toBe("review_required");
      expect(result.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "requirement_evidence_required:dietary_identity:low carb",
        }),
      ]));
    }
  });

  it("keeps allergen exclusions authoritative when Low Carb source evidence passes", () => {
    const candidate = lowCarbBuffaloCandidate({
      ingredients: [
        "chicken breast", "cauliflower", "cheddar cheese", "peanut oil",
      ],
    });
    const baseline = context();
    const result = validateHumanFoodCandidate(
      candidate,
      context({
        diet: { ...baseline.diet, effective: ["low_carb"] },
        safety: { ...baseline.safety, allergies: ["peanut"] },
      }),
      { evidenceMode: "exact" },
    );

    expect(result.outcome).toBe("blocked");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ dimension: "allergy" }),
    ]));
  });

  it("fails closed when an allergen is hidden inside nested sauce component evidence", () => {
    const candidate = lowCarbBuffaloCandidate({
      ingredients: [
        "chicken breast", "cauliflower", "cheddar cheese",
        {
          name: "buffalo sauce", quantity: "1", unit: "tbsp",
          components: [
            { name: "butter", quantity: "1", unit: "tsp" },
            { name: "peanut butter", quantity: "1", unit: "tsp" },
          ],
        },
      ],
    });
    const baseline = context();
    const result = validateHumanFoodCandidate(
      candidate,
      context({
        diet: { ...baseline.diet, effective: ["low_carb"] },
        safety: { ...baseline.safety, allergies: ["peanut"] },
      }),
      { evidenceMode: "exact" },
    );

    expect(result.outcome).toBe("blocked");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "compound_ingredients_not_exposed",
        dimension: "provenance",
      }),
    ]));
  });

  it("does not let one valid identity hide an unknown or a failure on another", () => {
    expect(strict(["vegan", "carnivore"], {
      requirementEvidence: { "dietary_identity:vegan": ingredient("pass") },
    }).outcome).toBe("review_required");
    expect(strict(["vegan", "carnivore"], {
      requirementEvidence: {
        "dietary_identity:vegan": ingredient("pass"),
        "dietary_identity:carnivore": ingredient("fail"),
      },
    }).outcome).toBe("blocked");
  });

  it("requires the exact diabetes and GLP-1 authority, not generic clinical success", () => {
    expect(strict(["diabetic"], {
      dietaryIdentityCompliant: true, clinicalDirectivesCompliant: true, diabetesCompliant: true,
    }, ["diabetes"]).outcome).toBe("review_required");
    expect(strict(["diabetic"], { requirementEvidence: {
      "dietary_identity:diabetic": medical("pass", "diabetes_authority"),
      "clinical:diabetes": medical("pass", "diabetes_authority"),
    } }, ["diabetes"]).outcome).toBe("pass");
    expect(strict(["glp1"], { requirementEvidence: {
      "dietary_identity:glp1": medical("pass", "glp1_authority"),
      "clinical:glp1": medical("pass", "glp1_authority"),
    } }, ["semaglutide"]).outcome).toBe("pass");
    expect(strict(["glp1"], { requirementEvidence: {
      "dietary_identity:glp1": medical("pass", "glp1_authority"),
    } }, ["semaglutide"]).outcome).toBe("review_required");
  });

  it("requires each clinical directive separately even if generic clinical proof is true", () => {
    const result = strict(["vegan"], {
      clinicalDirectivesCompliant: true,
      requirementEvidence: { "dietary_identity:vegan": ingredient("pass") },
    }, ["kidney disease"]);
    expect(result.outcome).toBe("review_required");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "requirement_evidence_required:clinical:kidney disease" }),
    ]));
  });

  it("does not treat a generic, unrelated, or nutrition-provenance-free claim as authority", () => {
    expect(strict(["vegan"], { dietaryIdentityCompliant: true }).outcome).toBe("review_required");
    expect(strict(["vegan"], { requirementEvidence: {
      "dietary_identity:vegan": { status: "pass", source: "glp1_authority" },
    } }).outcome).toBe("review_required");
    expect(strict(["diabetic"], { requirementEvidence: {
      "dietary_identity:diabetic": { status: "pass", source: "diabetes_authority" },
    } }).outcome).toBe("review_required");
  });

  it("retains legacy generic evidence semantics without extending them to strict mode", () => {
    const baseline = context();
    const old = validateHumanFoodCandidate(candidate({ dietaryIdentityCompliant: true }),
      context({ diet: { ...baseline.diet, effective: ["keto"] } }));
    expect(old.findings.some((finding) => finding.code === "dietary_identity_evidence_required:keto")).toBe(false);
    expect(strict(["keto"], { dietaryIdentityCompliant: true }).outcome).toBe("review_required");
  });
});

describe("universal Human Food final-validation contract", () => {
  it("uses the Low Carb 70/30 source policy without changing the existing Macro Calculator carbohydrate target", () => {
    const baseline = context();
    const promptContext = context({
      diet: { ...baseline.diet, effective: ["low_carb"] },
      nutrition: {
        prescription: { source: "user_default" },
        resolution: { status: "RESOLVED", reasonCodes: [] },
        projectedRemaining: { calories: 1800, protein: 120, carbs: 200, fat: 70 },
        activeConstraints: { consumedStarchExhausted: false },
      } as any,
    });
    const prompt = buildHumanFoodPromptBlock(promptContext);

    expect(prompt).toContain("70% non-starchy/fibrous food sources");
    expect(prompt).toContain("30% starchy/concentrated food sources");
    expect(prompt).toContain("Keep the Macro Calculator's established total-carbohydrate target unchanged");
    expect(prompt).toContain("no candidate may exceed 1800 kcal, 200g total carbohydrate, or 70g fat");
    expect(prompt).not.toContain("recalculate it downward");
  });

  it("does not enforce fallback placeholder zeroes as canonical nutrition budgets", () => {
    const fallbackContext = context({
      nutrition: {
        prescription: { source: "fallback" },
        resolution: { status: "INSUFFICIENT_DATA", reasonCodes: ["fallback_prescription"] },
        projectedRemaining: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        remaining: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        activeConstraints: { consumedStarchExhausted: false },
      } as any,
    });
    const candidate = {
      name: "Herb Chicken",
      category: "dinner",
      ingredients: ["chicken breast", "broccoli", "olive oil"],
      instructions: "Grill the chicken and steam the broccoli.",
      nutrition: { calories: 420, protein: 40, carbs: 12, fat: 18, starchyCarbs: 0 },
      evidence: generatedEvidence(),
    };

    expect(validateHumanFoodCandidate(candidate, fallbackContext).findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "projected_calories_budget_exceeded" }),
      ]),
    );
    expect(validateHumanFoodResult(candidate, fallbackContext).violations).not.toContain(
      "projected_calorie_budget_exceeded",
    );
    expect(buildHumanFoodPromptBlock(fallbackContext)).toContain(
      "do not interpret unavailable targets as a zero-calorie budget",
    );
    expect(buildHumanFoodPromptBlock(fallbackContext)).not.toContain(
      "no candidate may exceed 0 kcal",
    );
  });

  it("keeps resolved positive nutrition overages repairable without bypassing the ceiling", () => {
    const resolvedContext = context({
      nutrition: {
        prescription: { source: "user_default" },
        resolution: { status: "RESOLVED", reasonCodes: [] },
        projectedRemaining: { calories: 300, protein: 40, carbs: 25, fat: 12 },
        activeConstraints: { consumedStarchExhausted: false },
      } as any,
    });
    const result = validateHumanFoodCandidate({
      name: "Herb Chicken",
      ingredients: ["chicken breast", "broccoli", "olive oil"],
      nutrition: { calories: 420, protein: 40, carbs: 20, fat: 10, starchyCarbs: 0 },
      evidence: generatedEvidence(),
    }, resolvedContext);

    expect(result.outcome).toBe("repairable");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "projected_calories_budget_exceeded" }),
    ]));
    expect(buildHumanFoodPromptBlock(resolvedContext)).toContain(
      "no candidate may exceed 300 kcal",
    );
  });

  const glucosePreferenceContext = (
    state: "LOW" | "IN_RANGE" | "HIGH",
    selectedFruits: string[],
    selectedVegetables: string[],
    override = false,
  ): HumanFoodContext["diabetesFoodPreferences"] => ({
    state,
    preferenceBand: state,
    valueMgdl: state === "LOW" ? 62 : state === "HIGH" ? 190 : 110,
    context: "RANDOM",
    source: "LOG",
    ageMinutes: 5,
    criticalLow: false,
    criticalHigh: false,
    preferencesConfigured: true,
    selectedFruits,
    selectedVegetables,
    safetyOverride: {
      active: override,
      reason: override ? "HYPOGLYCEMIA_TREATMENT" : null,
      allowedProduce: override ? ["Banana"] : [],
    },
  });

  it.each([
    ["HIGH", ["Blueberries"], ["Broccoli", "Spinach"]],
    ["IN_RANGE", ["Apple"], ["Broccoli"]],
    ["LOW", ["Orange"], ["Broccoli"]],
  ] as const)("rejects unapproved produce for configured %s preferences", (state, fruits, vegetables) => {
    const result = validateHumanFoodCandidate({
      name: "Chicken bowl",
      ingredients: ["chicken breast", "broccoli", "banana"],
      evidence: generatedEvidence(),
    }, context({
      diabetesFoodPreferences: glucosePreferenceContext(state, [...fruits], [...vegetables]),
    }));

    expect(result.outcome).toBe("repairable");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dimension: "glucose_food_preference",
        code: "glucose_produce_not_allowed:banana",
      }),
    ]));
  });

  it("allows only the explicit whole-produce hypoglycemia override", () => {
    const result = validateHumanFoodCandidate({
      name: "Low glucose recovery plate",
      ingredients: ["banana", "chicken breast"],
      evidence: generatedEvidence(),
    }, context({
      diabetesFoodPreferences: glucosePreferenceContext("LOW", [], [], true),
    }));

    expect(result.findings.some((finding) =>
      finding.dimension === "glucose_food_preference"
    )).toBe(false);
  });

  it("accepts omnivore as an unrestricted dietary identity", () => {
    const result = validateHumanFoodCandidate({
      name: "Herb-Marinated Grilled Pork Chop",
      category: "dinner",
      ingredients: ["pork chop", "olive oil", "garlic", "rosemary", "spinach", "tomato"],
      instructions: "Marinate the pork chop, then grill until cooked through.",
      evidence: generatedEvidence(),
    }, context({
      diet: {
        stored: ["omnivore"],
        effective: ["omnivore"],
        source: "profile",
        requestOverride: null,
        adaptationOutcome: "not_needed",
      },
    }), { requestedDish: "pork chop", requestedCategory: "dinner" });

    expect(result.outcome).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it.each([
    {
      name: "Strawberry Vegan Ice Cream",
      description: "A creamy frozen strawberry dessert made with coconut cream.",
      ingredients: ["strawberries", "coconut cream", "oat milk", "maple syrup"],
      instructions: "Blend the strawberries with coconut cream and oat milk, then churn into ice cream.",
    },
    {
      name: "Cashew Cream Cheesecake",
      description: "A dairy-free cheesecake with a cashew cream cheese filling.",
      ingredients: ["cashew cream cheese", "almond milk", "cocoa butter", "dates"],
      instructions: "Blend the cashew cream cheese filling and chill until set.",
    },
  ])("does not mistake plant-based compound names for vegan violations: $name", (candidate) => {
    const result = validateHumanFoodCandidate({
      ...candidate,
      category: "snack",
      evidence: generatedEvidence({ dietaryIdentityCompliant: true }),
    }, context({
      diet: {
        stored: ["vegan"],
        effective: ["vegan"],
        source: "request",
        requestOverride: "vegan",
        adaptationOutcome: "adapted",
      },
    }));

    expect(result.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "dietary_identity:vegan" }),
    ]));
  });

  it("still blocks actual dairy when a plant-based compound is also present", () => {
    const result = validateHumanFoodCandidate({
      name: "Strawberry Vegan Ice Cream",
      ingredients: ["strawberries", "coconut cream", "dairy milk"],
      instructions: "Blend coconut cream with dairy milk and freeze.",
      evidence: generatedEvidence({ dietaryIdentityCompliant: false }),
    }, context({
      diet: {
        stored: ["vegan"],
        effective: ["vegan"],
        source: "request",
        requestOverride: "vegan",
        adaptationOutcome: "adapted",
      },
    }));

    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "dietary_identity:vegan" }),
    ]));
  });

  it("does not turn processing uncertainty into a hard stop for a structured generated recipe", () => {
    const result = validateHumanFoodCandidate({
      name: "Japanese-Inspired Strawberry Vegan Ice Cream",
      category: "snack",
      description: "A frozen strawberry dessert with subtle matcha.",
      ingredients: ["strawberries", "coconut cream", "oat milk", "matcha"],
      instructions: "Blend, churn, and freeze until scoopable.",
      evidence: generatedEvidence({
        dietaryIdentityCompliant: true,
        cuisine: "Japanese",
      }),
    }, context({
      diet: {
        stored: ["vegan"],
        effective: ["vegan"],
        source: "request",
        requestOverride: "vegan",
        adaptationOutcome: "adapted",
      },
      flavor: {
        ...context().flavor,
        cuisine: preference("Japanese"),
      },
    }), {
      requestedDish: "strawberry vegan ice cream",
      requestedCategory: "snack",
    });

    expect(result.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "whole_food_evidence_insufficient" }),
    ]));
    expect(result.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "dish_identity_lost" }),
    ]));
  });

  it("continues to require review for genuinely unknown dietary identities", () => {
    const result = validateHumanFoodCandidate({
      name: "Vegetable Plate",
      ingredients: ["spinach", "tomato", "carrot"],
      evidence: generatedEvidence(),
    }, context({
      diet: {
        stored: ["unmapped_custom_diet"],
        effective: ["unmapped_custom_diet"],
        source: "profile",
        requestOverride: null,
        adaptationOutcome: "not_needed",
      },
    }));

    expect(result.outcome).toBe("review_required");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "dietary_identity_unsupported:unmapped custom diet",
      }),
    ]));
  });

  it("accepts a canonical builder protocol with positive structured evidence", () => {
    const result = validateHumanFoodCandidate({
      name: "Turmeric Quinoa Breakfast Bowl",
      category: "breakfast",
      ingredients: ["quinoa", "spinach", "turmeric", "blueberries", "olive oil"],
      instructions: "Cook the quinoa and serve with the vegetables, turmeric, and berries.",
      evidence: generatedEvidence({ dietaryIdentityCompliant: true }),
    }, context({
      diet: {
        stored: ["vegan"],
        effective: ["anti-inflammatory"],
        source: "request",
        requestOverride: "anti-inflammatory",
        adaptationOutcome: "request_override_applied",
      },
    }), { requestedDish: "breakfast", requestedCategory: "breakfast" });

    expect(result.outcome).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("still requires evidence for a canonical builder protocol", () => {
    const result = validateHumanFoodCandidate({
      name: "Breakfast Bowl",
      category: "breakfast",
      ingredients: ["quinoa", "spinach"],
      evidence: generatedEvidence({ dietaryIdentityCompliant: false }),
    }, context({
      diet: {
        stored: [],
        effective: ["anti-inflammatory"],
        source: "request",
        requestOverride: "anti-inflammatory",
        adaptationOutcome: "request_override_applied",
      },
    }), { requestedDish: "breakfast", requestedCategory: "breakfast" });

    expect(result.outcome).toBe("review_required");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "dietary_identity_evidence_required:anti inflammatory",
      }),
    ]));
  });

  it("accepts GLP-1 as supported when its required structured evidence is positive", () => {
    const result = validateHumanFoodCandidate({
      name: "Herbed Shrimp and Egg White Breakfast Bowl",
      category: "breakfast",
      ingredients: ["shrimp", "egg whites", "spinach", "mushrooms", "tomato"],
      nutrition: { calories: 350, protein: 58, carbs: 12, fat: 7, starchyCarbs: 0 },
      evidence: generatedEvidence({
        dietaryIdentityCompliant: true,
        glp1Compliant: true,
      }),
    }, context({
      diet: {
        stored: [],
        effective: ["glp1"],
        source: "request",
        requestOverride: "glp1",
        adaptationOutcome: "request_override_applied",
      },
    }), { requestedCategory: "breakfast" });

    expect(result.outcome).toBe("pass");
    expect(result.findings.some((finding) =>
      finding.code === "dietary_identity_unsupported:glp1")).toBe(false);
  });

  it.each([undefined, false])(
    "keeps GLP-1 fail-closed when structured dietary evidence is %s",
    (dietaryIdentityCompliant) => {
      const result = validateHumanFoodCandidate({
        name: "Breakfast Bowl",
        category: "breakfast",
        ingredients: ["egg whites", "spinach", "tomato"],
        evidence: generatedEvidence({
          dietaryIdentityCompliant,
          glp1Compliant: true,
        }),
      }, context({
        diet: {
          stored: [],
          effective: ["glp1"],
          source: "request",
          requestOverride: "glp1",
          adaptationOutcome: "request_override_applied",
        },
      }));

      expect(result.outcome).toBe("review_required");
      expect(result.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "dietary_identity_evidence_required:glp1",
        }),
      ]));
    },
  );

  it("accepts general nutrition with positive structured evidence", () => {
    const result = validateHumanFoodCandidate({
      name: "Chicken and Vegetable Plate",
      category: "dinner",
      ingredients: ["chicken breast", "broccoli", "tomato", "olive oil"],
      evidence: generatedEvidence({ dietaryIdentityCompliant: true }),
    }, context({
      diet: {
        stored: [],
        effective: ["general-nutrition"],
        source: "request",
        requestOverride: "general-nutrition",
        adaptationOutcome: "request_override_applied",
      },
    }));

    expect(result.outcome).toBe("pass");
  });

  it.each([
    ["Create with Chef", "dinner", "Chicken and Vegetable Plate"],
    ["Snack Creator", "snack", "Apple and Hard-Boiled Egg Snack"],
  ])("allows a valid ordinary %s candidate", (_creator, category, name) => {
    const result = validateHumanFoodCandidate({
      name,
      category,
      ingredients: category === "snack"
        ? ["apple", "hard-boiled egg"]
        : ["chicken breast", "broccoli", "tomato"],
      evidence: generatedEvidence(),
    }, context(), { requestedCategory: category });

    expect(result.outcome).toBe("pass");
  });

  it("blocks lactose derivatives while preserving Indian cuisine evidence", () => {
    const result = validateHumanFoodCandidate({
      name: "Palak Paneer",
      category: "dinner",
      ingredients: ["spinach", "paneer", "ghee"],
      instructions: "Temper Indian spices in ghee.",
      evidence: generatedEvidence({ cuisine: "Indian", cuisineIntensity: "authentic" }),
    }, context({
      safety: { allergies: ["lactose"], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
      flavor: {
        ...context().flavor,
        cuisine: preference("Indian"),
        cuisineIntensity: preference("authentic"),
      },
    }));

    expect(result.outcome).toBe("blocked");
    expect(result.findings.some((finding) => finding.dimension === "allergy")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "cuisine_mismatch")).toBe(false);
  });

  it("keeps vegan identity authoritative inside diabetes validation", () => {
    const result = validateHumanFoodCandidate({
      name: "Chicken Quinoa Bowl",
      category: "dinner",
      ingredients: ["chicken", "quinoa", "spinach"],
      nutrition: { calories: 420, carbs: 28, fat: 10, starchyCarbs: 18 },
      evidence: generatedEvidence({ diabetesCompliant: true }),
    }, context({
      diet: {
        stored: ["vegan"], effective: ["vegan"], source: "profile",
        requestOverride: null, adaptationOutcome: "not_needed",
      },
      safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: ["diabetes"] },
    }));

    expect(result.outcome).toBe("blocked");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "dietary_identity:vegan" }),
    ]));
  });

  it("blocks a GLP-1 dessert that structured evidence marks noncompliant", () => {
    const result = validateHumanFoodCandidate({
      name: "Chocolate Brownie",
      category: "dessert",
      ingredients: ["cocoa", "egg", "butter"],
      evidence: generatedEvidence({ glp1Compliant: false }),
    }, context({
      safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: ["GLP-1"] },
    }), { requestedDish: "chocolate brownie", requestedCategory: "dessert" });

    expect(result.outcome).toBe("blocked");
    expect(result.findings.some((finding) => finding.code === "glp1_noncompliant")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "food_category_changed")).toBe(false);
  });

  it("blocks shellfish gumbo but allows recognizable shellfish-free gumbo", () => {
    const shellfishContext = context({
      safety: { allergies: ["shellfish"], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
    });
    const unsafe = validateHumanFoodCandidate({
      name: "Shrimp Gumbo",
      category: "dinner",
      ingredients: ["shrimp", "shellfish stock", "okra"],
      evidence: generatedEvidence(),
    }, shellfishContext, { requestedDish: "gumbo", requestedCategory: "dinner" });
    const safe = validateHumanFoodCandidate({
      name: "Chicken and Okra Gumbo",
      category: "dinner",
      ingredients: ["chicken", "okra", "tomato", "spices"],
      evidence: generatedEvidence(),
    }, shellfishContext, { requestedDish: "gumbo", requestedCategory: "dinner" });

    expect(unsafe.outcome).toBe("blocked");
    expect(safe.outcome).toBe("pass");
  });

  it.each([
    ["fish", "salmon"],
    ["soy", "tofu"],
  ])("blocks canonical %s allergen variants such as %s", (allergy, ingredient) => {
    const result = validateHumanFoodCandidate({
      name: "Unsafe Bowl",
      ingredients: [{ name: "", item: ingredient }, "spinach", "tomato"],
      evidence: generatedEvidence(),
    }, context({
      safety: { allergies: [allergy], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
    }));

    expect(result.outcome).toBe("blocked");
    expect(result.findings.some((finding) => finding.code === `allergy:${allergy}`)).toBe(true);
  });

  it("uses canonical exhausted-starch state for sushi", () => {
    const starchContext = context({
      nutrition: {
        activeConstraints: { consumedStarchExhausted: true },
        projectedRemaining: { calories: 500, protein: 40, carbs: 30, fat: 20 },
      } as any,
    });
    const riceSushi = validateHumanFoodCandidate({
      name: "Salmon Sushi",
      category: "sushi",
      ingredients: ["salmon", "sushi rice", "nori"],
      nutrition: { calories: 300, carbs: 25, fat: 8, starchyCarbs: 22 },
      evidence: generatedEvidence(),
    }, starchContext, { requestedDish: "sushi", requestedCategory: "sushi" });
    const sashimi = validateHumanFoodCandidate({
      name: "Salmon Sushi-Style Sashimi",
      category: "sushi",
      ingredients: ["salmon", "avocado", "cucumber", "nori"],
      nutrition: { calories: 220, carbs: 6, fat: 8, starchyCarbs: 0 },
      evidence: generatedEvidence(),
    }, starchContext, { requestedDish: "sushi", requestedCategory: "sushi" });

    expect(riceSushi.outcome).toBe("blocked");
    expect(riceSushi.findings.some((finding) => finding.code === "consumed_starch_budget_exhausted")).toBe(true);
    expect(sashimi.outcome).toBe("pass");
  });

  it("returns bounded request-local repair instructions with the same context fingerprint", () => {
    const executionState = createHumanFoodRequestExecutionState();
    const repairContext = context({
      safety: { allergies: [], avoidedFoods: ["mushroom"], dislikedFoods: [], healthConditions: [] },
    });
    for (let index = 0; index < 4; index += 1) {
      validateHumanFoodCandidate({
        name: `Chicken Mushroom Curry ${index}`,
        ingredients: ["chicken", "mushroom", "spinach"],
        evidence: generatedEvidence(),
      }, repairContext, { executionState });
    }
    const result = validateHumanFoodCandidate({
      name: "Chicken Mushroom Curry Final",
      ingredients: ["chicken", "mushroom", "spinach"],
      evidence: generatedEvidence(),
    }, repairContext, { executionState });

    expect(result.outcome).toBe("repairable");
    expect(executionState.rejectedCandidateSignatures).toHaveLength(3);
    expect(result.repairInstructions.join(" ")).toContain("context-fingerprint");
    expect(result.repairInstructions.join(" ")).toContain("Preserve the requested cuisine");
  });

  it("requires review for unverifiable halal, restaurant, and branded-product claims", () => {
    const result = validateHumanFoodCandidate({
      name: "Restaurant Chicken Curry",
      ingredients: ["chicken", "spices"],
      evidence: generatedEvidence({
        sourceType: "restaurant",
        ingredientEvidence: "unknown",
        preparationEvidence: "unknown",
        halalCertification: "claimed",
      }),
    }, context({
      diet: {
        stored: ["halal"], effective: ["halal"], source: "profile",
        requestOverride: null, adaptationOutcome: "not_needed",
      },
    }));

    expect(result.outcome).toBe("review_required");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "halal_certification_unverified", assurance: "cannot_guarantee" }),
      expect.objectContaining({ code: "commercial_food_facts_unverified", assurance: "cannot_guarantee" }),
    ]));
  });

  it.each([
    ["dairy_free", "butter"],
    ["gluten-free", "wheat flour"],
  ])("normalizes and blocks %s identity conflicts", (diet, ingredient) => {
    const result = validateHumanFoodCandidate({
      name: "Conflicting Recipe",
      ingredients: ["spinach", ingredient],
      evidence: generatedEvidence(),
    }, context({
      diet: {
        stored: [diet], effective: [diet], source: "profile",
        requestOverride: null, adaptationOutcome: "not_needed",
      },
    }));

    expect(result.outcome).toBe("blocked");
    expect(result.findings.some((finding) => finding.code === `dietary_identity:${diet.replace(/[_-]/g, " ")}`)).toBe(true);
  });

  it("never passes keto without structured diet evidence", () => {
    const result = validateHumanFoodCandidate({
      name: "Rice Bowl",
      ingredients: ["rice", "beans", "tomato"],
      nutrition: { calories: 500, carbs: 75, fat: 8, starchyCarbs: 60 },
      evidence: generatedEvidence(),
    }, context({
      diet: {
        stored: ["keto"], effective: ["keto"], source: "profile",
        requestOverride: null, adaptationOutcome: "not_needed",
      },
    }));

    expect(result.outcome).toBe("review_required");
    expect(result.findings.some((finding) => finding.code === "dietary_identity_evidence_required:keto")).toBe(true);
  });

  it("requires review when canonical nutrition exists but macros are missing", () => {
    const result = validateHumanFoodCandidate({
      name: "Chicken and Spinach",
      ingredients: ["chicken", "spinach"],
      evidence: generatedEvidence(),
    }, context({
      nutrition: {
        activeConstraints: { consumedStarchExhausted: false },
        projectedRemaining: { calories: 500, protein: 40, carbs: 30, fat: 20 },
      } as any,
    }));

    expect(result.outcome).toBe("review_required");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "verified_calories_missing" }),
      expect.objectContaining({ code: "verified_carbs_missing" }),
      expect.objectContaining({ code: "verified_fat_missing" }),
    ]));
  });
});