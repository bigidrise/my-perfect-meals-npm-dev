import {
  CreateDishIntentSchema,
  type CreateDishIntent,
  type ExpansionDimension,
} from "../../../shared/createDishIngredientExpansion";
import { expandCreateDishIngredient } from "./ingredientExpansionService";
import {
  getCreateDishGovernedEvidenceTerms,
} from "../../../shared/catalog/createDishCulinary.catalog";

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
  return normalizeIngredientOnlyText(intent.originalText) ===
    normalizeIngredientOnlyText(intent.ingredient.canonicalName);
}

export async function revalidateCreateDishIntent(
  raw: unknown,
  allergyTags: string[],
): Promise<CreateDishIntent> {
  const parsed = CreateDishIntentSchema.parse(raw);
  const selectedSemanticPreferences = [
    parsed.resolvedCombination.form,
    parsed.resolvedCombination.texture,
    parsed.resolvedCombination.flavor,
  ].filter(Boolean);
  if (parsed.ingredient.canonicalId.startsWith("semantic-")) {
    if (
      selectedSemanticPreferences.every((preference) =>
        isValidSemanticPreference(preference!)
      )
    ) {
      return parsed;
    }
    throw new Error("INVALID_CREATE_DISH_INTENT");
  }
  const isComposedDish = !isBroadIngredientOnlyCreateDishIntent(parsed);
  const selectedOptionIds: Partial<Record<ExpansionDimension, string>> = {};
  for (const dimension of ["form", "texture", "flavor"] as const) {
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
      form:
        isComposedDish &&
        parsed.resolvedCombination.selectionSource.form === "system_selected"
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
        texture: parsed.resolvedCombination.selectionSource.texture,
        flavor: parsed.resolvedCombination.selectionSource.flavor,
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
): {
  initialEvidence: Array<{ meal: T; evidence: CreateDishIntentEvidence }>;
  survivors: T[];
  effectiveIntent: CreateDishIntent;
  relaxedSystemSelections: boolean;
} {
  const initialEvidence = meals.map((meal) => ({
    meal,
    evidence: evaluateCreateDishIntentEvidence(meal, intent),
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
        evaluateCreateDishIntentEvidence(meal, relaxedIntent).passed
      )
    : [];
  return {
    initialEvidence,
    survivors: relaxedSurvivors,
    effectiveIntent: relaxedSurvivors.length > 0 ? relaxedIntent : intent,
    relaxedSystemSelections: relaxedSurvivors.length > 0,
  };
}

export function buildCreateDishIntentPrompt(intent: CreateDishIntent): string {
  const resolved = intent.resolvedCombination;
  const lines = [
    `Primary ingredient: ${intent.ingredient.canonicalName}`,
    resolved.form ? `Form/cut: ${resolved.form.label}` : null,
    resolved.texture ? `Texture: ${resolved.texture.label}` : null,
    resolved.flavor ? `Flavor direction: ${resolved.flavor.label}` : null,
  ].filter(Boolean);
  const hardRequirements = [
    `Use ${intent.ingredient.canonicalName} as the primary ingredient.`,
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
  return `[CREATE A DISH — VALIDATED CULINARY INTENT]
${lines.join("\n")}
${hasHardDimensions ? `[CREATE A DISH — HARD CULINARY INTENT]
${hardRequirements.join("\n")}
The explicitly selected dimensions above are fixed current-request requirements.
Do not vary any selected form/cut, texture, or flavor. Create variety only through unconstrained side pairings, vegetables, garnishes, plating, or other unselected dimensions.
Explicit current culinary intent overrides general cuisine, broad-flavor, heat, and palate defaults when they conflict.` : `Use ${intent.ingredient.canonicalName} as the primary ingredient; no preparation dimensions are fixed.`}
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
  const ingredientPassed = hasAffirmativeTerm(
    ingredients,
    [intent.ingredient.canonicalName.toLowerCase()],
  );
  const form = intent.resolvedCombination.form;
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
    formTerms,
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

export function mealHonorsCreateDishIntent(meal: unknown, intent: CreateDishIntent): boolean {
  return evaluateCreateDishIntentEvidence(meal, intent).passed;
}