import {
  CreateDishIntentSchema,
  type CreateDishIntent,
  type ExpansionDimension,
} from "../../../shared/createDishIngredientExpansion";
import type { FoodMeaningV1 } from "../../../shared/foodMeaning";
import { validateDishIdentity } from "../dishAdaptation/dishIdentityValidator";
import { expandCreateDishIngredient } from "./ingredientExpansionService";
import {
  getCreateDishGovernedEvidenceTerms,
} from "../../../shared/catalog/createDishCulinary.catalog";
import {
  resolveCreateDishContract,
  type CreateDishContract,
} from "./dishContract";

export interface CreateDishIntentEvidence {
  ingredient: boolean;
  form: boolean;
  texture: boolean;
  flavor: boolean;
  passed: boolean;
  failedDimensions: Array<"ingredient" | "form" | "texture" | "flavor">;
}

function normalizeIngredientOnlyText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SEMANTIC_PREFERENCE_BLOCKED_CLAIMS =
  /\b(ignore|instruction|system|prompt|must|calorie|carb|sodium|sugar|fat|protein|diabetes|glp-?1|medical|clinical|allergy|allergen|heart[- ]healthy|weight loss|low[- ](?:carb|sodium|sugar|fat)|vegan|vegetarian|pescatarian|pregnan|pediatric)\b/i;

const normalizeWords = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

function validatedExplicitCuisine(intent: CreateDishIntent): string | null {
  const cuisine = intent.cuisine?.trim() || null;
  if (!cuisine) return null;
  const requestWords = ` ${normalizeWords(intent.originalText)} `;
  const cuisineWords = normalizeWords(cuisine);
  if (!cuisineWords || !requestWords.includes(` ${cuisineWords} `)) {
    throw new Error("INVALID_CREATE_DISH_CUISINE");
  }
  return cuisine;
}

function stripCuisineFromSemanticIngredient(
  ingredient: CreateDishIntent["ingredient"],
  cuisine: string | null,
): CreateDishIntent["ingredient"] {
  if (!cuisine || !ingredient.canonicalId.startsWith("semantic-")) return ingredient;
  const escapedCuisine = cuisine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const canonicalName = ingredient.canonicalName
    .replace(new RegExp(`^${escapedCuisine}[\\s-]+`, "i"), "")
    .replace(new RegExp(`[\\s-]+${escapedCuisine}$`, "i"), "")
    .trim();
  if (!canonicalName || canonicalName === ingredient.canonicalName) return ingredient;
  return {
    ...ingredient,
    canonicalName,
    canonicalId: `semantic-${normalizeWords(canonicalName).replace(/\s+/g, "-")}`,
  };
}

export function resolveValidatedCreateDishCuisine(raw: unknown): string | null {
  return validatedExplicitCuisine(CreateDishIntentSchema.parse(raw));
}

export function resolveCreateDishCuisineAuthority(
  manualCuisineOverride: unknown,
  rawIntent: unknown,
): string | null {
  const manual =
    typeof manualCuisineOverride === "string" && manualCuisineOverride.trim()
      ? manualCuisineOverride.trim()
      : null;
  return manual ?? (rawIntent == null ? null : resolveValidatedCreateDishCuisine(rawIntent));
}

function isValidSemanticPreference(
  preference: NonNullable<CreateDishIntent["resolvedCombination"]["form"]>,
): boolean {
  return (
    preference.source === "semantic_preference" &&
    preference.id.startsWith(`semantic-${preference.dimension}-`) &&
    !SEMANTIC_PREFERENCE_BLOCKED_CLAIMS.test(preference.label)
  );
}

export function isBroadIngredientOnlyCreateDishIntent(
  intent: CreateDishIntent,
): boolean {
  // A resolved prepared dish is never merely a raw ingredient even when the
  // resolver kept the exact user wording (e.g. "potato salad").
  if (intent.ingredient.category === "prepared-dish") return false;
  return normalizeIngredientOnlyText(intent.originalText) ===
    normalizeIngredientOnlyText(intent.ingredient.canonicalName);
}

