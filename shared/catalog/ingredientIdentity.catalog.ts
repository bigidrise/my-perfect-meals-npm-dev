// Canonical ingredient identity aliases.
// Identity only: never nutrition evidence or clinical authorization.
// Existing catalog identifiers are retained where appropriate.

export const INGREDIENT_IDENTITY_REGISTRY = "mpm-ingredient-identity";
export const INGREDIENT_IDENTITY_VERSION = "1";

export interface IngredientIdentityEntry {
  ingredientKey: string;
  aliasesByLanguage: Readonly<Record<string, readonly string[]>>;
}

export const INGREDIENT_IDENTITY_ENTRIES: readonly IngredientIdentityEntry[] = [
  {
    ingredientKey: "eggs",
    aliasesByLanguage: {
      en: ["egg", "eggs", "whole egg", "whole eggs"],
      es: ["huevo", "huevos", "huevo entero", "huevos enteros"],
    },
  },
  {
    ingredientKey: "egg_whites",
    aliasesByLanguage: {
      en: ["egg white", "egg whites"],
      es: ["clara de huevo", "claras de huevo"],
    },
  },
  {
    ingredientKey: "egg_yolks",
    aliasesByLanguage: {
      en: ["egg yolk", "egg yolks"],
      es: ["yema de huevo", "yemas de huevo"],
    },
  },
  {
    ingredientKey: "cheddar_cheese",
    aliasesByLanguage: {
      en: ["cheddar", "cheddar cheese"],
      es: ["queso cheddar", "cheddar"],
    },
  },
  {
    ingredientKey: "potatoes",
    aliasesByLanguage: {
      en: ["potato", "potatoes"],
      es: ["papa", "papas", "patata", "patatas"],
    },
  },
  {
    ingredientKey: "chicken_breast",
    aliasesByLanguage: {
      en: ["chicken breast", "chicken breasts"],
      es: ["pechuga de pollo", "pechugas de pollo"],
    },
  },
  {
    ingredientKey: "greek_yogurt",
    aliasesByLanguage: {
      en: ["Greek yogurt", "Greek yoghurt"],
      es: ["yogur griego", "yogurt griego"],
    },
  },
  {
    ingredientKey: "cottage_cheese",
    aliasesByLanguage: {
      en: ["cottage cheese"],
      es: ["queso cottage"],
    },
  },
];
