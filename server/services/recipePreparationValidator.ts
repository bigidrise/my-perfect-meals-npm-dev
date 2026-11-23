/**
 * Recipe Preparation Validator
 *
 * Checks that ingredient forms and cooking instructions agree.
 * Read-only: does not modify recipes, macros, or clinical guardrails.
 */

export interface PreparationIngredient {
  name: string;
  amount?: string | number;
  quantity?: string | number;
  unit?: string;
  notes?: string;
}

export interface PreparationRecipe {
  ingredients?: readonly unknown[];
  instructions?: unknown;
}

export interface PreparationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/** Shared prompt guidance, not an additional model call or nutrition formula. */
export const RECIPE_PREPARATION_GUIDANCE =
  "RECIPE PREPARATION CONSISTENCY: State the ingredient form when it affects cooking " +
  "(dried/uncooked versus canned/cooked/precooked; fresh/frozen/raw as relevant). " +
  "For dried pulses and uncooked rice, include their own cooking method, liquid and time. " +
  "Keep quantities and nutrition tied to the listed form; never silently relabel dried " +
  "amounts as cooked amounts. Do not rely on another ingredient's cooking steps. " +
  "Use the requested recipe language, including English or Spanish.";

const normalize = (value: unknown): string => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const families = [
  { key: "lentils", words: /\b(?:lentils?|lentejas?)\b/, noun: "(?:lentils?|lentejas?)" },
  { key: "beans", words: /\b(?:beans?|chickpeas?|garbanzos?|frijoles?|alubias?|judias?|habichuelas?)\b/,
    noun: "(?:beans?|chickpeas?|garbanzos?|frijoles?|alubias?|judias?|habichuelas?)" },
  { key: "rice", words: /\b(?:rice|arroz)\b/, noun: "(?:rice|arroz)" },
] as const;
const dry = /\b(?:dry|dried|uncooked|raw|sec[oa]s?|crud[oa]s?|sin cocer)\b/;
const ready = /\b(?:canned|cooked|pre[- ]?cooked|ready[- ]to[- ]eat|enlatad[oa]s?|cocid[oa]s?|precocid[oa]s?|de lata|en conserva)\b/;
const fresh = /\b(?:fresh|fresc[oa]s?)\b/;
const frozen = /\b(?:frozen|congelad[oa]s?)\b/;
const cooking = /\b(?:simmer|boil|cook|pressure[- ]cook|bake|steam|cocinar|cocina|cocine[n]?|hervir|hierv[ae][n]?|cuece|cueza|cocer|hornear|hornea|al vapor)\b/;
const liquid = /\b(?:water|broth|stock|liquid|agua|caldo|liquido)\b/;
const duration = /\b\d+(?:\s*[-–]\s*\d+)?\s*(?:minutes?|mins?|hours?|hrs?|minutos?|horas?)\b/;
const readyState = "(?:canned|cooked|pre[- ]?cooked|enlatad[oa]s?|cocid[oa]s?|precocid[oa]s?|de lata)";
const quantityPattern = "(\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+|\\/\\d+)?)\\s*(cups?|tazas?|oz|g|grams?|gramos?|tbsp|tsp)\\b";
const quantityValue = (text: string): number => text.trim().split(/\s+/).reduce((total, part) => {
  const [numerator, denominator] = part.split("/").map(Number);
  return total + (denominator ? numerator / denominator : numerator);
}, 0);
const quantityUnit = (text: string): string => text.replace(/s$/, "")
  .replace(/^taza$/, "cup").replace(/^gramo?$/, "g");

function ingredientText(ingredient: unknown): string {
  if (typeof ingredient === "string") return ingredient;
  if (!ingredient || typeof ingredient !== "object") return "";
  const row = ingredient as Record<string, unknown>;
  const universal = row._universal && typeof row._universal === "object"
    ? row._universal as Record<string, unknown> : {};
  return [row.name ?? row.item, row.amount, row.quantity, row.unit, row.notes, row.preparationNote,
    universal.name, universal.quantity, universal.unit, universal.notes]
    .filter(value => typeof value === "string" || typeof value === "number").join(" ");
}

function ingredientAnchors(ingredient: unknown): string[] {
  const row = ingredient && typeof ingredient === "object" ? ingredient as Record<string, unknown> : {};
  const name = normalize(row.name ?? row.item ?? ingredientText(ingredient));
  return (name.match(/[a-z]{4,}/g) ?? []).filter(word =>
    !/^(?:water|broth|stock|liquid|agua|caldo|salt|pepper|dried|cooked|canned|fresh|frozen|uncooked|precooked|drained|chopped|diced|cups?|tazas?|grams?|gramos?|tablespoons?|teaspoons?)$/.test(word) &&
    !/^(?:sec[oa]s?|cocid[oa]s?|enlatad[oa]s?|congelad[oa]s?|fresc[oa]s?|escurrid[oa]s?)$/.test(word),
  ).map(word => word.replace(/s$/, ""));
}

