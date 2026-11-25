import { parseMeasurementNumber } from "./units";

/** Literal measurement aliases only. This is not safety or nutrition clearance. */
export function ingredientMeasurementName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\bclaras? de huevo\b/g, "egg whites")
    .replace(/\byemas? de huevo\b/g, "egg yolks")
    .replace(/\bhuevos?\b/g, "eggs")
    .replace(/\b(grandes?|grande)\b/g, "large")
    .replace(/\bmedianos?\b/g, "medium")
    .replace(/\bpequenos?\b/g, "small")
    .replace(/\b(liquidas?|liquidos?)\b/g, "liquid")
    .replace(/\ben polvo\b/g, "powdered")
    .replace(/\b(sustituto|reemplazo) de\b/g, "substitute")
    .trim();
}

export function ingredientMeasurementUnit(value: string): string {
  const unit = value.toLowerCase().trim();
  const aliases: Record<string, string> = {
    grams: "g", gram: "g", gramo: "g", gramos: "g",
    ounces: "oz", ounce: "oz", onza: "oz", onzas: "oz",
    pounds: "lb", pound: "lb", lbs: "lb",
    cups: "cup", taza: "cup", tazas: "cup",
    tablespoons: "tbsp", tablespoon: "tbsp", cucharada: "tbsp", cucharadas: "tbsp",
    teaspoons: "tsp", teaspoon: "tsp", cucharadita: "tsp", cucharaditas: "tsp",
    milliliters: "ml", milliliter: "ml", mililitro: "ml", mililitros: "ml",
    unidad: "each", unidades: "each",
  };
  return aliases[unit] ?? unit;
}

export function freshEggPart(name: string): "whole" | "white" | "yolk" | null {
  const text = ingredientMeasurementName(name);
  if (!/\beggs?\b/.test(text) ||
      /\b(noodles?|eggplant|powder|powdered|dried|substitute|replacer|mix)\b/.test(text)) return null;
  return /\bwhites?\b/.test(text) ? "white" : /\byolks?\b/.test(text) ? "yolk" : "whole";
}

export const EGG_COUNT_UNITS = new Set([
  "egg", "eggs", "whole", "large", "medium", "small", "jumbo", "extra-large",
  "each", "count", "piece", "pieces", "white", "whites", "yolk", "yolks",
]);

export function hasEggSize(name: string, unit = ""): boolean {
  return /\b(large|medium|small|jumbo|extra[- ]large|xl)\b/.test(ingredientMeasurementName(name)) ||
    /^(large|medium|small|jumbo|extra-large|xl)$/.test(ingredientMeasurementUnit(unit));
}

/** Approximate fresh edible portion, for the existing plausibility/sanity gates only. */
export function approximateEggGrams(name: string, quantity: string, rawUnit: string): number | null {
  const part = freshEggPart(name);
  const amount = parseMeasurementNumber(quantity);
  if (!part || amount === null || amount <= 0) return null;
  const unit = ingredientMeasurementUnit(rawUnit);
  if (EGG_COUNT_UNITS.has(unit)) {
    const text = `${ingredientMeasurementName(name)} ${unit}`;
    const large = part === "white" ? 33 : part === "yolk" ? 17 : 50;
    const scale = /\bjumbo\b/.test(text) ? 63 / 50
      : /\b(extra[- ]large|xl)\b/.test(text) ? 56 / 50
      : /\bmedium\b/.test(text) ? 44 / 50 : /\bsmall\b/.test(text) ? 38 / 50 : 1;
    return amount * large * scale;
  }
  const grams: Record<string, number> = {
    g: 1, kg: 1000, oz: 28.3495, lb: 453.592,
    ml: 1, cup: 240, tbsp: 15, tsp: 5, "fl oz": 29.5735,
  };
  return Object.prototype.hasOwnProperty.call(grams, unit) ? amount * grams[unit] : null;
}
