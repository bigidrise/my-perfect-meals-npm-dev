import type { HiddenViolation } from "../allergyGuardrails";
import type { UserProtocolEnvelope } from "../protocolEnvelope";
import { validatePregnancyMealSafety } from "../guardrails/validators/pregnancySupportValidator";
import { validateThyroidSupportMeal } from "../guardrails/validators/thyroidSupportValidator";
import { maskNutButters, maskPlantMilks } from "../allergyGuardrails";
import { structuredIngredientText } from "@shared/semanticDietaryIngredients";

type GeneratedFood = {
  name?: string;
  description?: string;
  ingredients?: Array<{ name?: string; item?: string } | string>;
  instructions?: string | string[];
};

const MAMMALIAN_FOOD = /\b(beef|pork|lamb|mutton|veal|goat|venison|rabbit|bison|buffalo|elk|moose|boar|oxtail|lard|tallow|suet|bacon|ham|prosciutto|salami|pepperoni|beef\s+(broth|stock|fat)|pork\s+(broth|stock|fat)|bone\s+broth|meat\s+gravy)\b/i;
const GELATIN_FOOD = /\b(gelatin|gelatine|mammalian\s+collagen)\b/i;
const DAIRY_FOOD = /\b(milk|cheese|butter|cream|yogurt|yoghurt|ghee|whey)\b/i;

/** Deterministic hard stops shared by routes that already call scanGeneratedOutput.
 * These checks supplement prompts; an absent ingredient list cannot prove that a
 * food is free of an active clinical allergy or pregnancy food-safety risk. */
export function scanClinicalFoodSafety(
  food: GeneratedFood,
  envelope: UserProtocolEnvelope,
): HiddenViolation[] {
  const violations: HiddenViolation[] = [];
  const ingredients = food.ingredients ?? [];
  const ingredientText = structuredIngredientText(ingredients).toLowerCase();
  const alpha = envelope.alphaGalContext;

  if (alpha?.active) {
    if (!ingredients.length || !ingredientText.trim()) {
      violations.push({
        term: "ingredient evidence",
        category: "alpha-gal",
        reason: "Ingredient details are required to verify this food against the active Alpha-gal allergy.",
      });
    } else {
      if (MAMMALIAN_FOOD.test(ingredientText)) {
        violations.push({ term: "mammalian meat or derivative", category: "alpha-gal", reason: "Mammalian meat and derivatives are prohibited for Alpha-gal." });
      }
      if (alpha.gelatinRestriction !== "no" && GELATIN_FOOD.test(ingredientText)) {
        violations.push({ term: "gelatin", category: "alpha-gal", reason: "Gelatin is excluded by the active Alpha-gal profile." });
      }
      if (alpha.dairyTolerance === "no" && DAIRY_FOOD.test(maskNutButters(maskPlantMilks(ingredientText)))) {
        violations.push({ term: "mammalian dairy", category: "alpha-gal", reason: "Dairy is excluded by the active Alpha-gal profile." });
      }
    }
  }

  const pregnancy = envelope.pregnancySupportContext;
  if (pregnancy?.active && pregnancy.stage.startsWith("trimester-")) {
    if (!ingredients.length || !ingredientText.trim()) {
      violations.push({
        term: "ingredient evidence",
        category: "pregnancy",
        reason: "Ingredient details are required to verify pregnancy food safety.",
      });
    } else {
      const result = validatePregnancyMealSafety({
        name: food.name ?? "",
        description: food.description,
        ingredients,
        instructions: food.instructions,
      });
      for (const reason of result.violations) {
        violations.push({ term: "pregnancy food safety", category: "pregnancy", reason });
      }
    }
  }

  if (envelope.thyroidSupport) {
    const result = validateThyroidSupportMeal({
      name: food.name,
      description: food.description,
      ingredients: ingredients.map((value) => typeof value === "string" ? { name: value } : value),
      instructions: food.instructions,
    });
    if (result.requiresRegen) {
      for (const reason of result.violations.filter((value) => !value.startsWith("Advisory"))) {
        violations.push({ term: "thyroid hard stop", category: "thyroid", reason });
      }
    }
  }

  return violations;
}