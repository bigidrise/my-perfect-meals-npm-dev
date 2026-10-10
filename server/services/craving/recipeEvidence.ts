import type { CravingCategoryValue } from "../../../shared/cravingCategories";

export interface CulinaryRecipe {
  name?: string;
  description?: string;
  ingredients?: unknown[];
  instructions?: unknown;
}

export type EvidenceResult = "match" | "mismatch" | "ambiguous";

const normalize = (value: unknown) => String(value ?? "").normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function instructionText(recipe: CulinaryRecipe): string {
  const steps = Array.isArray(recipe.instructions) ? recipe.instructions : [recipe.instructions];
  return steps.map(step => typeof step === "string" ? step
    : step && typeof step === "object"
      ? String(step.instruction ?? step.text ?? step.description ?? "") : "").join(". ");
}

function ingredientNames(recipe: CulinaryRecipe): string[] {
  return (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map(item => normalize(typeof item === "string" ? item
    : item && typeof item === "object" ? (item as any).name ?? (item as any).item : ""))
    .filter(Boolean).sort();
}

export function hasCulinaryEvidence(recipe: CulinaryRecipe): boolean {
  return ingredientNames(recipe).length > 0 && Boolean(instructionText(recipe).trim());
}

/** Quality evidence only. Serving-scale changes cannot grant nutrition clearance. */
export function culinaryEvidenceKey(recipe: CulinaryRecipe): string {
  return JSON.stringify([ingredientNames(recipe), normalize(instructionText(recipe))]);
}

function actions(recipe: CulinaryRecipe): string {
  // A preheat instruction or a warning not to cook is not proof of actual cooking.
  return instructionText(recipe).toLowerCase()
    .replace(/\b(?:preheat|heat up|warm up)\b[^.;]*(?:[.;]|$)/g, "")
    .replace(/\b(?:do not|don't|without)\s+(?:cook|heat|bake|fry|grill)\b/g, "");
}

const methodPatterns: Record<string, RegExp> = {
  "Air Fryer": /\bair[- ]?fry(?:ing)?\b|\bair[- ]?fryer\b[\s\S]{0,150}\b(?:cook|bake|roast)\b|\b(?:cook|bake|roast)\b[\s\S]{0,150}\bair[- ]?fryer\b/,
  Oven: /\b(?:bake|baking|roast|roasting|broil|broiling)\b|\bcook\b[^.;]*\boven\b/,
  Grill: /(?:^|[.;,]\s*|\bthen\s+|\band\s+)(?:grill|grilling|char[- ]?grill|barbecue|barbecuing|charbroil)\b(?!\s+(?:sauce|marinade)\b)|\bcook\b[^.;]*\bgrill\b/,
  Stovetop: /\b(?:stir[- ]?fry|saute|sauté|simmer|boil|pan[- ]?fry|sear)\b|\bcook\b[^.;]*\b(?:skillet|pan|stovetop)\b/,
  "Slow Cooker": /\bslow[- ]?cook(?:ing)?\b|\b(?:slow[- ]?cooker|crock[- ]?pot)\b[\s\S]{0,150}\bcook\b|\bcook\b[\s\S]{0,150}\b(?:slow[- ]?cooker|crock[- ]?pot)\b/,
};

export function cookingEvidence(recipe: CulinaryRecipe, method?: string): EvidenceResult {
  if (!method) return "match";
  const steps = actions(recipe);
  if (method === "No-Cook") {
    if (/(?:^|[.;,]\s*|\bthen\s+)(?:bake|roast|grill|air[- ]?fry|saute|sauté|sear|simmer|boil|cook|heat|microwave|steam|poach|fry)\b/.test(steps)) return "mismatch";
    if (Object.values(methodPatterns).some(pattern => pattern.test(steps)) ||
      /\b(?:cook|heat|microwave|steam|poach|fry)\b/.test(steps)) return "ambiguous";
    return /\b(?:assemble|mix|blend|toss|stir|chill|slice|spread|pour|serve|combine)\b/.test(steps)
      ? "match" : "ambiguous";
  }
  if (methodPatterns[method]?.test(steps)) return "match";
  return Object.entries(methodPatterns).some(([other, pattern]) => other !== method && pattern.test(steps))
    ? "mismatch" : "ambiguous";
}

// These recognize recipe structure, not mandatory ingredients or a fixed menu.
// Unfamiliar/adapted forms remain ambiguous and can use the shared semantic review.
const structures = {
  "burgers-sandwiches": /\b(?:shape|form|press|smash|grill|sear|fry|bake|cook)\b[^.;]*\b(?:patt(?:y|ies)|burger)\b|\b(?:assemble|stack|fill|layer|wrap|place)\b[^.;]*\b(?:bun|bread|toast|sandwich|wrap|lettuce|roll)\b/,
  "pizza-flatbreads": /\b(?:stretch|press|roll|shape|spread)\b[^.;]*\b(?:dough|base|crust)\b|\b(?:top|toppings|layer)\b[^.;]*\b(?:flatbread|pizza|crust|base)\b/,
  "fried-crispy": /\b(?:crisp|crispy|crunchy|crunch|breaded|batter|coat)\b[^.;]*\b(?:fry|bake|air|golden|crisp)\b|\b(?:fry|bake|air[- ]?fry)\b[^.;]*\b(?:crisp|crispy|crunchy|golden)\b/,
  "pasta-noodles": /\b(?:cook|boil|drain|toss|layer|saute|sauté)\b[^.;]*\b(?:pasta|noodles|spaghetti|ribbons|lasagna|fettuccine|macaroni)\b/,
  "shakes-smoothies": /\b(?:blend|puree|purée|liquefy)\b/,
  "snacks-finger-foods": /\b(?:shape|form|roll|cut|slice|fill|stuff|wrap|assemble)\b[^.;]*\b(?:bites|balls|pieces|fingers|rolls|cups|wraps|sticks|wedges)\b/,
} satisfies Partial<Record<CravingCategoryValue, RegExp>>;

const namedForms: Partial<Record<CravingCategoryValue, RegExp>> = {
  "burgers-sandwiches": /\b(?:burgers?|sandwich(?:es)?|sliders?|panini|patt(?:y|ies)|wraps?)\b/,
  "pizza-flatbreads": /\b(?:pizzas?|flatbreads?)\b/,
  "fried-crispy": /\b(?:crispy|crunchy|fried|fritters?|tempura)\b/,
  "pasta-noodles": /\b(?:pasta|noodles|spaghetti|lasagna|fettuccine|macaroni|ribbons)\b/,
  "shakes-smoothies": /\b(?:shake|smoothie|lassi|blended drink)\b/,
  "snacks-finger-foods": /\b(?:bites|balls|snack|fingers|rolls|cups|sticks|wedges|wrap)\b/,
};

export function categoryEvidence(recipe: CulinaryRecipe, category?: CravingCategoryValue, explicit = ""): EvidenceResult {
  if (!category || category === "surprise" || category === "something-else") {
    return explicit ? "ambiguous" : "match";
  }
  // An incompatible explicit dish outranks a category; do not invent that compatibility locally.
  if (explicit && !namedForms[category]?.test(normalize(explicit))) return "ambiguous";
  const title = normalize(`${recipe.name ?? ""} ${recipe.description ?? ""}`);
  const steps = actions(recipe);
  const structural = structures[category as keyof typeof structures];
  if (structural) {
    return namedForms[category]!.test(title) && structural.test(steps) ? "match" : "ambiguous";
  }
  if (category === "bbq-grilled") {
    return cookingEvidence(recipe, "Grill") === "match" || /\b(?:smoke|smoking)\b/.test(steps)
      ? "match" : "ambiguous";
  }
  if (category === "breakfast") {
    return /\b(?:omelet|omelette|pancake|waffle|scramble|toast|oats|oatmeal|porridge)\b/.test(title) &&
      /\b(?:batter|pancake|waffle|egg|omelet|omelette|scramble|oats|porridge|toast|bread)\b/.test(steps) &&
      /\b(?:fold|flip|pour|scramble|toast|mix|simmer|cook)\b/.test(steps) ? "match" : "ambiguous";
  }
  if (category === "comfort-food") {
    return /\b(?:stew|casserole|pie|meatloaf|soup|lasagna|macaroni|mash)\b/.test(title) &&
      /\b(?:stew|soup|casserole|pie|loaf|mash|layers|pasta)\b/.test(steps) &&
      /\b(?:simmer|bake|layer|mash|braise|stew)\b/.test(steps) ? "match" : "ambiguous";
  }
  if (category === "sweet") {
    return /\b(?:cookies?|brownies?|cakes?|pudding|mousse|chocolate|sweet|fruit|parfait)\b/.test(title) &&
      /\b(?:batter|dough|cookie|brownie|cake|pudding|mousse|chocolate|cocoa|parfait|fruit|sweeten)\b/.test(steps) &&
      /\b(?:bake|whisk|blend|fold|chill|layer|mix)\b/.test(steps) ? "match" : "ambiguous";
  }
  if (category === "mexican-tex-mex") {
    return /\b(?:tacos?|burritos?|quesadillas?|enchiladas?|tostadas?|fajitas?|pollo asado|carne asada)\b/.test(title) &&
      /\b(?:tortilla|taco|burrito|quesadilla|enchilada|masa|tostada|fajita|achiote|asada|asado)\b/.test(steps) &&
      /\b(?:fill|fold|roll|assemble|grill|sear|bake)\b/.test(steps) ? "match" : "ambiguous";
  }
  if (category === "asian") {
    return /\b(?:dumplings?|sushi|curry|stir fry|noodles|congee|satay|bao|bibimbap)\b/.test(title) &&
      /\b(?:dumpling|wrapper|rice|sushi|roll|curry|noodles|wok|stir[- ]?fry|congee|satay|bao|kimchi|miso|soy|ginger|lemongrass)\b/.test(steps) &&
      /\b(?:fold|roll|steam|simmer|stir[- ]?fry|grill|toss|assemble)\b/.test(steps) ? "match" : "ambiguous";
  }
  // Do not require real fish/shellfish: safe plant-based seafood adaptations remain possible.
  if (category === "seafood") {
    return /\b(?:fish|salmon|cod|shrimp|prawn|scallop|seafood|tuna|trout)\b/.test(
      ingredientNames(recipe).join(" ") + " " + steps,
    ) && /\b(?:grill|bake|sear|poach|steam|marinate|shape|slice)\b/.test(steps) ? "match" : "ambiguous";
  }
  return "ambiguous";
}

const protein = /\b(?:chicken|beef|lamb|turkey|pork|tofu|paneer|salmon|cod|tuna|shrimp|prawns?)\b/g;

/** Craving-only novelty: preparation/texture differences count, titles do not. */
export function cravingRecipeSignature(recipe: CulinaryRecipe): string | null {
  if (!hasCulinaryEvidence(recipe)) return null;
  const components = ingredientNames(recipe).map(name =>
    name.replace(protein, "protein").replace(/\b(?:breast|thigh|ground|minced|fillet)\b/g, "")
      .replace(/\s+/g, " ").trim(),
  ).sort();
  const text = normalize(actions(recipe)).replace(protein, "protein");
  const preparation = [...new Set(text.match(
    /\b(?:grill|smoke|sear|bake|roast|broil|fry|steam|simmer|boil|blend|whisk|chill|stuff|fold|wrap|layer|stack|shape|smash|thin|thick|crisp|crispy|crunchy|bread|batter|coat|puree)\b/g,
  ) ?? [])].sort();
  return JSON.stringify([components, preparation.length ? preparation : [text]]);
}
