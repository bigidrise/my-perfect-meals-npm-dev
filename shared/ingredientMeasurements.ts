import { parseMeasurementNumber } from "./units";
import { ingredientMeasurementUnit } from "./ingredientMeasurementUnits";
export { ingredientMeasurementUnit } from "./ingredientMeasurementUnits";


/** Literal measurement aliases only. This is not safety or nutrition clearance. */
export function ingredientMeasurementName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\bclaras? de huevo\b/g, "egg whites")
    .replace(/\byemas? de huevo\b/g, "egg yolks")
    .replace(/\bhuevos?\b/g, "eggs")
    .replace(/\b(grandes?|grande)\b/g, "large")
    .replace(/\bmedian[oa]s?\b/g, "medium")
    .replace(/\bpequen[oa]s?\b/g, "small")
    .replace(/\b(liquidas?|liquidos?)\b/g, "liquid")
    .replace(/\ben polvo\b/g, "powdered")
    .replace(/\b(sustituto|reemplazo) de\b/g, "substitute")
    .trim();
}

export function freshEggPart(name: string): "whole" | "white" | "yolk" | null {
  const text = ingredientMeasurementName(name);
  if (!/\beggs?\b/.test(text) ||
      /\b(noodles?|eggplant|powder|powdered|dried|substitute|replacer|mix)\b/.test(text)) return null;
  return /\bwhites?\b/.test(text) ? "white" : /\byolks?\b/.test(text) ? "yolk" : "whole";
}

export const EGG_COUNT_UNITS = new Set([
  "egg", "eggs", "whole", "large", "medium", "small", "jumbo", "extra-large", "xl",
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


// Shared supplement identification for measurement handling only.
const PROTEIN_POWDER_PATTERN = /\b(protein\s+powder|whey\s+protein|casein\s+protein|plant[- ]based\s+protein|vegan\s+protein|pea\s+protein|soy\s+protein|rice\s+protein|collagen\s+powder|collagen\s+peptides|pre[- ]workout|creatine|bcaa|mass\s+gainer|weight\s+gainer|supplement\s+powder|protein\s+shake\s+powder|prote[ií]na\s+en\s+polvo|prote[ií]na\s+de\s+suero|creatina|pre[- ]?entrenamiento|col[aá]geno\s+en\s+polvo|p[eé]ptidos\s+de\s+col[aá]geno|suplemento\s+en\s+polvo)\b/i;

export function isProteinPowder(name: string): boolean {
  return PROTEIN_POWDER_PATTERN.test(name);
}
