import { HUMAN_FOOD_CONTEXT_VERSION, type HumanFoodContext } from "../../shared/humanFoodContext";
import type { HumanFoodCandidate } from "../../shared/humanFoodValidation";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
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
    nutrition: null,
    behavior: null,
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

describe("universal Human Food final-validation contract", () => {
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