export async function revalidateCreateDishIntent(
  raw: unknown,
  allergyTags: string[],
): Promise<CreateDishIntent> {
  const parsed = CreateDishIntentSchema.parse(raw);
  const cuisine = validatedExplicitCuisine(parsed);
  const parsedWithCuisineIdentity = CreateDishIntentSchema.parse({
    ...parsed,
    ...(parsed.cuisine !== undefined ? { cuisine } : {}),
    ingredient: stripCuisineFromSemanticIngredient(parsed.ingredient, cuisine),
  });
  const selectedSemanticPreferences = [
    parsedWithCuisineIdentity.resolvedCombination.form,
    parsedWithCuisineIdentity.resolvedCombination.texture,
    parsedWithCuisineIdentity.resolvedCombination.flavor,
  ].filter(Boolean);
  if (parsedWithCuisineIdentity.ingredient.canonicalId.startsWith("semantic-")) {
    if (
      selectedSemanticPreferences.every((preference) =>
        isValidSemanticPreference(preference!)
      )
    ) {
      return parsedWithCuisineIdentity;
    }
    throw new Error("INVALID_CREATE_DISH_INTENT");
  }
  const isComposedDish = !isBroadIngredientOnlyCreateDishIntent(parsedWithCuisineIdentity);
  const selectedOptionIds: Partial<Record<ExpansionDimension, string>> = {};
  for (const dimension of ["form", "texture", "flavor"] as const) {
    const selected = parsedWithCuisineIdentity.resolvedCombination[dimension];
    if (selected) selectedOptionIds[dimension] = selected.id;
  }
  const expansion = await expandCreateDishIngredient(
    {
      ingredientInput: parsedWithCuisineIdentity.ingredient.canonicalName,
      creator: "create_a_dish",
      surprisePolicy: { delegatedDimensions: [], selectedOptionIds },
      useAiForGaps: false,
    },
    { allergyTags },
  );
  if (
    expansion.ingredient.status !== "recognized" ||
    expansion.ingredient.canonicalId !== parsedWithCuisineIdentity.ingredient.canonicalId ||
    !expansion.resolvedCombination
  ) {
    throw new Error("INVALID_CREATE_DISH_INTENT");
  }
  return CreateDishIntentSchema.parse({
    ...parsedWithCuisineIdentity,
    ingredient: {
      canonicalId: expansion.ingredient.canonicalId,
      canonicalName: expansion.ingredient.canonicalName,
      category: expansion.ingredient.category,
    },
    resolvedCombination: {
      form:
        isComposedDish &&
        parsedWithCuisineIdentity.resolvedCombination.selectionSource.form === "system_selected"
          ? null
          : expansion.resolvedCombination.form,
      texture: expansion.resolvedCombination.texture,
      flavor: expansion.resolvedCombination.flavor,
      selectionSource: {
        form:
          isComposedDish &&
          parsed.resolvedCombination.selectionSource.form === "system_selected"
            ? "not_applicable"
            : parsed.resolvedCombination.selectionSource.form,
        texture: parsedWithCuisineIdentity.resolvedCombination.selectionSource.texture,
        flavor: parsedWithCuisineIdentity.resolvedCombination.selectionSource.flavor,
      },
    },
  });
}

export function relaxSystemSelectedCreateDishIntent(
  intent: CreateDishIntent,
): CreateDishIntent {
  const resolved = intent.resolvedCombination;
  const relax = <T>(
    value: T | null,
    source: "user_selected" | "system_selected" | "not_applicable",
  ): T | null => source === "system_selected" ? null : value;
  return CreateDishIntentSchema.parse({
    ...intent,
    resolvedCombination: {
      form: relax(resolved.form, resolved.selectionSource.form),
      texture: relax(resolved.texture, resolved.selectionSource.texture),
      flavor: relax(resolved.flavor, resolved.selectionSource.flavor),
      selectionSource: {
        form: resolved.selectionSource.form === "system_selected"
          ? "not_applicable"
          : resolved.selectionSource.form,
        texture: resolved.selectionSource.texture === "system_selected"
          ? "not_applicable"
          : resolved.selectionSource.texture,
        flavor: resolved.selectionSource.flavor === "system_selected"
          ? "not_applicable"
          : resolved.selectionSource.flavor,
      },
    },
  });
}