function stapleFamily(text: string) {
  // These are vegetables, drinks, flours or prepared products, not dry staples.
  if (/\b(?:green beans?|string beans?|wax beans?|bean sprouts?|judias verdes|ejotes|vainitas|habichuelas verdes|harina|flour|rice milk|rice noodles?|rice paper|arroz inflado|puffed rice|rice cakes?|rice vinegar|rice syrup|rice protein)\b/.test(text)) return undefined;
  return families.find(family => family.words.test(text));
}

function localInstructions(steps: string[], family: typeof families[number], ingredients: unknown[]): string {
  const otherFood = ingredients.filter(ingredient => !family.words.test(normalize(ingredientText(ingredient))))
    .flatMap(ingredientAnchors);
  const result = new Set<string>();
  for (let index = 0; index < steps.length; index++) {
    if (!family.words.test(steps[index])) continue;
    result.add(steps[index]);
    // Permit a liquid setup followed by an ingredient, or a following timed
    // cooking step. Never borrow evidence from a different staple's steps.
    for (const neighbor of [index - 1, index + 1, index + 2]) {
      if (neighbor < 0 || neighbor >= steps.length) continue;
      const between = steps.slice(Math.min(index, neighbor), Math.max(index, neighbor) + 1);
      if (!between.some(step => !family.words.test(step) && (
        families.some(other => other.key !== family.key && other.words.test(step)) ||
        otherFood.some(anchor => step.includes(anchor))
      ))) result.add(steps[neighbor]);
    }
  }
  return [...result].join(" ");
}

