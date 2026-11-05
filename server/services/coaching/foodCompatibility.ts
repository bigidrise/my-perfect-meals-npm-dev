import { z } from "zod";
import type { CoachingContextSnapshot, MemberContextEvidence } from "../../../shared/coaching/types";
import {
  canonicalAllergenKey, scanMealsForAllergenViolations,
  scanForHiddenDietaryViolations, violatesDietaryConstraints,
  buildForbiddenIngredients, scanForViolations,
} from "../allergyGuardrails";
import {
  answerNutritionPriorityEducationQuestion, getNutritionPriorityEducationEntries,
} from "../../../shared/nutritionPriorityEducation";
import {
  FOOD_INCLUSION_PRIORITY_REGISTRY, NUTRITION_PRIORITIES_REGISTRY_VERSION,
  NUTRITION_PRIORITY_EDUCATION_POLICY,
} from "../../../shared/nutritionPriorities";

const FoodDeclaration = z.object({
  mode: z.enum(["none", "discussion", "recommendations"]),
  foods: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    ingredients: z.array(z.string().trim().min(1).max(120)).max(24).nullable(),
    ingredientCoverage: z.enum(["listed", "incomplete", "unknown"]),
  }).strict()).max(5),
}).strict();

/** Each potentially displayed field has its own declaration. Never scan a
 * rejected offer as though it were part of the independent conversation. */
export const ChefFoodDeclarationsSchema = z.object({
  message: FoodDeclaration,
  conversationMessage: FoodDeclaration.nullable(),
  handoffMessage: FoodDeclaration.nullable(),
}).strict();

export const CHEF_FOOD_COMPATIBILITY_INSTRUCTIONS =
  "FOOD DECLARATIONS: For each response field, supply its own foodDeclarations entry. " +
  "Use mode=none and foods=[] for greetings, closing acknowledgements and explanations without proposed foods. " +
  "Use mode=discussion and foods=[] for examples being discussed, warnings and foods to avoid, not recommendations. " +
  "Use mode=recommendations for EVERY food or ingredient you actually suggest the member eat, buy or include; " +
  "list all such proposals in that field, including recommendations inside an answer or feature offer. " +
  "Never put an actual recommendation into a none/discussion field. List up to five proposals; " +
  "ingredients are proposed information, not verified real-world composition. Use null/unknown or incomplete " +
  "when full ingredients are not established; never invent missing ingredients. Unused response fields have null declarations. " +
  "No ingredient scan establishes allergy clearance, cross-contact safety or clinical suitability. " +
  "Use the supplied active Nutrition Priorities education only when relevant, preserve its limitations and source metadata, " +
  "and never infer that a member selected a priority, has a deficiency or follows an active medical protocol. " +
  "Known allergies and dietary/avoidance requirements outrank preferences and educational food examples.";

export interface ChefFoodCheck {
  status: "not_applicable" | "screened" | "blocked" | "unavailable";
  reasons: string[];
  uncertainties: string[];
}

function fieldValues(profile: MemberContextEvidence["profile"], key:
  "allergies" | "restrictions" | "avoidedFoods" | "dislikedFoods"): string[] | null {
  const fact = profile[key];
  if (!fact || !["known", "none"].includes(fact.status) || !Array.isArray(fact.value) ||
      fact.value.some(value => typeof value !== "string" || !value.trim())) return null;
  return fact.value;
}