export function applyCreateDishIntentWithSoftFallback<T>(
  meals: T[],
  intent: CreateDishIntent,
  contract?: CreateDishContract,
  meaning?: FoodMeaningV1 | null,
): {
  initialEvidence: Array<{ meal: T; evidence: CreateDishIntentEvidence }>;
  survivors: T[];
  effectiveIntent: CreateDishIntent;
  relaxedSystemSelections: boolean;
} {
  const initialEvidence = meals.map((meal) => ({
    meal,
    evidence: evaluateCreateDishIntentEvidence(meal, intent, contract, meaning),
  }));
  const initialSurvivors = initialEvidence
    .filter(({ evidence }) => evidence.passed)
    .map(({ meal }) => meal);
  if (initialSurvivors.length > 0) {
    return {
      initialEvidence,
      survivors: initialSurvivors,
      effectiveIntent: intent,
      relaxedSystemSelections: false,
    };
  }

  const relaxedIntent = relaxSystemSelectedCreateDishIntent(intent);
  const relaxedSystemSelections =
    JSON.stringify(relaxedIntent.resolvedCombination) !==
    JSON.stringify(intent.resolvedCombination);
  const relaxedSurvivors = relaxedSystemSelections
    ? meals.filter((meal) =>
        evaluateCreateDishIntentEvidence(meal, relaxedIntent, contract, meaning).passed
      )
    : [];
  return {
    initialEvidence,
    survivors: relaxedSurvivors,
    effectiveIntent: relaxedSurvivors.length > 0 ? relaxedIntent : intent,
    relaxedSystemSelections: relaxedSurvivors.length > 0,
  };
}

export function buildCreateDishIntentPrompt(intent: CreateDishIntent, meaning?: FoodMeaningV1 | null): string {
  const resolved = intent.resolvedCombination;
  const contract = resolveCreateDishContract(intent);
  const preparedDish = meaning?.concept.kind === "prepared_dish";
  const definingCore = contract.leafVessel
    ? "lettuce leaves used as the wrap vessel"
    : contract.namedFamily === "salad" && contract.namedCore
      ? contract.namedCore
      : intent.ingredient.canonicalName;
  const lines = [
    meaning?.cuisine?.source === "semantic_inference"
      ? `Possible cuisine association (inferred, optional): ${meaning.cuisine.value}`
      : null,
    intent.cuisine ? `Requested cuisine: ${intent.cuisine}` : null,
    preparedDish ? `Prepared dish: ${intent.ingredient.canonicalName}` : contract.namedFamily
      ? `Defining ingredient/role: ${definingCore}`
      : `Primary ingredient: ${definingCore}`,
    resolved.form ? `Form/cut: ${resolved.form.label}` : null,
    resolved.texture ? `Texture: ${resolved.texture.label}` : null,
    resolved.flavor ? `Flavor direction: ${resolved.flavor.label}` : null,
  ].filter(Boolean);
  const hardRequirements = [
    preparedDish
      ? `Keep ${intent.ingredient.canonicalName} recognizable as a prepared dish; its name is not a recipe ingredient. Preserve the actual defining components and physical form.`
      : `Use ${definingCore} as the defining ingredient/role of the requested dish.`,
    resolved.form && resolved.selectionSource.form === "user_selected"
      ? `Every candidate MUST use ${resolved.form.label} or a governed equivalent preparation of that form/cut.`
      : null,
    resolved.texture && resolved.selectionSource.texture === "user_selected"
      ? `Every candidate MUST use preparation that produces a recognizable ${resolved.texture.label} texture.`
      : null,
    resolved.flavor && resolved.selectionSource.flavor === "user_selected"
      ? `Every candidate MUST retain a recognizable ${resolved.flavor.label} flavor profile.`
      : null,
  ].filter(Boolean);
  const softPreferences = [
    resolved.form && resolved.selectionSource.form === "system_selected"
      ? `Creative preference: use ${resolved.form.label} only if it naturally fits the requested dish.`
      : null,
    resolved.texture && resolved.selectionSource.texture === "system_selected"
      ? `Creative preference: aim for ${resolved.texture.label} texture only if compatible with the requested dish.`
      : null,
    resolved.flavor && resolved.selectionSource.flavor === "system_selected"
      ? `Creative preference: use a ${resolved.flavor.label} flavor direction only if compatible with the requested dish.`
      : null,
  ].filter(Boolean);
  const hasHardDimensions = hardRequirements.length > 1;
  const steakIngredientEvidence = intent.ingredient.canonicalId === "beef" && resolved.form?.id === "steak-cut"
    ? 'Name the actual beef cut in the ingredient list (for example "beef sirloin" or "filet mignon"). "Steak" alone is ambiguous because fish and vegetable steaks exist.'
    : null;
  return `[CREATE A DISH — VALIDATED CULINARY INTENT]
${lines.join("\n")}
 ${hasHardDimensions ? `[CREATE A DISH — HARD CULINARY INTENT]
${hardRequirements.join("\n")}
The explicitly selected dimensions above are fixed current-request requirements.
Do not vary any selected form/cut, texture, or flavor. Create variety only through unconstrained side pairings, vegetables, garnishes, plating, or other unselected dimensions.
 Explicit current culinary intent overrides general cuisine, broad-flavor, heat, and palate defaults when they conflict.` : preparedDish
   ? `Preserve the actual components and preparation of ${intent.ingredient.canonicalName}; its name is not a recipe ingredient. No preparation dimensions are fixed.`
   : `Use ${definingCore} as the defining ingredient/role; no preparation dimensions are fixed.`}
${steakIngredientEvidence ?? ""}
${softPreferences.length > 0 ? `[CREATE A DISH — OPTIONAL CREATIVE GUIDANCE]
${softPreferences.join("\n")}
These system-selected ideas are optional. Never distort the requested dish or fail generation to preserve them.` : ""}
Safety, allergies, dietary identity, clinical protocols, diabetes, GLP-1, and canonical nutrition requirements remain authoritative; adapt transparently if one requires a change.`;
}

