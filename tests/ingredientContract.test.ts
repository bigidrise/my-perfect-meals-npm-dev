import {
  US_SOLID_UNITS,
  US_LIQUID_UNITS,
} from "../shared/types";

import type {
  Ingredient,
  LegacyIngredient,
  IngredientCanonicalV1,
} from "../shared/types";

const unknown = {
  status: "unresolved",
  value: null,
  reasonCode: "NOT_ESTABLISHED",
} as const;

const canonical: IngredientCanonicalV1 = {
  version: 1,
  originalInput: {
    text: "1/2 cup egg whites",
    name: "egg whites",
    amount: "1/2",
    unit: "cup",
    preparationNote: null,
    languageTag: "en",
  },
  identity: unknown,
  foodForm: {
    cookingState: unknown,
    preservation: unknown,
    drainingState: unknown,
    physicalForm: unknown,
    eggPart: { status: "resolved", value: "white" },
    eggSize: unknown,
  },
  compositionQualifiers: {
    fatLevel: unknown,
    sourceSpecies: unknown,
    productFormulation: unknown,
    productRef: null,
    evidenceRefs: [],
  },
  quantity: {
    status: "resolved",
    value: { value: 0.5, originalExpression: "1/2" },
  },
  canonicalUnit: {
    status: "resolved",
    value: { dimension: "volume", code: "cup" },
  },
  quantityScope: "unknown",
  conversionEvidence: null,
  nutritionEvidence: {
    basis: "per_100g",
    nutrients: {
      caloriesKcal: null,
      proteinG: null,
      carbsG: null,
      fatG: 0,
      dietaryFiberG: null,
      sodiumMg: null,
      starchyCarbsG: null,
      fibrousCarbsG: null,
    },
    evidenceRefs: [],
    assurance: "estimate",
    completeness: "partial",
  },
  presentation: {
    labelsByLanguageTag: {
      en: "egg whites",
      es: "claras de huevo",
    },
  },
};

describe("Shared canonical ingredient contract", () => {
  test("preserves existing measurement constants", () => {
    expect(US_SOLID_UNITS).toEqual([
      "oz", "lb", "cup", "tbsp", "tsp", "each",
    ]);
    expect(US_LIQUID_UNITS).toEqual([
      "cup", "tbsp", "tsp", "fl oz",
    ]);
  });

  test("preserves existing ingredient records without enrichment", () => {
    const ingredient: Ingredient = {
      name: "large eggs",
      amount: "2",
      unit: "each",
    };

    const restored = JSON.parse(JSON.stringify(ingredient));
    expect(restored).toEqual(ingredient);
    expect(restored).not.toHaveProperty("canonical");
  });

  test("preserves legacy ingredient records unchanged", () => {
    const legacy: LegacyIngredient = {
      item: "egg whites",
      quantity: "1/2",
      unit: "cup",
    };

    const restored = JSON.parse(JSON.stringify(legacy));
    expect(restored).toEqual(legacy);
    expect(restored).not.toHaveProperty("canonical");
  });

  test("preserves unknown nutrients separately from explicit zero", () => {
    const restored = JSON.parse(JSON.stringify(canonical));
    expect(restored.nutritionEvidence.nutrients.proteinG).toBeNull();
    expect(restored.nutritionEvidence.nutrients.fatG).toBe(0);
    expect(restored.nutritionEvidence.assurance).toBe("estimate");
  });

  test("preserves original input and unresolved evidence", () => {
    const restored = JSON.parse(JSON.stringify(canonical));
    expect(restored).toEqual(canonical);
    expect(restored.version).toBe(1);
    expect(restored.originalInput.amount).toBe("1/2");
    expect(restored.foodForm.eggSize.value).toBeNull();
    expect(restored.conversionEvidence).toBeNull();
    expect(restored.identity.status).toBe("unresolved");
  });

  test("presentation changes do not alter canonical facts", () => {
    const english = {
      ...canonical,
      presentation: {
        labelsByLanguageTag: { en: "egg whites" },
      },
    };

    const spanish = {
      ...canonical,
      presentation: {
        labelsByLanguageTag: { es: "claras de huevo" },
      },
    };

    const { presentation: enLabels, ...enFacts } = english;
    const { presentation: esLabels, ...esFacts } = spanish;

    expect(enLabels).not.toEqual(esLabels);
    expect(enFacts).toEqual(esFacts);
  });

  test("enriched legacy records retain optional metadata", () => {
    const legacy: LegacyIngredient = {
      item: "egg whites",
      quantity: "1/2",
      unit: "cup",
      canonical,
    };

    expect(JSON.parse(JSON.stringify(legacy))).toEqual(legacy);
  });
});
