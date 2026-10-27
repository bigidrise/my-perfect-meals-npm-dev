import { dessertQuantity } from "./dessertNutrition";

export interface GatheringsIngredient {
  name: string;
  amount?: number;
  unit?: string;
  displayText: string;
  originalText: string;
  parseIssue?: string;
}

/** Retain original food identity for safety scanning even when measurement fails. */
export function parseGatheringsIngredient(line: string): GatheringsIngredient {
  const text = line.replace(/^\s*[-•]\s*/, "").trim();
  const unknown = (): GatheringsIngredient => ({
    name: text, displayText: text, originalText: text, parseIssue: "quantity_or_unit_unresolved",
  });
  const match = /^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])\s+(.+)$/.exec(text);
  if (!match) return unknown();
  const amount = dessertQuantity(match[1].trim());
  if (amount === null) return unknown();
  const rest = match[2];
  const measured = /^(fl\s*oz|fluid ounces?|g|grams?|kg|kilograms?|mg|milligrams?|oz|ounces?|lbs?|pounds?|cups?|tbsp|tablespoons?|tsp|teaspoons?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?)\s+(.+)$/i.exec(rest);
  if (measured) {
    const unit = measured[1].toLowerCase()
      .replace(/^fluid ounces?$|^fl\s*oz$/, "fl oz")
      .replace(/^lbs?$|^pounds?$/, "lb").replace(/^milligrams?$/, "mg");
    return { name: measured[2], amount, unit, displayText: text, originalText: text };
  }
  // Counts require explicit size; never guess a medium apple or a large egg.
  const egg = /^(large|medium|small|extra large|jumbo)\s+(eggs?|egg whites?)$/i.exec(rest);
  if (egg) return {
    name: `${egg[1].toLowerCase()} ${egg[2].toLowerCase()}`, amount,
    unit: egg[1].toLowerCase(), displayText: text, originalText: text,
  };
  return unknown();
}
