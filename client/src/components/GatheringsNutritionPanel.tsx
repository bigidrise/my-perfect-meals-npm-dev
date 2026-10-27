import { hasGatheringsNutrition } from "@shared/gatheringsNutrition";
import { creatorMealNutrition } from "@/lib/mealMacroSnapshot";

const REASONS: Record<string, string> = {
  frying_fat_retention_unknown: "The amount of frying fat retained in the food is unknown.",
  energy_macro_difference_requires_review: "The source calories and macros need review.",
  course_generation_failed: "No complete recipe was generated.",
};
export default function GatheringsNutritionPanel({ course }: { course: any }) {
  if (!hasGatheringsNutrition(course)) {
    const result = course.nutritionResult;
    return <div role="status" className="mb-4 rounded-lg border border-amber-400/30 p-3 text-sm text-white/80">
      <strong>{result?.status === "needs_review" ? "Nutrition needs review" : "Nutrition unavailable"}</strong>
      <p>{result?.reasons?.map((reason: string) =>
        REASONS[reason] ?? (reason.includes("source_unavailable") ? "The ingredient nutrition source was unavailable or its request budget was reached."
          : "An ingredient identity, quantity, or portion could not be verified.")).join(" ")
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
