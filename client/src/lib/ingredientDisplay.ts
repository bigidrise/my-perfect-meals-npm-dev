import { convertServingDisplay, parseMeasurementNumber, type MeasurementSystem } from "@shared/units";
import { formatQuantity } from "./formatQuantity";

export type DisplayIngredient = string | {
  name?: string; item?: string; quantity?: string | number;
  amount?: string | number; unit?: string; displayText?: string;
};

const units: Record<string, [string, string]> = {
  cup: ["taza", "tazas"], cups: ["taza", "tazas"], taza: ["taza", "tazas"], tazas: ["taza", "tazas"],
  tbsp: ["cucharada", "cucharadas"], tablespoon: ["cucharada", "cucharadas"], tablespoons: ["cucharada", "cucharadas"],
  cucharada: ["cucharada", "cucharadas"], cucharadas: ["cucharada", "cucharadas"],
  tsp: ["cucharadita", "cucharaditas"], teaspoon: ["cucharadita", "cucharaditas"], teaspoons: ["cucharadita", "cucharaditas"],
  cucharadita: ["cucharadita", "cucharaditas"], cucharaditas: ["cucharadita", "cucharaditas"],
  oz: ["oz", "oz"], ounce: ["oz", "oz"], ounces: ["oz", "oz"], onza: ["oz", "oz"], onzas: ["oz", "oz"],
  lb: ["lb", "lb"], lbs: ["lb", "lb"], pound: ["lb", "lb"], pounds: ["lb", "lb"],
  g: ["g", "g"], gram: ["g", "g"], grams: ["g", "g"], gramo: ["g", "g"], gramos: ["g", "g"],
  kg: ["kg", "kg"], kilogram: ["kg", "kg"], kilograms: ["kg", "kg"],
  ml: ["mL", "mL"], milliliter: ["mL", "mL"], milliliters: ["mL", "mL"], mililitro: ["mL", "mL"], mililitros: ["mL", "mL"],
  l: ["L", "L"], liter: ["L", "L"], liters: ["L", "L"],
  "fl oz": ["fl oz", "fl oz"], "fl. oz": ["fl oz", "fl oz"],
  clove: ["diente", "dientes"], cloves: ["diente", "dientes"],
  slice: ["rebanada", "rebanadas"], slices: ["rebanada", "rebanadas"],
  serving: ["porción", "porciones"], servings: ["porción", "porciones"],
};
const countUnits = new Set(["each", "unit", "units", "unidad", "unidades", "piece", "pieces"]);
const canonicalUnits: Record<string, string> = {
  taza: "cup", tazas: "cup", cucharada: "tbsp", cucharadas: "tbsp",
  cucharadita: "tsp", cucharaditas: "tsp", onza: "oz", onzas: "oz",
  gramo: "g", gramos: "g", mililitro: "ml", mililitros: "ml",
};
const quantityPattern = "(?:\\d+\\s+)?\\d+\\s*\\/\\s*\\d+|\\d*\\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+(?:[.,]\\d+)?";
const unitPattern = [...Object.keys(units), ...countUnits].sort((a, b) => b.length - a.length)
  .map(unit => unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const ingredientPattern = new RegExp(`^\\s*(${quantityPattern})\\s+(${unitPattern})\\s+(?:de\\s+)?(.+)$`, "i");

/** Presentation only. Never feed this rounded/localized text into nutrition or persistence. */
export function ingredientQuantity(
  amount: string | number | null | undefined, unit: string | null | undefined,
  system: MeasurementSystem, language: string,
): string {
  if (amount == null || amount === "") return unit ?? "";
  const originalNumber = parseMeasurementNumber(amount);
  if (originalNumber === null || originalNumber < 0) return `${amount} ${unit ?? ""}`.trim();
  const sourceUnit = (unit ?? "").trim();
  const canonicalUnit = canonicalUnits[sourceUnit.toLowerCase()] ?? sourceUnit;
  // Reuse the established dimensional conversions; never infer ingredient density.
  const converted = convertServingDisplay(amount, canonicalUnit, system);
  const match = converted.match(new RegExp(`^(${quantityPattern})(?:\\s+(.*))?$`));
  if (!match) return converted;
  const number = parseMeasurementNumber(match[1]);
  if (number === null) return converted;
  const displayUnit = (match[2] ?? "").trim();
  const decimalUnits = new Set(["g", "kg", "ml", "l", "mg"]);
  const preserveDecimal = decimalUnits.has((match[2] ?? "").trim().toLowerCase());
  const pretty = (preserveDecimal || (number > 0 && number < 0.01)
    ? String(number)
    : formatQuantity(number, "")).replace(/(\\d)\\.(\\d)/g, language.startsWith("es") ? "$1,$2" : "$1.$2");
  if (countUnits.has(displayUnit.toLowerCase())) return pretty;
  if (!language.startsWith("es")) {
    const english: Record<string, [string, string]> = {
      cup: ["cup", "cups"], cups: ["cup", "cups"],
      tablespoon: ["tablespoon", "tablespoons"], tablespoons: ["tablespoon", "tablespoons"],
      teaspoon: ["teaspoon", "teaspoons"], teaspoons: ["teaspoon", "teaspoons"],
      clove: ["clove", "cloves"], cloves: ["clove", "cloves"],
      slice: ["slice", "slices"], slices: ["slice", "slices"],
      serving: ["serving", "servings"], servings: ["serving", "servings"],
    };
    const labels = english[displayUnit.toLowerCase()];
    return `${pretty} ${labels ? labels[number === 1 || (number > 0 && number < 1) ? 0 : 1] : displayUnit}`.trim();
  }
  const labels = units[displayUnit.toLowerCase()];
  if (!labels) return `${pretty} ${displayUnit}`.trim();
  const label = labels[number === 1 || (number > 0 && number < 1) ? 0 : 1];
  const fractionOf = /[¼¾⅓⅔⅛⅜⅝⅞]/.test(pretty) && number < 1 && labels[0] !== labels[1];
  return `${pretty} ${fractionOf ? "de " : ""}${label}`.trim();
}

export function ingredientLine(ingredient: DisplayIngredient, system: MeasurementSystem, language: string): string {
  if (typeof ingredient === "string") {
    const match = ingredient.match(ingredientPattern);
    if (!match) return ingredient;
    return ingredientLine({ quantity: match[1], unit: match[2], name: match[3] }, system, language);
  }
  const name = ingredient.name || ingredient.item || "";
  const amount = ingredient.quantity ?? ingredient.amount;
  // A historical displayText is a fallback, never authority over structured quantities.
  if (!name) return ingredient.displayText ? ingredientLine(ingredient.displayText, system, language) : "";
  if (amount == null || amount === "") {
    const match = ingredient.displayText?.match(ingredientPattern);
    return match
      ? ingredientLine({ name, quantity: match[1], unit: match[2] }, system, language)
      : ingredient.displayText || name;
  }
  if (!ingredient.unit && typeof amount === "string" && ingredientPattern.test(`${amount} ${name}`)) {
    return ingredientLine(`${amount} ${name}`, system, language);
  }
  const quantity = ingredientQuantity(amount, ingredient.unit, system, language);
  const sourceNumber = parseMeasurementNumber(amount);
  const known = !!units[(ingredient.unit ?? "").toLowerCase().trim()];
  return `${quantity}${name ? `${language.startsWith("es") && known && sourceNumber !== null ? " de " : " "}${name}` : ""}`.trim();
}
