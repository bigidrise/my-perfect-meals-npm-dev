import { ingredientQuantity, type DisplayIngredient } from "./ingredientDisplay";
import { parseMeasurementNumber, type MeasurementSystem } from "@shared/units";

/**
 * Display-only conversion of quantities inside cooking instructions.
 * Uses recipe ingredient data to avoid guessing what a measurement describes.
 * Never modifies the stored instruction or recipe.
 */
export function formatCookingInstruction(
  instruction: string,
  ingredients: readonly DisplayIngredient[] | null | undefined,
  system: MeasurementSystem,
  language: string,
): string {
  if (!instruction || !Array.isArray(ingredients) || ingredients.length === 0) {
    return instruction;
  }

  const entries = ingredients.flatMap(ingredient => {
    if (typeof ingredient === "string") {
      const parsed = ingredient.trim().match(
        /^(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞])\s+(tbsp|tablespoons?|tsp|teaspoons?|cups?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|milliliters?|l|liters?|tazas?|cucharadas?|cucharaditas?|onzas?|gramos?|mililitros?)\b\s+(?:of\s+|de\s+)?(.+)$/i
      );
      if (!parsed) return [];
      return [{ amount: parsed[1], unit: parsed[2], name: parsed[3] }];
    }

    const name = (ingredient.name || ingredient.item || "").trim();
    const amount = ingredient.quantity === "" || ingredient.quantity == null
      ? ingredient.amount
      : ingredient.quantity;
    const unit = (ingredient.unit || "").trim();

    if (!name || amount == null || !unit || parseMeasurementNumber(amount) === null) {
      return [];
    }

    return [{ name, amount, unit }];
  });

  if (!entries.length) return instruction;

  const isSpanish = language.startsWith("es");
  const number = String.raw`(?:\d+\s+)?\d+\s*\/\s*\d+|\d*\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?`;
  const unit = String.raw`tbsp|tablespoons?|tsp|teaspoons?|cups?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|milliliters?|l|liters?|tazas?|cucharadas?|cucharaditas?|onzas?|gramos?|mililitros?`;
  const pattern = new RegExp(String.raw`(?<![\w\d])(${number})\s+(${unit})\b`, "gi");

  return instruction.replace(pattern, (match, amount: string, sourceUnit: string, offset: number, text: string) => {
    const normalized = (value: string) => value.toLowerCase().trim();
    const unitAliases: Record<string, string> = {
      cup: "cup", cups: "cup", taza: "cup", tazas: "cup",
      tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", cucharada: "tbsp", cucharadas: "tbsp",
      tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp", cucharadita: "tsp", cucharaditas: "tsp",
      oz: "oz", ounce: "oz", ounces: "oz", onza: "oz", onzas: "oz",
      lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
      g: "g", gram: "g", grams: "g", gramo: "g", gramos: "g",
      kg: "kg", ml: "ml", milliliter: "ml", milliliters: "ml",
      mililitro: "ml", mililitros: "ml", l: "l", liter: "l", liters: "l",
    };

    const canonicalUnit = unitAliases[normalized(sourceUnit)];
    const quantity = parseMeasurementNumber(amount);
    if (!canonicalUnit || quantity === null) return match;

    const following = text.slice(offset + match.length)
      .replace(/^\s+(?:of|de)\s+/i, "")
      .trimStart()
      .toLowerCase();

    const matching = entries.filter(entry => {
      const entryUnit = unitAliases[normalized(entry.unit)] || normalized(entry.unit);
      const entryQuantity = parseMeasurementNumber(entry.amount);
      return entryUnit === canonicalUnit
        && entryQuantity !== null
        && Math.abs(entryQuantity - quantity) < 0.00001
        && following.startsWith(normalized(entry.name));
    });

    if (matching.length !== 1) return match;

    const ingredientName = matching[0].name;
    const liquid = /\b(water|milk|broth|stock|juice|oil|vinegar|wine|cream|syrup|agua|leche|caldo|jugo|zumo|aceite|vinagre|vino|crema|jarabe)\b/i.test(ingredientName);
    const practicalSystem = system === "metric" && !liquid && ["cup", "tbsp", "tsp"].includes(canonicalUnit)
      ? "imperial"
      : system;

    const converted = ingredientQuantity(amount, canonicalUnit, practicalSystem, language);
    return converted || match;
  });
}
