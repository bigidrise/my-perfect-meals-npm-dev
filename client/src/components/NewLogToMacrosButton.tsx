import { Button } from "@/components/ui/button";
import { normalizeMealToMacros } from "@/utils/normalizeMealToMacros";
import { getApiUrl } from "@/lib/apiBase";

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
      const res = await fetch(getApiUrl("/api/biometrics/log"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_iso: new Date().toISOString().split('T')[0],
          meal_type: defaultMealType,
          calories_kcal: meal.nutrition?.calories || meal.calories || 0,
          protein_g: meal.nutrition?.protein_g || meal.protein || 0,
          carbs_g: meal.nutrition?.carbs_g || meal.carbs || 0,
          fat_g: meal.nutrition?.fat_g || meal.fat || 0,
          starchy_carbs_g: meal.nutrition?.starchyCarbs || meal.starchyCarbs || 0,
          fibrous_carbs_g: meal.nutrition?.fibrousCarbs || meal.fibrousCarbs || 0,
          source: source,
          title: meal.name || meal.title || "Meal",
          meal_id: meal.id
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Biometrics log failed: ${res.status} ${txt}`);
      }
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