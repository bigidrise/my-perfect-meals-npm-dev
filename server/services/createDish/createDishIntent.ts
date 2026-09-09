import {
  CreateDishIntentSchema,
  type CreateDishIntent,
  type ExpansionDimension,
} from "../../../shared/createDishIngredientExpansion";
import { expandCreateDishIngredient } from "./ingredientExpansionService";

export async function revalidateCreateDishIntent(
  raw: unknown,
  allergyTags: string[],
): Promise<CreateDishIntent> {
  const parsed = CreateDishIntentSchema.parse(raw);
  const selectedOptionIds: Partial<Record<ExpansionDimension, string>> = {};
  for (const dimension of ["form", "method", "texture", "flavor", "cuisine"] as const) {
    const selected = parsed.resolvedCombination[dimension];
    if (selected) selectedOptionIds[dimension] = selected.id;
  }
  const expansion = await expandCreateDishIngredient(
    {
      ingredientInput: parsed.ingredient.canonicalName,
      creator: "create_a_dish",
      surprisePolicy: { delegatedDimensions: [], selectedOptionIds },
      useAiForGaps: false,
    },
    { allergyTags },
  );
  if (
    expansion.ingredient.status !== "recognized" ||
    expansion.ingredient.canonicalId !== parsed.ingredient.canonicalId ||
    !expansion.resolvedCombination
  ) {
    throw new Error("INVALID_CREATE_DISH_INTENT");
  }
  return CreateDishIntentSchema.parse({
    ...parsed,
    ingredient: {
      canonicalId: expansion.ingredient.canonicalId,
      canonicalName: expansion.ingredient.canonicalName,
      category: expansion.ingredient.category,
    },
    resolvedCombination: {
      ...expansion.resolvedCombination,
      selectionSource: parsed.resolvedCombination.selectionSource,
    },
  });
}

export function buildCreateDishIntentPrompt(intent: CreateDishIntent): string {
  const resolved = intent.resolvedCombination;
  const lines = [
    `Primary ingredient: ${intent.ingredient.canonicalName}`,
    resolved.form ? `Form/cut: ${resolved.form.label}` : null,
    resolved.method ? `Cooking method: ${resolved.method.label}` : null,
    resolved.texture ? `Texture: ${resolved.texture.label}` : null,
    resolved.flavor ? `Flavor direction: ${resolved.flavor.label}` : null,
    resolved.cuisine ? `Cuisine context: ${resolved.cuisine.label}` : null,
  ].filter(Boolean);
  return `[CREATE A DISH — VALIDATED CULINARY INTENT]
${lines.join("\n")}
Honor these culinary choices in the ingredient preparation and instructions. Safety, dietary, clinical, and nutrition requirements remain authoritative; adapt transparently if a conflict requires it.`;
}

export function mealHonorsCreateDishIntent(meal: unknown, intent: CreateDishIntent): boolean {
  const candidate = (meal ?? {}) as Record<string, unknown>;
  const ingredients = Array.isArray(candidate.ingredients)
    ? candidate.ingredients
        .map((ingredient) =>
          typeof ingredient === "string"
            ? ingredient
            : typeof ingredient === "object" && ingredient
              ? String((ingredient as Record<string, unknown>).name ?? (ingredient as Record<string, unknown>).item ?? "")
              : "",
        )
        .join(". ")
    : "";
  const instructions = [
    ...(Array.isArray(candidate.instructions)
      ? candidate.instructions
      : [candidate.instructions]),
    ...(Array.isArray(candidate.cookingInstructions)
      ? candidate.cookingInstructions
      : []),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(". ");
  const title = typeof candidate.name === "string" ? candidate.name : "";
  const aliases: Record<string, string[]> = {
    cubed: ["cubed", "cube", "diced"],
    thigh: ["thigh", "thighs"],
    breast: ["breast", "breasts"],
    baked: ["bake", "baked", "baking", "oven-bake"],
    grilled: ["grill", "grilled", "grilling"],
    fried: ["fry", "fried", "frying"],
    "air-fried": ["air-fry", "air fry", "air-fried", "air fried"],
    "stir-fried": ["stir-fried", "stir fried", "stir-fry", "stir fry"],
    "pan-seared": ["pan-seared", "pan seared", "sear"],
    steamed: ["steam", "steamed", "steaming"],
    boiled: ["boil", "boiled", "boiling"],
    poached: ["poach", "poached", "poaching"],
    "crispy-exterior": ["crispy", "crisp", "crunchy", "air fry", "air-fry", "fried until golden"],
    crispy: ["crispy", "crisp", "crunchy", "fry", "fried"],
    tender: ["tender", "braise", "simmer", "slow cook", "poach"],
    juicy: ["juicy", "rest before slicing", "retain moisture"],
    charred: ["char", "charred", "grill marks"],
    browned: ["brown", "browned", "sear", "seared"],
    roasted: ["roast", "roasted", "bake until golden"],
    delicate: ["delicate", "gently poach", "gently steam"],
    "soft-curds": ["soft curds", "gently scramble"],
    "tender-crisp": ["tender-crisp", "tender crisp", "stir fry", "stir-fry"],
  };
  const hasAffirmativeTerm = (text: string, terms: string[]) =>
    text
      .toLowerCase()
      .split(/[.!?;\n]+/)
      .some((sentence) => {
        const containsTerm = terms.some((term) => sentence.includes(term));
        const negated = /\b(do not|don't|without|avoid|instead of|never)\b/.test(sentence);
        return containsTerm && !negated;
      });
  const termsFor = (id: string, label: string) =>
    Array.from(new Set([id.replace(/-/g, " "), label.toLowerCase(), ...(aliases[id] ?? [])]));

  if (!hasAffirmativeTerm(ingredients, [intent.ingredient.canonicalName.toLowerCase()])) {
    return false;
  }
  const form = intent.resolvedCombination.form;
  if (form && !hasAffirmativeTerm(`${ingredients}. ${instructions}`, termsFor(form.id, form.label))) {
    return false;
  }
  const method = intent.resolvedCombination.method;
  if (method && !hasAffirmativeTerm(instructions, termsFor(method.id, method.label))) {
    return false;
  }
  const texture = intent.resolvedCombination.texture;
  if (texture && !hasAffirmativeTerm(instructions, termsFor(texture.id, texture.label))) {
    return false;
  }
  const flavor = intent.resolvedCombination.flavor;
  if (flavor && !hasAffirmativeTerm(`${title}. ${ingredients}. ${instructions}`, termsFor(flavor.id, flavor.label))) {
    return false;
  }
  return true;
}