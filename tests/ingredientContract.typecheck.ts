import type {
  Ingredient,
  LegacyIngredient,
  IngredientCanonicalV1,
  IngredientCanonicalUnit,
  IngredientResolution,
  IngredientNutritionEvidence,
} from "../shared/types";

const existing: Ingredient = {
  name: "large eggs",
  amount: "2",
  unit: "each",
};

const legacy: LegacyIngredient = {
  item: "egg whites",
  quantity: "1/2",
  unit: "cup",
};

const unknown = {
  status: "unresolved",
  value: null,
  reasonCode: "NOT_ESTABLISHED",
} as const;

const canonical: IngredientCanonicalV1 = {
  version: 1,
  originalInput: {
    text: null,
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
  nutritionEvidence: null,
  presentation: {
    labelsByLanguageTag: {
      en: "egg whites",
      es: "claras de huevo",
      fr: "blancs d'oeufs",
      de: "Eiweiss",
    },
  },
};

const enriched: Ingredient = { ...existing, canonical };
const enrichedLegacy: LegacyIngredient = { ...legacy, canonical };

const nutrition: IngredientNutritionEvidence = {
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
};

// @ts-expect-error Unsupported metadata version.
const badVersion: IngredientCanonicalV1 = { ...canonical, version: 2 };

// @ts-expect-error Resolved string cannot be null.
const badResolution: IngredientResolution<string> = { status: "resolved", value: null };

// @ts-expect-error Unresolved facts require a reason code.
const missingReason: IngredientResolution<string> = { status: "unresolved", value: null };

// @ts-expect-error Ambiguous facts cannot carry resolved values.
const badAmbiguity: IngredientResolution<string> = { status: "ambiguous", value: "egg", reasonCode: "AMBIGUOUS" };

// @ts-expect-error Mass dimension cannot use a volume unit.
const badUnit: IngredientCanonicalUnit = { dimension: "mass", code: "cup" };

// @ts-expect-error Required metadata groups cannot be omitted.
const incomplete: IngredientCanonicalV1 = { version: 1 };

void [
  existing, legacy, enriched, enrichedLegacy, nutrition,
  badVersion, badResolution, missingReason,
  badAmbiguity, badUnit, incomplete,
];
