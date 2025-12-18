// =====================================================================
// TECHNIQUE CATALOG — COOKING METHODS SOURCE OF TRUTH
// Deterministic, typed, production-ready
// =====================================================================

export type CookingMethodId =
  | "air-fried"
  | "baked"
  | "boiled"
  | "fried"
  | "grilled"
  | "pan-seared"
  | "poached"
  | "scrambled"
  | "steamed"
  | "stir-fried"
  | "well-done"
  | "medium"
  | "medium-rare";

export interface Technique {
  id: CookingMethodId;
  name: string;
  applicableCategories: string[];
  cookingProfile: {
    methodType: "dry" | "moist" | "fat-added";
    defaultFatAddedGrams: number;
    heatLevel: "low" | "medium" | "high";
    timeMinutesMin: number;
    timeMinutesMax: number;
  };
  keywords: string[];
}

export const TECHNIQUES: Technique[] = [
  {
    id: "air-fried",
    name: "Air-Fried",
    applicableCategories: ["protein", "starchy-carb", "fibrous-carb"],
    cookingProfile: {
      methodType: "dry",
      defaultFatAddedGrams: 2,
      heatLevel: "high",
      timeMinutesMin: 10,
      timeMinutesMax: 25,
    },
    keywords: ["air fryer", "crispy", "air fry", "air-fry"],
  },
  {
    id: "baked",
    name: "Baked",
    applicableCategories: ["protein", "starchy-carb", "fibrous-carb", "egg"],
    cookingProfile: {
      methodType: "dry",
      defaultFatAddedGrams: 5,
      heatLevel: "medium",
      timeMinutesMin: 15,
      timeMinutesMax: 60,
    },
    keywords: ["oven", "bake", "roast", "roasted"],
  },
  {
    id: "boiled",
    name: "Boiled",
    applicableCategories: ["protein", "starchy-carb", "egg", "legume"],
    cookingProfile: {
      methodType: "moist",
      defaultFatAddedGrams: 0,
      heatLevel: "high",
      timeMinutesMin: 5,
      timeMinutesMax: 30,
    },
    keywords: ["boil", "simmer", "water"],
  },
  {
    id: "fried",
    name: "Fried",
    applicableCategories: ["protein", "egg", "starchy-carb"],
    cookingProfile: {
      methodType: "fat-added",
      defaultFatAddedGrams: 15,
      heatLevel: "high",
      timeMinutesMin: 3,
      timeMinutesMax: 15,
    },
    keywords: ["fry", "pan fry", "sauté", "saute"],
  },
  {
    id: "grilled",
    name: "Grilled",
    applicableCategories: ["protein", "seafood", "fibrous-carb"],
    cookingProfile: {
      methodType: "dry",
      defaultFatAddedGrams: 3,
      heatLevel: "high",
      timeMinutesMin: 5,
      timeMinutesMax: 20,
    },
    keywords: ["grill", "charred", "BBQ", "barbecue"],
  },
  {
    id: "pan-seared",
    name: "Pan-Seared",
    applicableCategories: ["protein", "seafood"],
    cookingProfile: {
      methodType: "fat-added",
      defaultFatAddedGrams: 8,
      heatLevel: "high",
      timeMinutesMin: 3,
      timeMinutesMax: 12,
    },
    keywords: ["sear", "pan sear", "crispy", "golden"],
  },
  {
    id: "poached",
    name: "Poached",
    applicableCategories: ["protein", "egg", "seafood"],
    cookingProfile: {
      methodType: "moist",
      defaultFatAddedGrams: 0,
      heatLevel: "low",
      timeMinutesMin: 3,
      timeMinutesMax: 15,
    },
    keywords: ["poach", "gentle", "water bath"],
  },
  {
    id: "scrambled",
    name: "Scrambled",
    applicableCategories: ["egg"],
    cookingProfile: {
      methodType: "fat-added",
      defaultFatAddedGrams: 5,
      heatLevel: "medium",
      timeMinutesMin: 2,
      timeMinutesMax: 5,
    },
    keywords: ["scramble", "whisk", "stir", "curds"],
  },
  {
    id: "steamed",
    name: "Steamed",
    applicableCategories: ["protein", "fibrous-carb", "starchy-carb", "seafood"],
    cookingProfile: {
      methodType: "moist",
      defaultFatAddedGrams: 0,
      heatLevel: "medium",
      timeMinutesMin: 5,
      timeMinutesMax: 20,
    },
    keywords: ["steam", "steamer", "gentle heat"],
  },
  {
    id: "well-done",
    name: "Well-Done",
    applicableCategories: ["protein"],
    cookingProfile: {
      methodType: "dry",
      defaultFatAddedGrams: 0,
      heatLevel: "high",
      timeMinutesMin: 10,
      timeMinutesMax: 20,
    },
    keywords: ["well done", "fully cooked", "no pink"],
  },
  {
    id: "medium",
    name: "Medium",
    applicableCategories: ["protein", "seafood"],
    cookingProfile: {
      methodType: "dry",
      defaultFatAddedGrams: 0,
      heatLevel: "medium",
      timeMinutesMin: 6,
      timeMinutesMax: 12,
    },
    keywords: ["medium", "pink center", "warm center"],
  },
  {
    id: "medium-rare",
    name: "Medium-Rare",
    applicableCategories: ["protein", "seafood"],
    cookingProfile: {
      methodType: "dry",
      defaultFatAddedGrams: 0,
      heatLevel: "medium",
      timeMinutesMin: 4,
      timeMinutesMax: 8,
    },
    keywords: ["medium rare", "red center", "warm red"],
  },
  {
    id: "stir-fried",
    name: "Stir-Fried",
    applicableCategories: ["protein", "fibrous-carb", "starchy-carb"],
    cookingProfile: {
      methodType: "fat-added",
      defaultFatAddedGrams: 8,
      heatLevel: "high",
      timeMinutesMin: 3,
      timeMinutesMax: 10,
    },
    keywords: ["stir fry", "wok", "asian", "quick fry"],
  },
];

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

export function getTechniqueById(id: CookingMethodId): Technique | undefined {
  return TECHNIQUES.find((t) => t.id === id);
}

export function getTechniquesByCategory(category: string): Technique[] {
  return TECHNIQUES.filter((t) => t.applicableCategories.includes(category));
}

export function isValidTechniqueForCategory(
  techniqueId: CookingMethodId,
  category: string
): boolean {
  const technique = getTechniqueById(techniqueId);
  return technique?.applicableCategories.includes(category) ?? false;
}

export function getTechniqueKeywords(id: CookingMethodId): string[] {
  return getTechniqueById(id)?.keywords ?? [];
}