export function buildCreateDishIntentDishSubject(intent: CreateDishIntent): string {
  return [
    intent.resolvedCombination.form?.label,
    intent.resolvedCombination.texture?.label,
    intent.resolvedCombination.flavor?.label,
    intent.ingredient.canonicalName,
  ].filter(Boolean).join(" ");
}

export function evaluateCreateDishIntentEvidence(
  meal: unknown,
  intent: CreateDishIntent,
  contract: CreateDishContract = resolveCreateDishContract(intent),
  meaning?: FoodMeaningV1 | null,
): CreateDishIntentEvidence {
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
  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hasAffirmativeTerm = (text: string, terms: string[]) =>
    text
      .toLowerCase()
      .split(/[.!?;\n]+/)
      .some((clause) =>
        terms.some((term) => {
          const pattern = new RegExp(
            `(?:^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}(?=$|[^a-z0-9])`,
            "g",
          );
          return Array.from(clause.matchAll(pattern)).some((match) => {
            const termStart =
              (match.index ?? 0) + match[0].indexOf(term.toLowerCase());
            const before = clause.slice(Math.max(0, termStart - 48), termStart);
            const after = clause.slice(
              termStart + term.length,
              termStart + term.length + 40,
            );
            const negatedBefore =
              /\b(?:no|not|never|without|instead of|rather than)\s+(?:(?:the|very|use|using)\s+){0,2}$/.test(before) ||
              /\b(?:avoid|avoids|avoiding|do not|don't|does not|doesn't|is not|isn't|are not|aren't)\s+(?:(?:use|using|make|making)\s+)?$/.test(before);
            const negatedAfter =
              /^\s+(?:[a-z]+\s+){0,2}(?:is|are|should be)\s+not\b/.test(after);
            const replacementSource =
              (
                /\breplace\b[^,]*$/.test(before) &&
                /^\s+with\b/.test(after)
              ) ||
              (
                /\bswap\b[^,]*$/.test(before) &&
                /^\s+for\b/.test(after)
              );
            const substitutedAway =
              /\bsubstitute\b[^,]*\bfor\s*$/.test(before);
            return !negatedBefore &&
              !negatedAfter &&
              !replacementSource &&
              !substitutedAway;
          });
        })
      );
  const form = intent.resolvedCombination.form;
  // A named beef steak cut is affirmative evidence of both beef and steak
  // form. "Steak" by itself is not: fish and vegetable steaks exist too.
  const beefSteakCuts = intent.ingredient.canonicalId === "beef" && form?.id === "steak-cut"
    ? ["sirloin", "ribeye", "filet mignon", "beef tenderloin", "flank steak", "strip steak", "t-bone", "porterhouse"]
    : [];
  const singular = (contract.namedCore && contract.namedFamily === "salad")
    ? contract.namedCore
    : intent.ingredient.canonicalName.toLowerCase();
  // Only deterministic inflections and literal governed ingredient terms.
  // Do not treat the name of a prepared dish as an ingredient: a potato salad
  // lists potatoes, and a lettuce wrap lists lettuce leaves and its filling.
  const inflections = /^[a-z]+$/.test(singular)
    ? [singular, singular.endsWith("y")
        ? `${singular.slice(0, -1)}ies`
        : /(?:ch|sh|s|x|z|o)$/.test(singular)
          ? `${singular}es` : `${singular}s`]
    : [singular];
  // "Fruit" is a food group, not normally a literal ingredient name in a
  // fruit salad. Only concrete, bounded fruit names can establish this role.
  const fruitTerms = [
    "apple", "apples", "banana", "bananas", "orange", "oranges", "pear", "pears",
    "strawberry", "strawberries", "blueberry", "blueberries", "raspberry", "raspberries",
    "blackberry", "blackberries", "grape", "grapes", "melon", "watermelon", "cantaloupe",
    "pineapple", "mango", "mangoes", "kiwi", "peach", "peaches", "plum", "plums",
    "cherry", "cherries", "papaya", "pomegranate",
  ];
  const ingredientTerms = contract.leafVessel
    ? ["lettuce"]
    : contract.namedFamily === "salad" && contract.namedCore === "fruit"
      ? fruitTerms
      : [...inflections, ...beefSteakCuts];
  const unqualifiedIngredient = ingredients
    .split(/[.!?;\n]+/)
    .filter((part) => !/\b(?:flavou?r(?:ed|ing)?|seasoning|extract|starch|powder)\b/i.test(part))
    .join(". ");
  const ingredientFound = hasAffirmativeTerm(unqualifiedIngredient, ingredientTerms);
  const leafEvidence = contract.leafVessel
    ? hasAffirmativeTerm(ingredients, ["lettuce leaf", "lettuce leaves", "romaine lettuce leaves", "romaine lettuce leaf"]) &&
      /\b(?:wrap|fold|roll|fill|spoon|tuck|enclose|place)\b(?:\s+\w+){0,5}\s+(?:(?:in|into|on|onto|with|around)\s+)?(?:(?:the|fresh|large|romaine)\s+){0,3}lettuce\s+leaves?\b|\blettuce\s+leaves?\b(?:\s+\w+){0,5}\s+(?:around|over|to enclose|as wraps)\b/i.test(instructions) &&
      !/\b(?:do not|don't|without|instead of|rather than|never)\s+(?:\w+\s+){0,4}(?:lettuce|leaves|leaf)\b/i.test(instructions)
    : true;
  // For a prepared dish, the dish name is not a literal ingredient. Require
  // affirmative evidence for multiple distinct defining components in the
  // structured recipe, in addition to the existing dish/form identity gate.
  const preparedDish = meaning?.concept.kind === "prepared_dish";
  const definingTerms = contract.definingComponents
    .map(component => component.split("(")[0].trim().toLowerCase())
    .filter(component => component.length >= 4 &&
      !/^(?:the|vegetables?|proteins?|ingredients?|seasonings?|spices?|meat|seafood|base|sauce)$/.test(component));
  const recipeText = `${ingredients}. ${instructions}`;
  const componentMatches = definingTerms.filter(component =>
    hasAffirmativeTerm(recipeText, [component]));
  const dishIdentity = preparedDish
    ? validateDishIdentity(contract.requestedDish, candidate as any, {
        identityAnchor: contract.requestedDish,
        definingComponents: contract.definingComponents,
        adaptableComponents: contract.adaptableComponents,
        dishForm: contract.physicalForm ?? undefined,
        conflicts: contract.conflicts,
        adaptationBlock: "",
      })
    : null;
  const ingredientPassed = preparedDish
    ? !!dishIdentity?.passed && !dishIdentity.catastrophicDeviation &&
      definingTerms.length > 0 &&
      componentMatches.length >= Math.min(2, definingTerms.length)
    : ingredientFound && leafEvidence;
  const formTerms = form
    ? getCreateDishGovernedEvidenceTerms(
        "form",
        form.id,
        form.label,
        intent.ingredient.canonicalName,
      )
    : [];
  const formPassed = !form || hasAffirmativeTerm(
    `${ingredients}. ${instructions}`,
    [...formTerms, ...beefSteakCuts],
  );
  const texture = intent.resolvedCombination.texture;
  const texturePassed = !texture || hasAffirmativeTerm(
    instructions,
    getCreateDishGovernedEvidenceTerms(
      "texture",
      texture.id,
      texture.label,
      intent.ingredient.canonicalName,
    ),
  );
  const flavor = intent.resolvedCombination.flavor;
  const flavorTerms = flavor
    ? getCreateDishGovernedEvidenceTerms(
        "flavor",
        flavor.id,
        flavor.label,
        intent.ingredient.canonicalName,
      )
    : [];
  const flavorPassed = !flavor || hasAffirmativeTerm(
    `${title}. ${ingredients}. ${instructions}`,
    flavorTerms,
  );
  const dimensions = {
    ingredient: ingredientPassed,
    form: formPassed,
    texture: texturePassed,
    flavor: flavorPassed,
  };
  const failedDimensions = (Object.entries(dimensions) as Array<
    ["ingredient" | "form" | "texture" | "flavor", boolean]
  >)
    .filter(([, passed]) => !passed)
    .map(([dimension]) => dimension);
  return {
    ...dimensions,
    passed: failedDimensions.length === 0,
    failedDimensions,
  };
}

export function mealHonorsCreateDishIntent(
  meal: unknown, intent: CreateDishIntent, contract?: CreateDishContract, meaning?: FoodMeaningV1 | null,
): boolean {
  return evaluateCreateDishIntentEvidence(meal, intent, contract, meaning).passed;
}

export function buildCreateDishIntentRepairInstructions(
  intent: CreateDishIntent,
  failedDimensions: CreateDishIntentEvidence["failedDimensions"],
  contract: CreateDishContract,
): string {
  const preparedDish = contract.conceptKind === "prepared_dish";
  const core = contract.namedCore && contract.namedFamily === "salad"
    ? contract.namedCore
    : contract.leafVessel ? "lettuce leaves" : intent.ingredient.canonicalName;
  const ingredientReason = failedDimensions.includes("ingredient") && preparedDish
    ? `The structured ingredients and preparation did not verify the defining components of "${contract.requestedDish}". ` +
      `Keep its recognizable physical form and show its real ingredients; do not list the prepared dish itself as an ingredient. ` +
      `If the culinary interpretation is uncertain, do not invent a component or evade food protections.`
    : failedDimensions.includes("ingredient")
    ? `The recipe ingredient list did not affirm the defining ${core}` +
      (contract.leafVessel
        ? " as lettuce leaves functioning as the wrap vessel in the instructions"
        : "") +
      `. A title or an ingredient merely flavored with ${core} is not evidence. ` +
      `Include real ${core} in the ingredients and preparation while keeping "${contract.requestedDish}" recognizable; ` +
      `never add a prohibited ingredient to satisfy this check. If no compliant recognizable version exists, it must fail validation.`
    : "";
  return [
    `The previous candidates did not satisfy: ${failedDimensions.join(", ")}.`,
    ingredientReason,
    `Keep the named dish "${contract.requestedDish}" and its ${contract.physicalForm ?? "original physical form"}.`,
    ...contract.definingComponents.slice(0, 4)
      .filter(part => part.trim().length >= 4 && !/^the\b/i.test(part.trim()))
      .map((part) => `Preserve defining role: ${part}.`),
    ...contract.conflicts.slice(0, 4).map((conflict) => conflict.directive),
    "Adapt only incompatible components; never weaken allergies, avoidances, dietary, clinical, provider, diabetic, GLP-1, protocol or final food protections.",
  ].filter(Boolean).join("\n");
}