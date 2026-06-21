import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Meal } from "@/components/MealCard";
import {
  getAthleteMealsByCategory,
  type AthleteMeal,
} from "@/data/athleteMeals";
import { Target } from "lucide-react";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// 🔄 Convert AthleteMeal to standard Meal
function convertAthleteMealToMeal(athleteMeal: AthleteMeal): Meal {
  const ingredients = [
    {
      item: athleteMeal.protein_source,
      amount: `${athleteMeal.protein_oz} oz`,
    },
    ...(athleteMeal.carb_source
      ? [{ item: athleteMeal.carb_source, amount: `${athleteMeal.carb_g}g` }]
      : []),
    ...athleteMeal.fibrous_source.map((veg: string) => ({
      item: veg,
      amount: "1 cup",
    })),
  ];

  const instructions = [
    `Grill or bake ${athleteMeal.protein_source} (${athleteMeal.protein_oz}oz)`,
    ...(athleteMeal.carb_source
      ? [`Prepare ${athleteMeal.carb_source} (${athleteMeal.carb_g}g)`]
      : []),
    ...(athleteMeal.fibrous_source.length
      ? [`Steam or grill ${athleteMeal.fibrous_source.join(", ")}`]
      : []),
    "Season to taste with low-sodium options",
  ];

  // Stable ID based on meal content
  const stableId = simpleHash(`athlete_${athleteMeal.id}_${athleteMeal.title}`);

  const totalCarbs = athleteMeal.macros.starchyCarbs + athleteMeal.macros.fibrousCarbs;

  return {
    id: `athlete_${stableId.toString(36)}`,
    title: athleteMeal.title,
    servings: 1,
    ingredients,
    instructions,
    nutrition: {
      calories: athleteMeal.macros.kcal,
      protein: athleteMeal.macros.protein,
      carbs: totalCarbs,
      fat: athleteMeal.macros.fat,
    },
    badges: athleteMeal.tags,
  };
}

const DEFAULT_CATEGORY = "poultry";

const CATEGORY_OPTIONS = [
  { value: "poultry", label: "🐔 Chicken & Turkey" },
  { value: "redmeat", label: "🥩 Red Meat" },
  { value: "fish", label: "🐟 Fillet Fish" },
  { value: "eggs_shakes", label: "🥚 Eggs & Shakes" },
] as const;

