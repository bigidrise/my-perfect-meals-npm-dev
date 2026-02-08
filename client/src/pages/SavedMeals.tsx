import { useState } from "react";
import { useLocation } from "wouter";
import { Heart, ChevronDown, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { useSavedMealsList, useToggleSavedMeal } from "@/hooks/useSavedMeals";
import { useToast } from "@/hooks/use-toast";
import MealCardActions from "@/components/MealCardActions";
import { setQuickView } from "@/lib/macrosQuickView";

const SOURCE_LABELS: Record<string, string> = {
  "meal-builder": "Meal Builder",
  "general-nutrition": "General Nutrition",
  "performance-competition": "Performance",
  "diabetic": "Diabetic",
  "glp1": "GLP-1",
  "anti-inflammatory": "Anti-Inflammatory",
  "craving-creator": "Craving Creator",
  "dessert-creator": "Dessert Creator",
  "fridge-rescue": "Fridge Rescue",
  "chefs-kitchen": "Chef's Kitchen",
  "weekly-board": "Weekly Board",
  unknown: "Meal",
};

function sourceLabel(s: string): string {
  return SOURCE_LABELS[s] || s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SavedMeals() {
  const [, setLocation] = useLocation();
  const { data: meals, isLoading } = useSavedMealsList();
  const toggle = useToggleSavedMeal();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRemove = (row: any) => {
    toggle.mutate(
      { title: row.title, sourceType: row.sourceType, mealData: row.mealData },
      {
        onSuccess: () => {
          toast({ title: "Removed", description: `"${row.title}" removed from favorites.` });
          if (expandedId === row.id) setExpandedId(null);
        },
      }
    );
  };

  const handleAddToMacros = (meal: any) => {
    const d = meal.mealData || meal;
    const protein = d.nutrition?.protein || d.protein || 0;
    const carbs = d.nutrition?.carbs || d.carbs || 0;
    const fat = d.nutrition?.fat || d.fat || 0;
    const starchyCarbs = d.nutrition?.starchyCarbs || d.starchyCarbs || 0;
    const fibrousCarbs = d.nutrition?.fibrousCarbs || d.fibrousCarbs || 0;
    const calories = d.nutrition?.calories || d.calories || (protein * 4 + carbs * 4 + fat * 9);

    setQuickView({
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      starchyCarbs: Math.round(starchyCarbs),
      fibrousCarbs: Math.round(fibrousCarbs),
      fat: Math.round(fat),
      calories: Math.round(calories),
      dateISO: new Date().toISOString().slice(0, 10),
      mealSlot: null,
    });
    setLocation("/biometrics?view=macros");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setLocation("/dashboard")} className="p-2 rounded-lg bg-white/10 active:scale-[0.98]">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500" fill="currentColor" />
            Saved Meals
          </h1>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        )}

        {!isLoading && (!meals || meals.length === 0) && (
          <div className="text-center py-16 space-y-3">
            <Heart className="h-12 w-12 mx-auto text-white/20" />
            <p className="text-white/50 text-lg">No saved meals yet</p>
            <p className="text-white/40 text-sm">Tap the heart icon on any meal to save it here.</p>
          </div>
        )}

        {meals && meals.length > 0 && (
          <div className="space-y-2">
            {meals.map((row) => {
              const isExpanded = expandedId === row.id;
              const d = row.mealData as any;
              const calories = d?.nutrition?.calories || d?.calories || 0;
              const protein = d?.nutrition?.protein || d?.protein || 0;
              const carbs = d?.nutrition?.carbs || d?.carbs || 0;
              const fat = d?.nutrition?.fat || d?.fat || 0;

              return (
                <div key={row.id} className="rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    className="w-full flex items-center justify-between px-4 py-3 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 text-left min-w-0">
                      <Heart className="h-5 w-5 text-red-500 shrink-0" fill="currentColor" />
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">{row.title}</div>
                        <div className="text-xs text-white/50">{sourceLabel(row.sourceType)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-white/40">{calories} cal</span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-white/40" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
                      {d?.imageUrl && (
                        <div className="rounded-lg overflow-hidden">
                          <img src={d.imageUrl} alt={row.title} className="w-full h-48 object-cover" />
                        </div>
                      )}

                      {d?.description && (
                        <p className="text-white/80 text-sm">{d.description}</p>
                      )}

                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-black/30 border border-white/15 p-2 rounded-lg">
                          <div className="text-xs text-white/50">Cal</div>
                          <div className="text-white font-bold">{Math.round(calories)}</div>
                        </div>
                        <div className="bg-black/30 border border-white/15 p-2 rounded-lg">
                          <div className="text-xs text-white/50">Protein</div>
                          <div className="text-white font-bold">{Math.round(protein)}g</div>
                        </div>
                        <div className="bg-black/30 border border-white/15 p-2 rounded-lg">
                          <div className="text-xs text-white/50">Carbs</div>
                          <div className="text-white font-bold">{Math.round(carbs)}g</div>
                        </div>
                        <div className="bg-black/30 border border-white/15 p-2 rounded-lg">
                          <div className="text-xs text-white/50">Fat</div>
                          <div className="text-white font-bold">{Math.round(fat)}g</div>
                        </div>
                      </div>

                      {d?.ingredients && d.ingredients.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-white/70 mb-2">Ingredients</h4>
                          <ul className="space-y-1">
                            {d.ingredients.map((ing: any, i: number) => (
                              <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                                <span className="text-white/30 mt-1">•</span>
                                <span>
                                  {typeof ing === "string"
                                    ? ing
                                    : `${ing.amount || ing.quantity || ""} ${ing.unit || ""} ${ing.name || ing.item || ""}`.trim()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {d?.instructions && (
                        <div>
                          <h4 className="text-sm font-semibold text-white/70 mb-2">Instructions</h4>
                          <ol className="space-y-1 list-decimal list-inside">
                            {(Array.isArray(d.instructions) ? d.instructions : [d.instructions]).map((step: string, i: number) => (
                              <li key={i} className="text-sm text-white/80">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          onClick={() => handleAddToMacros(row)}
                          className="flex-1 bg-blue-600 text-white text-sm py-2 px-3 rounded-lg active:scale-[0.98]"
                        >
                          Add to Macros
                        </button>
                        <button
                          onClick={() => handleRemove(row)}
                          className="bg-white/10 text-red-400 text-sm py-2 px-3 rounded-lg active:scale-[0.98] flex items-center gap-1"
                        >
                          <Heart className="h-4 w-4" fill="currentColor" />
                          Remove
                        </button>
                      </div>

                      <MealCardActions
                        meal={{
                          id: row.id,
                          name: row.title,
                          description: d?.description,
                          instructions: d?.instructions,
                          ingredients: d?.ingredients,
                          nutrition: d?.nutrition || { calories, protein, carbs, fat },
                          imageUrl: d?.imageUrl,
                          servings: d?.servings,
                          servingSize: d?.servingSize,
                        }}
                        source={row.sourceType}
                        showTranslate={true}
                        showPrepareButton={true}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