export function validateRecipePreparation(
  recipe: PreparationRecipe,
  options: { strictIngredientForms?: boolean } = {}
): PreparationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const steps = (Array.isArray(recipe.instructions) ? recipe.instructions : [recipe.instructions])
    .filter((step): step is string => typeof step === "string")
    .flatMap(step => normalize(step).split(/[!?;]\s*|\.(?!\d)\s*|\n+|,\s*(?:then|luego)\s+/))
    .filter(step => step.trim());
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  if (!ingredients.length || ingredients.some(ingredient => !ingredientText(ingredient).trim())) {
    errors.push("A complete recipe requires named ingredients.");
  }
  if (!steps.length) errors.push("A complete recipe requires preparation instructions.");

  for (const ingredient of ingredients) {
    const original = ingredientText(ingredient);
    const description = normalize(original);
    const family = stapleFamily(description);
    const row = ingredient && typeof ingredient === "object" ? ingredient as Record<string, unknown> : {};
    const name = normalize(row.name ?? row.item ?? original);
    const anchor = name.replace(/\b(?:canned|cooked|precooked|pre-cooked|frozen|fresh|raw|dried|dry|drained|chopped|diced|enlatad[oa]s?|cocid[oa]s?|congelad[oa]s?|fresc[oa]s?|crud[oa]s?|escurrid[oa]s?|sec[oa]s?|cups?|tazas?|oz|grams?|gramos?|tbsp|tsp)\b/g, "")
      .match(/[a-z]{3,}/g)?.pop()?.replace(/s$/, "");
    const relatedSteps = steps.filter(step => anchor && step.includes(anchor)).join(" ");
    if (/\b(?:drained|escurrid[oa]s?)\b/.test(description) &&
        /\b(?:do not drain|without draining|undrained|sin escurrir|no escurr[ai])\b/.test(relatedSteps)) {
      errors.push(`Instructions contradict the drained ingredient quantity: ${original}`);
    }
    if (frozen.test(description) &&
        /\b(?:use fresh|using fresh|wash fresh|utilice fresc[oa]s?|usar fresc[oa]s?)\b/.test(relatedSteps) &&
        !/\b(?:thaw|defrost|descongel[a-z]*)\b/.test(relatedSteps)) {
      errors.push(`Instructions replace a frozen ingredient with fresh without preparation: ${original}`);
    }
    if (!family) {
      // Conservative form checks outside dry staples. Do not impose boiling
      // requirements on fresh produce, flours, sushi, or unrelated foods.
      const protein = description.match(/\b(chicken|pollo|turkey|pavo|beef|carne de res)\b/)?.[0];
      const related = steps.filter(step => protein && step.includes(protein)).join(" ");
      if (protein && dry.test(description) && !ready.test(description) &&
          new RegExp(`\\b${readyState}\\s+${protein}\\b|\\b${protein}\\s+${readyState}\\b`).test(related) &&
          !cooking.test(related)) {
        errors.push(`Instructions use cooked protein but the listed quantity is raw: ${original}`);
      }
      continue;
    }
    const isDry = dry.test(description);
    const isReady = ready.test(description);
    const isFresh = fresh.test(description);
    const isFrozen = frozen.test(description);
    const local = localInstructions(steps, family, ingredients);
    const listedQuantity = description.match(new RegExp(quantityPattern));
    // Compare only explicit same-form, same-unit amounts. Do not invent a
    // dry-to-cooked yield factor or convert nutrition from guessed evidence.
    const instructionQuantities = local.matchAll(new RegExp(
      `${quantityPattern}\\s+(?:(?:of|de)\\s+)?((?:(?:dry|dried|uncooked|canned|cooked|precooked|sec[oa]s?|cocid[oa]s?|enlatad[oa]s?|white|brown|red|black|blanc[oa]|integral)\\s+){0,3})${family.noun}\\b`,
      "g",
    ));
    for (const match of instructionQuantities) {
      const sameForm = dry.test(match[3]) === isDry && ready.test(match[3]) === isReady;
      if (listedQuantity && sameForm && quantityUnit(listedQuantity[2]) === quantityUnit(match[2]) &&
          Math.abs(quantityValue(listedQuantity[1]) - quantityValue(match[1])) > 0.01 &&
          !/\b(?:divided|remaining|reserve|reserv[ae]|restante|dividid[oa])\b/.test(local)) {
        errors.push(`Instruction quantity differs from the listed ${family.key} quantity: ${original}`);
      }
    }
    // "Cooked from dried" describes the cooked ingredient, not two quantities.
    const cookedFromDry = /\b(?:cooked from (?:dry|dried)|cocid[oa]s? a partir de)\b/.test(description);
    if (isDry && isReady && !cookedFromDry) {
      errors.push(`Conflicting dried and ready-to-eat forms: ${original}`);
      continue;
    }
    if (!isDry && !isReady && !isFresh && !isFrozen) {
      const message = `Specify the dried, canned, cooked, fresh or frozen form: ${original}`;
      if (options.strictIngredientForms) errors.push(message);
      else warnings.push(message);
    }
    if (isDry && !isReady) {
      if (!family.words.test(local) || !cooking.test(local) || !liquid.test(local) || !duration.test(local)) {
        errors.push(`Dried/uncooked ${family.key} require their own cooking method, liquid and time: ${original}`);
      }
    }
    // Explicit instruction substitutions may not reinterpret the listed
    // quantity or its nutrition. Cooking a dry ingredient first is legitimate.
    const readyNoun = new RegExp(`\\b${readyState}\\s+(?:[a-z]+\\s+){0,2}${family.noun}\\b|\\b${family.noun}\\s+${readyState}\\b`);
    if (isDry && !isReady && readyNoun.test(local) &&
        !(cooking.test(local) && liquid.test(local) && duration.test(local))) {
      errors.push(`Instructions use ready-to-eat ${family.key} but the quantity is dried/uncooked: ${original}`);
    }
    if (isReady && /\b(?:soak overnight|soak for \d+ hours?|remoje toda la noche|remojar toda la noche)\b/.test(local)) {
      errors.push(`Instructions treat ready-to-eat ${family.key} as dried: ${original}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/** Release-only adapter: never fabricates quantities, nutrition or replacements. */
export function isPreparedRecipe(recipe: PreparationRecipe): boolean {
  return validateRecipePreparation(recipe, { strictIngredientForms: true }).isValid;
}

export function filterPreparedMealResponse<
  T extends { success: boolean; meal?: PreparationRecipe; meals?: PreparationRecipe[] },
>(result: T): T | { success: false; source: "error"; error: string } {
  if (!result.success) return result;
  const original = result.meals?.length ? result.meals : result.meal ? [result.meal] : [];
  const accepted = original.filter(isPreparedRecipe);
  if (!accepted.length) {
    return { success: false, source: "error",
      error: "The recipe's ingredient forms and preparation could not be verified. Please try again." };
  }
  return {
    ...result,
    ...(result.meals ? { meals: accepted } : {}),
    ...(result.meal ? { meal: accepted.includes(result.meal) ? result.meal : accepted[0] } : {}),
  };
}
