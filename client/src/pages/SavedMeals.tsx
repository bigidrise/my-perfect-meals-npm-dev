import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Heart, ChevronDown, ChevronRight, ArrowLeft, Loader2, Activity } from "lucide-react";
import { useSavedMealsList, useDeleteSavedMeal } from "@/hooks/useSavedMeals";
import { useToast } from "@/hooks/use-toast";
import MealCardActions from "@/components/MealCardActions";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import { setQuickView } from "@/lib/macrosQuickView";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { buildBiometricsUrl } from "@/lib/biometricsNavigation";

const SOURCE_LABELS: Record<string, string> = {
  "meal-builder": "Meal Builder",
  "general-nutrition": "General Nutrition",
  "performance-competition": "Performance",
  "diabetic": "Diabetic",
  "glp1": "Metabolic Med",
  "anti-inflammatory": "Anti-Inflammatory",
  "craving-creator": "Craving Creator",
  "dessert-creator": "Dessert Creator",
  "fridge-rescue": "Fridge Rescue",
  "chefs-kitchen": "Create a Dish",
  "weekly-board": "Weekly Board",
  "pairings-ai": "Drink Pairings",
  "wine-list-helper": "Wine List Helper",
  "my-inspiration": "My Inspirations",
  unknown: "Meal",
};

