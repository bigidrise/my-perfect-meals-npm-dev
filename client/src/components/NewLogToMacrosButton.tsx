import { Button } from "@/components/ui/button";
import { logMacros } from "@/lib/logMacros";

export function NewLogToMacrosButton({
  meal,
  source = "craving_creator",
  defaultMealType = "lunch",
  onSuccess,
  onError,
}: {
  meal: any;
  source?: string;
  defaultMealType?: "breakfast" | "lunch" | "dinner" | "snack";
  onSuccess?: () => void;
  onError?: (err: any) => void;
}) {
  async function onClick() {
    try {
      await logMacros({
        calories: meal.nutrition?.calories || meal.calories || 0,
        protein: meal.nutrition?.protein_g || meal.protein || 0,
        carbohydrates: meal.nutrition?.carbs_g || meal.carbs || 0,
        fat: meal.nutrition?.fat_g || meal.fat || 0,
        starchyCarbs: meal.nutrition?.starchyCarbs ?? meal.starchyCarbs ?? null,
        fibrousCarbs: meal.nutrition?.fibrousCarbs ?? meal.fibrousCarbs ?? null,
        source,
        title: meal.name || meal.title || "Meal",
        mealId: meal.id,
        mealType: defaultMealType,
      });
      onSuccess?.();
    } catch (e) {
      console.error("LogToMacros error", e);
      onError?.(e);
    }
  }

  return (
    <Button onClick={onClick} className="bg-teal-600 hover:bg-teal-700 overflow-hidden text-ellipsis whitespace-nowrap">
      Log to Macros
    </Button>
  );
}