/** Pure inspection only. No context resolver, database, model or prescription. */
export function inspectChefFoodDeclarations(
  raw: unknown, selectedField: string, context: Record<string, unknown>,
): ChefFoodCheck {
  const empty: ChefFoodCheck = { status: "not_applicable", reasons: [], uncertainties: [] };
  if (!["message", "conversationMessage", "handoffMessage"].includes(selectedField)) return empty;
  const parsed = ChefFoodDeclarationsSchema.safeParse(raw);
  if (!parsed.success) return { ...empty, status: "unavailable", reasons: ["food_declaration_invalid"] };
  const declaration = parsed.data[selectedField as keyof typeof parsed.data];
  if (!declaration || (declaration.mode === "recommendations") !== (declaration.foods.length > 0)) {
    return { ...empty, status: "unavailable", reasons: ["food_declaration_inconsistent"] };
  }
  if (declaration.mode !== "recommendations") return empty;

  const binding = context.chefFoodCompatibility as { subjectUserId?: string } | undefined;
  const snapshot = context.coachingContextSnapshot as CoachingContextSnapshot | undefined;
  if (!binding?.subjectUserId || snapshot?.subject?.userId !== binding.subjectUserId) {
    return { ...empty, status: "unavailable", reasons: ["member_evidence_subject_unavailable"] };
  }
  const profile = snapshot.memberEvidence?.profile;
  if (!profile) return { ...empty, status: "unavailable", reasons: ["member_evidence_unavailable"] };
  const allergies = fieldValues(profile, "allergies");
  const restrictions = fieldValues(profile, "restrictions");
  const avoided = fieldValues(profile, "avoidedFoods");
  const disliked = fieldValues(profile, "dislikedFoods");
  const reasons: string[] = [];
  const uncertainties = ["cross_contact_unverified", "clinical_suitability_not_assessed"];
  if (!allergies) uncertainties.push("allergies_unknown");
  if (!restrictions) uncertainties.push("dietary_restrictions_unknown");
  if (!avoided) uncertainties.push("avoidances_unknown");
  if (!disliked) uncertainties.push("dislikes_unknown");
  for (const food of declaration.foods) {
    const ingredients = food.ingredients ?? [];
    if (food.ingredientCoverage !== "listed" || !ingredients.length) uncertainties.push("ingredients_incomplete");
    const meal = { name: food.name, ingredients };
    const text = [food.name, ...ingredients].join(" | ");
    // Canonical aliases, no PIN exemptions or dish-name exemptions.
    const allergenScan = scanMealsForAllergenViolations([meal], (allergies ?? []).map(canonicalAllergenKey));
    reasons.push(...[...allergenScan.violations].map(term => `allergy:${term}`));
    for (const diet of restrictions ?? []) {
      reasons.push(...violatesDietaryConstraints(text, [diet]).reasons.map(term => `dietary:${diet}:${term}`));
      // getPrimaryDiet is intentionally narrower than the full restriction
      // registry. Include its canonical halal/kosher/etc. ingredient expansion.
      const forbidden = buildForbiddenIngredients({ allergies: [], dietaryRestrictions: [diet] });
      reasons.push(...scanForViolations(meal, forbidden).map(term => `dietary:${diet}:${term}`));
    }
    reasons.push(...scanForHiddenDietaryViolations(text, restrictions ?? [])
      .map(hit => `dietary:${hit.category}:${hit.term}`));
    // Preserve categories rather than using extractSafetyProfile's legacy OR
    // fallback or labelling an ordinary dislike as a medical allergy.
    for (const [category, values] of [["avoidance", avoided], ["dislike", disliked]] as const) {
      reasons.push(...scanForHiddenDietaryViolations(text, [], values ?? [])
        .map(hit => `${category}:${hit.term}`));
    }
  }
  return { status: reasons.length ? "blocked" : "screened",
    reasons: [...new Set(reasons)], uncertainties: [...new Set(uncertainties)] };
}

export function chefFoodCheckNotice(check: ChefFoodCheck): string {
  if (check.status === "blocked") {
    const labels: Record<string, string> = {
      allergy: "allergy restriction", dietary: "dietary requirement",
      avoidance: "food avoidance", dislike: "disliked-food preference",
    };
    const details = check.reasons.slice(0, 4).map(reason => {
      const [category, ...evidence] = reason.split(":");
      return `${labels[category] ?? "food requirement"} (${evidence.join(": ")})`;
    });
    return `I couldn't recommend those options because they conflict with your saved ${details.join("; ")}. We can consider a different option.`;
  }
  if (check.status === "unavailable") {
    return "I couldn't reliably check that reply against your food information. Please try again; no food recommendation has been verified.";
  }
  const notices: string[] = [];
  if (check.uncertainties.includes("allergies_unknown")) notices.push("Your allergy information is unconfirmed.");
  if (check.uncertainties.includes("ingredients_incomplete")) notices.push("Full ingredients aren't confirmed.");
  if (check.status === "screened") notices.push("Ingredient screening doesn't verify preparation, cross-contact or medical suitability.");
  return notices.join(" ");
}

/** Topic selection uses the existing education interpreter, not diagnosis
 * labels, inferred member selections or another model call. */
export function projectChefFoodEducation(question: string) {
  const answer = answerNutritionPriorityEducationQuestion(question, "adult");
  if (!answer) return null;
  const entries = getNutritionPriorityEducationEntries("adult")
    .filter(entry => entry.label === answer.title)
    .map(entry => {
      const definition = FOOD_INCLUSION_PRIORITY_REGISTRY[entry.id];
      return { ...entry, evidenceStatus: definition.evidenceStatus, lastReviewedOn: definition.lastReviewedOn };
    });
  return {
    source: "shared/nutritionPriorityEducation.ts",
    registryVersion: NUTRITION_PRIORITIES_REGISTRY_VERSION,
    explanationOnly: true,
    medicalBoundary: NUTRITION_PRIORITY_EDUCATION_POLICY.medicalBoundary,
    answer, entries,
  };
}
