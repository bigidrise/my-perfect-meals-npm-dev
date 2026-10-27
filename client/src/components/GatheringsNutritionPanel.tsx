import { hasGatheringsNutrition } from "@shared/gatheringsNutrition";
import { creatorMealNutrition } from "@/lib/mealMacroSnapshot";

const REASONS: Record<string, string> = {
  frying_fat_retention_unknown: "The amount of frying fat retained in the food is unknown.",
  energy_macro_difference_requires_review: "The source calories and macros need review.",
  course_generation_failed: "No complete recipe was generated.",
};

function reviewExplanation(reason: string, course: any): string {
  if (REASONS[reason]) return REASONS[reason];
  const match = /^ingredient\.(\d+)\.([a-z_]+)$/.exec(reason);
  if (!match) return "The recipe nutrition could not be verified.";
  const index = Number(match[1]);
  const ingredient = course.ingredients?.[index];
  const label = ingredient?.originalText || ingredient?.displayText || ingredient?.name;
  const name = typeof label === "string" && label.trim() ? label.trim() : `Ingredient ${index + 1}`;
  const explanations: Record<string, string> = {
    quantity_unresolved: "The quantity or measurement unit could not be verified.",
    identity_unresolved: "A matching USDA food record could not be verified for this ingredient and preparation.",
    portion_unresolved: "No compatible USDA portion weight was found for this measurement and preparation.",
    fat_consumption_unresolved: "The amount of cooking fat actually eaten is unknown.",
    source_unavailable_or_budget: "The USDA source was unavailable or the lookup limit was reached.",
    calories_missing: "The USDA record does not provide usable calorie data.",
    protein_missing: "The USDA record does not provide usable protein data.",
    carbs_missing: "The USDA record does not provide usable carbohydrate data.",
    fat_missing: "The USDA record does not provide usable fat data.",
  };
  return `${name}: ${explanations[match[2]] ?? "The ingredient nutrition could not be verified."}`;
}

export default function GatheringsNutritionPanel({ course }: { course: any }) {
  if (!hasGatheringsNutrition(course)) {
    const result = course.nutritionResult;
    return <div role="status" className="mb-4 rounded-lg border border-amber-400/30 p-3 text-sm text-white/80">
      <strong>{result?.status === "needs_review" ? "Nutrition needs review" : "Nutrition unavailable"}</strong>
      <p>{result?.reasons?.map((reason: string) => reviewExplanation(reason, course)).join(" ")
        || "This older result has no ingredient-backed calculation. Generate a new gathering to calculate nutrition."}</p>
      <p className="mt-1 text-xs">Nutrition actions are unavailable; unknown values will not be logged as zero.</p>
    </div>;
  }
  const portion = creatorMealNutrition(course);
  return <div className="mb-4">
    <p className="text-xs text-white/70 text-center mb-2">
      Recipe makes {course.servings} servings. Ingredient-backed estimates below are for one serving.
    </p>
    <div className="grid grid-cols-4 gap-4 text-center">
      {(["calories", "protein", "carbs", "fat"] as const).map(key =>
        <div key={key} className="bg-black/40 border border-white/20 p-3 rounded-md text-white">
          <div className="text-lg font-bold">{Math.round(portion[key])}{key === "calories" ? "" : "g"}</div>
          <div className="text-xs">{key === "calories" ? "Calories" : key}</div>
        </div>)}
    </div>
    {course.nutritionResult.assumptions.map((note: string, index: number) =>
      <p key={index} className="mt-2 text-xs text-white/60">{note}</p>)}
  </div>;
}