export function AthleteMealPickerDrawer({
  open,
  list,
  onClose,
  onPick,
  carbCycleState,
}: {
  open: boolean;
  list: "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6" | null;
  onClose: () => void;
  onPick: (meal: Meal) => void;
  carbCycleState?: { phase: string; carbTargetG: number } | null;
}) {
  const [category, setCategory] =
    React.useState<AthleteMeal["category"]>(DEFAULT_CATEGORY);
  const [showInfoModal, setShowInfoModal] = React.useState(false);

  const isCycleActive = carbCycleState?.phase === "low_carb" || carbCycleState?.phase === "refeed";
  const carbCap = isCycleActive ? (carbCycleState?.carbTargetG ?? 0) : 0;
  const carbCapSoft = Math.round(carbCap * 1.2);

  // Auto-expand first category when drawer opens
  React.useEffect(() => {
    if (open) {
      setCategory(DEFAULT_CATEGORY);
    }
  }, [open]);

  // Filter meals by selected category
  const filteredMeals = React.useMemo(() => {
    return getAthleteMealsByCategory(category);
  }, [category]);

  // State for the info modal, assuming it's defined elsewhere or not needed for this specific change
  // const [showInfoModal, setShowInfoModal] = React.useState(false);


  if (!open || !list) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-black/90 border border-white/20 text-white max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            🏆 Premade Athlete Meals - Add to {list}
            <button
              onClick={() => setShowInfoModal(true)}
              className="bg-lime-700 hover:bg-lime-800 border-2 border-lime-600 text-white rounded-xl w-5 h-5 flex items-center justify-center text-sm font-bold flash-border"
              aria-label="How to use Athlete Meal Builder"
            >
              ?
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Carb Budget Bar — shown when carb cycle is active */}
          {isCycleActive && carbCap > 0 && (
            <div className={`p-3 rounded-xl border ${carbCycleState?.phase === "refeed" ? "bg-green-950/30 border-green-500/30" : "bg-orange-950/30 border-orange-500/30"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-semibold ${carbCycleState?.phase === "refeed" ? "text-green-300" : "text-orange-300"}`}>
                  {carbCycleState?.phase === "refeed" ? "⚡ Refeed Day" : "🔄 Low-Carb Day"} — Carb Budget
                </span>
                <span className="text-white/60 text-xs font-semibold">{carbCap}g cap</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${carbCycleState?.phase === "refeed" ? "bg-green-400" : "bg-orange-400"}`}
                  style={{ width: "100%" }}
                />
              </div>
              <p className="text-white/40 text-xs mt-1.5">
                Meals exceeding {carbCapSoft}g carbs are dimmed
              </p>
            </div>
          )}

          {/* Category Selector */}
          <div className="bg-black/30 p-4 rounded-lg border border-white/10">
            <label className="text-white/80 text-sm mb-2 block">Select Protein Category:</label>
            <Select
              value={category}
              onValueChange={(val) =>
                setCategory(val as AthleteMeal["category"])
              }
            >
              <SelectTrigger className="w-full bg-black/60 border-white/20 text-white h-10 text-sm">
                <SelectValue>
                  {CATEGORY_OPTIONS.find((opt) => opt.value === category)
                    ?.label ?? "Select Category"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900/95 border-white/20 text-white">
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-white/10 focus:bg-white/20 cursor-pointer"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meal Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredMeals.map((am: AthleteMeal) => {
              const mealTotalCarbs = am.macros.starchyCarbs + am.macros.fibrousCarbs;
              const overBudget = isCycleActive && carbCapSoft > 0 && mealTotalCarbs > carbCapSoft;
              return (
                <button
                  key={am.id}
                  onClick={() => {
                    const mealToAdd = convertAthleteMealToMeal(am);
                    onPick(mealToAdd);
                  }}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    overBudget
                      ? "border-white/10 bg-black/30 opacity-50"
                      : "border-white/20 bg-black/50 active:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-white/90 font-medium text-sm flex-1 leading-tight">
                      {am.title.includes('(') ? (
                        <>
                          {am.title.split('(')[0].trim()}
                          <br />
                          <span className="text-xs text-white/70">({am.title.split('(')[1]}</span>
                        </>
                      ) : (
                        am.title
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                      {am.includeCarbs ? (
                        <Badge className="bg-green-600/80 text-white text-[10px] px-2 py-0.5">
                          Carbs
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-600/80 text-white text-[10px] px-2 py-0.5">
                          P+V
                        </Badge>
                      )}
                      {overBudget && (
                        <Badge className="bg-red-900/60 text-red-300 text-[9px] px-2 py-0.5 border border-red-500/30">
                          Over cap
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-white/70 text-xs mb-1 leading-tight">
                    {am.protein_source} ({am.protein_oz}oz)
                    {am.carb_source && ` • ${am.carb_source} (${am.carb_g}g)`}
                  </div>

                  <div className="text-white/90 text-xs font-semibold leading-tight">
                    {am.macros.kcal} kcal · P{am.macros.protein} · C
                    {mealTotalCarbs} · F{am.macros.fat}
                  </div>

                  {am.tags?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {am.tags.slice(0, 2).map((tag: string) => (
                        <span
                          key={tag}
                          className="text-[9px] bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full leading-none"
                        >
                          {tag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Info Note */}
          <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-start gap-2 mb-2">
              <Target className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-400 mb-1">Premade Athlete Meals</p>
                <p className="text-white/80 text-xs mb-2">
                  Pre-designed meals optimized for athletic performance and muscle building.
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs text-white/70 ml-2">
                  <li>Select your protein category (Chicken, Red Meat, Fish, Eggs)</li>
                  <li>Meals are tagged with "Carbs" or "P+V" (Protein + Veggies)</li>
                  <li>Click any meal to add it to your board instantly</li>
                  <li>All macros are pre-calculated and ready to track</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Info Modal */}
    {showInfoModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-xl">
          <h3 className="text-xl font-bold text-white mb-4">How to Use Athlete Meal Builder</h3>

          <div className="space-y-4 text-white/90 text-sm">
            <p>Pre-designed meals optimized for athletic performance and muscle building.</p>

            <div>
              <h4 className="font-semibold text-white mb-2">Steps:</h4>
              <ul className="space-y-2 text-white/80 text-sm">
                <li><strong className="text-white">Select your protein category</strong> (Chicken, Red Meat, Fish, Eggs)</li>
                <li><strong className="text-white">Meals are tagged</strong> with "Carbs" or "P+V" (Protein + Veggies)</li>
                <li><strong className="text-white">Click any meal</strong> to add it to your board instantly</li>
                <li><strong className="text-white">All macros</strong> are pre-calculated and ready to track</li>
              </ul>
            </div>

            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="font-semibold text-white mb-1">💡 Tip:</p>
              <p className="text-white/70">
                Choose meals based on your daily carb targets - use "Carbs" meals when you need energy, and "P+V" meals for lower-carb days!
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowInfoModal(false)}
            className="mt-6 w-full bg-lime-700 hover:bg-lime-800 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            got it!
          </button>
        </div>
      </div>
    )}
    </>
  );
}