/**
 * Tests: scanGeneratedOutput — completePlate.sides allergen enforcement
 *
 * Confirms that the post-generation guardrail strips or flags any suggested
 * side that contains a confirmed/suspected allergen for the child.
 */

import { scanGeneratedOutput } from "../services/pediatric/pediatricGuardrails";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRecipe(sides: any[]): any {
  return {
    recipeName: "Test Entrée",
    ageStageSuitability: "Suitable for preschool",
    ingredients: [{ name: "Chicken", quantity: "80g" }],
    instructions: ["Step 1", "Step 2", "Step 3", "Step 4"],
    servingGuidance: "Offer a small portion.",
    textureAndChokingPreparation: "Cut into small pieces.",
    allergenAlerts: [],
    whyThisVersionIsBetter: "A better version.",
    serveSuggestion: "Serve warm.",
    funPresentationIdea: "Make it fun.",
    rulesFireLog: [],
    completePlate: {
      sides,
      plateNote: "A complete plate.",
    },
  };
}

function milkAllergy(severity: string) {
  return [{ allergenId: "milk", severity }];
}

// ── 1. Confirmed milk allergy — dairy sides must be stripped ─────────────────

describe("completePlate allergen enforcement — confirmed milk allergy", () => {
  const allergies = milkAllergy("confirmed_allergy");

  it("removes a yogurt side", () => {
    const recipe = makeRecipe([
      { name: "Plain yogurt", category: "dairy", servingSize: "2 tbsp", prepNote: "Serve cold", nutritionalRole: "Provides calcium", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", allergies);
    const sides = result.patchedRecipe.completePlate.sides;
    expect(sides).toHaveLength(0);
  });

  it("removes a cheese side", () => {
    const recipe = makeRecipe([
      { name: "Cheddar cheese cubes", category: "dairy", servingSize: "3–4 small cubes", prepNote: "Cut into small cubes", nutritionalRole: "Calcium and protein", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", allergies);
    expect(result.patchedRecipe.completePlate.sides).toHaveLength(0);
  });

  it("removes a milk-based custard side", () => {
    const recipe = makeRecipe([
      { name: "Vanilla custard", category: "dairy", servingSize: "2 tbsp", prepNote: "Serve at room temperature", nutritionalRole: "Adds calcium", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "toddler", allergies);
    expect(result.patchedRecipe.completePlate.sides).toHaveLength(0);
  });

  it("keeps a non-dairy side alongside a removed dairy side", () => {
    const recipe = makeRecipe([
      { name: "Steamed broccoli florets", category: "vegetable", servingSize: "2–3 small florets", prepNote: "Steam until soft", nutritionalRole: "Iron and fibre", allergenFree: true },
      { name: "Yogurt cup", category: "dairy", servingSize: "2 tbsp", prepNote: "Serve cold", nutritionalRole: "Calcium", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", allergies);
    const sides = result.patchedRecipe.completePlate.sides;
    expect(sides).toHaveLength(1);
    expect(sides[0].name).toBe("Steamed broccoli florets");
  });

  it("logs a ruleFireLog entry for each removed dairy side", () => {
    const recipe = makeRecipe([
      { name: "Mozzarella slices", category: "dairy", servingSize: "1 thin slice", prepNote: "", nutritionalRole: "Calcium", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", allergies);
    const logs = result.patchedRecipe.rulesFireLog as any[];
    const allergenLog = logs.find((l: any) => l.ruleId === "allergen-side-removal:milk");
    expect(allergenLog).toBeDefined();
    expect(allergenLog.level).toBe("A");
  });

  it("adds an allergenAlert entry for each removed dairy side", () => {
    const recipe = makeRecipe([
      { name: "Cottage cheese", category: "dairy", servingSize: "2 tbsp", prepNote: "", nutritionalRole: "Protein", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", allergies);
    const alerts = result.patchedRecipe.allergenAlerts as any[];
    const milkAlert = alerts.find((a: any) => a.allergenId === "milk");
    expect(milkAlert).toBeDefined();
    expect(milkAlert.severity).toBe("confirmed_removed");
  });

  it("preserves all non-dairy sides unmodified", () => {
    const recipe = makeRecipe([
      { name: "Sliced ripe banana", category: "fruit", servingSize: "½ small banana", prepNote: "Peel and slice", nutritionalRole: "Potassium", allergenFree: true },
      { name: "Whole grain crackers", category: "grain", servingSize: "2 small crackers", prepNote: "", nutritionalRole: "Fibre", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", allergies);
    const sides = result.patchedRecipe.completePlate.sides;
    expect(sides).toHaveLength(2);
    expect(sides.map((s: any) => s.name)).toContain("Sliced ripe banana");
    expect(sides.map((s: any) => s.name)).toContain("Whole grain crackers");
  });
});

// ── 2. Clinician elimination — same hard-block behaviour ─────────────────────

describe("completePlate allergen enforcement — clinician_elimination", () => {
  const allergies = milkAllergy("clinician_elimination");

  it("removes a butter side when milk is clinician-eliminated", () => {
    const recipe = makeRecipe([
      { name: "Butter-coated toast fingers", category: "grain", servingSize: "1 strip", prepNote: "Spread thinly", nutritionalRole: "Carbohydrates", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "toddler", allergies);
    expect(result.patchedRecipe.completePlate.sides).toHaveLength(0);
  });
});

// ── 3. Suspected reaction — side is flagged, not removed ─────────────────────

describe("completePlate allergen enforcement — suspected_reaction", () => {
  const allergies = milkAllergy("suspected_reaction");

  it("keeps the dairy side but sets allergenFree=false", () => {
    const recipe = makeRecipe([
      { name: "Yogurt", category: "dairy", servingSize: "2 tbsp", prepNote: "", nutritionalRole: "Calcium", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", allergies);
    const sides = result.patchedRecipe.completePlate.sides;
    expect(sides).toHaveLength(1);
    expect(sides[0].allergenFree).toBe(false);
  });

  it("logs a Level B ruleFireLog entry for the flagged side", () => {
    const recipe = makeRecipe([
      { name: "Yogurt", category: "dairy", servingSize: "2 tbsp", prepNote: "", nutritionalRole: "Calcium", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", allergies);
    const logs = result.patchedRecipe.rulesFireLog as any[];
    const flagLog = logs.find((l: any) => l.ruleId === "allergen-side-flag:milk");
    expect(flagLog).toBeDefined();
    expect(flagLog.level).toBe("B");
  });
});

// ── 4. Intolerance — side is flagged, not removed ────────────────────────────

describe("completePlate allergen enforcement — intolerance", () => {
  it("keeps a dairy side but flags it when severity is intolerance", () => {
    const recipe = makeRecipe([
      { name: "Cheese slices", category: "dairy", servingSize: "1 thin slice", prepNote: "", nutritionalRole: "Calcium", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", [{ allergenId: "milk", severity: "intolerance" }]);
    const sides = result.patchedRecipe.completePlate.sides;
    expect(sides).toHaveLength(1);
    expect(sides[0].allergenFree).toBe(false);
  });
});

// ── 5. No allergies — sides pass through unchanged ───────────────────────────

describe("completePlate allergen enforcement — no allergies", () => {
  it("passes all sides through when allergies array is empty", () => {
    const recipe = makeRecipe([
      { name: "Yogurt", category: "dairy", servingSize: "2 tbsp", prepNote: "", nutritionalRole: "Calcium", allergenFree: true },
      { name: "Apple slices", category: "fruit", servingSize: "3–4 thin slices", prepNote: "Peel and slice", nutritionalRole: "Fibre", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", []);
    expect(result.patchedRecipe.completePlate.sides).toHaveLength(2);
  });

  it("passes all sides through when allergies parameter is omitted", () => {
    const recipe = makeRecipe([
      { name: "Yogurt", category: "dairy", servingSize: "2 tbsp", prepNote: "", nutritionalRole: "Calcium", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool");
    expect(result.patchedRecipe.completePlate.sides).toHaveLength(1);
  });
});

// ── 6. Custom allergen (allergenId="other") — removed via customAllergenName ──

describe("completePlate allergen enforcement — custom allergen (allergenId='other')", () => {
  it("removes a kiwi side when the child has a confirmed kiwi custom allergy", () => {
    const recipe = makeRecipe([
      {
        name: "Kiwi slices",
        category: "fruit",
        servingSize: "3 slices",
        prepNote: "Peel and slice thinly",
        nutritionalRole: "Vitamin C",
        allergenFree: true,
      },
      {
        name: "Steamed broccoli",
        category: "vegetable",
        servingSize: "2–3 florets",
        prepNote: "Steam until tender",
        nutritionalRole: "Iron",
        allergenFree: true,
      },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", [
      { allergenId: "other", customAllergenName: "Kiwi", severity: "confirmed_allergy" },
    ]);
    const sides = result.patchedRecipe.completePlate.sides;
    const kiwiSide = sides.find((s: any) => (s.name ?? "").toLowerCase().includes("kiwi"));
    expect(kiwiSide).toBeUndefined();
  });

  it("keeps a non-matching side when only the custom allergen side is removed", () => {
    const recipe = makeRecipe([
      { name: "Kiwi slices", category: "fruit", servingSize: "3 slices", prepNote: "", nutritionalRole: "Vitamin C", allergenFree: true },
      { name: "Steamed broccoli", category: "vegetable", servingSize: "2–3 florets", prepNote: "Steam", nutritionalRole: "Iron", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", [
      { allergenId: "other", customAllergenName: "Kiwi", severity: "confirmed_allergy" },
    ]);
    const sides = result.patchedRecipe.completePlate.sides;
    expect(sides.find((s: any) => s.name === "Steamed broccoli")).toBeDefined();
  });

  it("matches plural form (kiwis) as well as singular (kiwi)", () => {
    const recipe = makeRecipe([
      { name: "Fresh kiwis", category: "fruit", servingSize: "2 pieces", prepNote: "", nutritionalRole: "Vitamin C", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", [
      { allergenId: "other", customAllergenName: "Kiwi", severity: "confirmed_allergy" },
    ]);
    expect(result.patchedRecipe.completePlate.sides).toHaveLength(0);
  });

  it("skips 'other' entries with no customAllergenName (nothing to match)", () => {
    const recipe = makeRecipe([
      { name: "Kiwi slices", category: "fruit", servingSize: "3 slices", prepNote: "", nutritionalRole: "Vitamin C", allergenFree: true },
    ]);
    // No customAllergenName — guardrail should skip and leave the side intact
    const result = scanGeneratedOutput(recipe, "preschool", [
      { allergenId: "other", severity: "confirmed_allergy" },
    ]);
    expect(result.patchedRecipe.completePlate.sides).toHaveLength(1);
  });
});

// ── 7. Multiple allergens — each is independently enforced ───────────────────

describe("completePlate allergen enforcement — multiple active allergens", () => {
  const allergies = [
    { allergenId: "milk", severity: "confirmed_allergy" },
    { allergenId: "egg", severity: "confirmed_allergy" },
  ];

  it("removes sides matching either allergen", () => {
    const recipe = makeRecipe([
      { name: "Hard-boiled egg halves", category: "protein", servingSize: "½ egg", prepNote: "Halved", nutritionalRole: "Protein and iron", allergenFree: true },
      { name: "Cheddar cheese cubes", category: "dairy", servingSize: "3–4 small cubes", prepNote: "Diced small", nutritionalRole: "Calcium", allergenFree: true },
      { name: "Sliced strawberries", category: "fruit", servingSize: "3–4 slices", prepNote: "Hull and slice", nutritionalRole: "Vitamin C", allergenFree: true },
    ]);
    const result = scanGeneratedOutput(recipe, "preschool", allergies);
    const sides = result.patchedRecipe.completePlate.sides;
    expect(sides).toHaveLength(1);
    expect(sides[0].name).toBe("Sliced strawberries");
  });
});