function sourceLabel(s: string): string {
  return SOURCE_LABELS[s] || s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function bglRangeLabel(bucket: string): string {
  switch (bucket) {
    case "low":      return "< 70 mg/dL";
    case "in-range": return "70–140 mg/dL";
    case "elevated": return "141–200 mg/dL";
    case "high":     return "> 200 mg/dL";
    default:         return "—";
  }
}

const BGL_SECTIONS = [
  {
    key: "low",
    label: "Low BGL Meals",
    sublabel: "Generated under low glucose conditions (< 70 mg/dL)",
    accent: "text-sky-400",
    border: "border-sky-700/40",
    bg: "bg-sky-950/60",
    dot: "bg-sky-400",
    buckets: ["low"],
  },
  {
    key: "in-range",
    label: "In-Range BGL Meals",
    sublabel: "Generated within normal glucose range (70–140 mg/dL)",
    accent: "text-lime-400",
    border: "border-lime-700/40",
    bg: "bg-lime-950/60",
    dot: "bg-lime-400",
    buckets: ["in-range"],
  },
  {
    key: "elevated",
    label: "Elevated / High BGL Meals",
    sublabel: "Generated under elevated glucose conditions (> 140 mg/dL)",
    accent: "text-amber-400",
    border: "border-amber-700/40",
    bg: "bg-amber-950/60",
    dot: "bg-amber-400",
    buckets: ["elevated", "high"],
  },
] as const;

export default function SavedMeals() {
  const [, setLocation] = useLocation();
  const { data: meals, isLoading } = useSavedMealsList();
  const deleteMeal = useDeleteSavedMeal();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Capture the ?from= param once on mount — useState initializer runs only
  // once so re-renders don't see the stripped URL and lose the value.
  const [returnPath] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("from")
  );

  // Strip the param from the URL after mount so it doesn't linger on
  // refresh, bookmark, or share.
  useEffect(() => {
    if (returnPath) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [returnPath]);

  const handleAddToPlanSuccess = returnPath
    ? () => setLocation(decodeURIComponent(returnPath))
    : undefined;

  const handleRemove = (row: any) => {
    deleteMeal.mutate(row.id, {
      onSuccess: () => {
        toast({ title: "Removed", description: `"${row.title}" removed from favorites.` });
        if (expandedId === row.id) setExpandedId(null);
      },
    });
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
    setLocation(buildBiometricsUrl({ section: "macros", from: "saved-meals", highlight: true }));
  };

  const renderMealCard = (row: any) => {
    const isExpanded = expandedId === row.id;
    const d = row.mealData as any;
    const calories = d?.nutrition?.calories || d?.calories || 0;
    const protein = d?.nutrition?.protein || d?.protein || 0;
    const carbs = d?.nutrition?.carbs || d?.carbs || 0;
    const fat = d?.nutrition?.fat || d?.fat || 0;

    const isDiabetic = row.savedFromDiabeticBuilder === true;
    const bglBucket: string = row.bglBucket ?? "";
    const generatedBglMgdl: number | null = row.generatedBglMgdl ?? null;
    const glucoseContext: string = row.glucoseContext ?? "";
    const protocolType: string = row.protocolType ?? "";
    const rangeLabel = bglBucket ? bglRangeLabel(bglBucket) : "";

    const bannerAccent =
      bglBucket === "low"      ? { text: "text-sky-400",  border: "border-sky-700/40",  bg: "bg-sky-950/60" }
      : bglBucket === "in-range" ? { text: "text-lime-400",  border: "border-lime-700/40",  bg: "bg-lime-950/60" }
      : { text: "text-amber-400", border: "border-amber-700/40", bg: "bg-amber-950/60" };

    return (
      <div key={row.id} className="rounded-xl border border-white/15 bg-white/5 overflow-hidden">
        <button
          onClick={() => setExpandedId(isExpanded ? null : row.id)}
          className="w-full flex items-center justify-between px-3 py-3 active:scale-[0.98]"
        >
          <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white/10 mr-3">
            <MealImageSlot
              imageUrl={d?.imageUrl}
              mealName={row.title}
              height="h-14"
              className="!mb-0 !rounded-none"
            />
          </div>
          <div className="flex items-center gap-2 text-left min-w-0 flex-1">
            <div className="min-w-0">
              <div className="text-white font-medium truncate">{row.title}</div>
              <div className="text-xs text-white/50">{sourceLabel(row.sourceType)}</div>
              {isDiabetic && generatedBglMgdl !== null && (
                <div className={`text-xs ${bannerAccent.text} flex items-center gap-1 mt-0.5 opacity-80`}>
                  <Activity className="h-3 w-3 shrink-0" />
                  <span>BGL {generatedBglMgdl} mg/dL</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Heart className="h-4 w-4 text-red-500 shrink-0" fill="currentColor" />
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
            <MealImageSlot
              imageUrl={d?.imageUrl}
              mealName={row.title}
              height="h-52"
            />

            {isDiabetic && generatedBglMgdl !== null && (
              <div className={`rounded-lg ${bannerAccent.bg} border ${bannerAccent.border} px-3 py-2 text-xs space-y-0.5`}>
                <div className={`${bannerAccent.text} font-semibold tracking-wide uppercase text-[10px]`}>
                  Diabetes Protocol
                </div>
                <div className="text-white/80">
                  Generated for BGL:{" "}
                  <span className="text-white font-medium">{generatedBglMgdl} mg/dL</span>
                </div>
                {protocolType && (
                  <div className="text-white/60">{protocolType}</div>
                )}
                {glucoseContext && protocolType !== glucoseContext && (
                  <div className="text-white/50">{glucoseContext}</div>
                )}
                {rangeLabel && (
                  <div className="text-white/50 text-[10px]">Relevant range: {rangeLabel}</div>
                )}
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
                <ol className="space-y-3">
                  {normalizeInstructions(d.instructions).map((step: string, i: number) => (
                    <li key={i} className="flex gap-3 text-sm text-white/80">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/70 flex items-center justify-center text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <AddToMealPlanButton
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
                onSuccess={handleAddToPlanSuccess}
              />
              <button
                onClick={() => handleAddToMacros(row)}
                className="flex-1 bg-white/10 text-white text-sm py-2 px-3 rounded-lg active:scale-[0.98]"
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
  };

  const allMeals = meals ?? [];
  const diabeticMeals = allMeals.filter((r: any) => r.savedFromDiabeticBuilder === true);
  const otherMeals = allMeals.filter((r: any) => r.savedFromDiabeticBuilder !== true);

  const hasDiabetic = diabeticMeals.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white pb-24 flex flex-col">
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/dashboard")} className="p-2 rounded-lg bg-white/10 active:scale-[0.98]">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2 flex-1">
            <Heart className="h-6 w-6 text-red-500" fill="currentColor" />
            Saved Meals
          </h1>
        </div>
      </div>
      </MobileHeaderGuard>

      <div
        className="max-w-lg mx-auto px-4 space-y-4 w-full"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        )}

        {!isLoading && allMeals.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <Heart className="h-12 w-12 mx-auto text-white/20" />
            <p className="text-white/50 text-lg">No saved meals yet</p>
            <p className="text-white/40 text-sm">Tap the heart icon on any meal to save it here.</p>
          </div>
        )}

        {!isLoading && allMeals.length > 0 && (
          <div className="space-y-6">

            {hasDiabetic && BGL_SECTIONS.map((section) => {
              const sectionMeals = diabeticMeals.filter((r: any) =>
                section.buckets.includes(r.bglBucket as any)
              );
              if (sectionMeals.length === 0) return null;
              return (
                <div key={section.key} className="space-y-2">
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <span className={`w-2 h-2 rounded-full ${section.dot} shrink-0`} />
                    <div>
                      <div className={`text-sm font-semibold ${section.accent}`}>{section.label}</div>
                      <div className="text-xs text-white/40">{section.sublabel}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {sectionMeals.map((row: any) => renderMealCard(row))}
                  </div>
                </div>
              );
            })}

            {otherMeals.length > 0 && (
              <div className="space-y-2">
                {hasDiabetic && (
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <span className="w-2 h-2 rounded-full bg-white/30 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-white/60">Other Saved Meals</div>
                      <div className="text-xs text-white/40">Meals from all other builders</div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {otherMeals.map((row: any) => renderMealCard(row))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
