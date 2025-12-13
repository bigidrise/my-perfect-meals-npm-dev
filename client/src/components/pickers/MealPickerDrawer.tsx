import React, { useState, useEffect, useRef } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import type { Meal } from "@/components/MealCard";
import { TEMPLATE_SETS } from "@/data/templateSets";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { cn } from "@/lib/utils";
import { mealIngredients } from "@/data/mealIngredients";
import { snackIngredients } from "@/data/snackIngredients";
import { fruitIngredients } from "@/data/fruitIngredients";
import { antiInflammatoryIngredients } from "@/data/antiInflammatoryIngredients";
import { antiInflammatorySnacks } from "@/data/antiInflammatory.snacks";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function matchesProfile(meal: Meal, profile: any){
  const allergies: string[] = (profile?.allergies || []).map((s:string)=>s.toLowerCase());
  const avoidBadges: string[] = (profile?.avoidBadges || []).map((s:string)=>s.toLowerCase());
  if (allergies.length && Array.isArray(meal.ingredients)) {
    for (const ing of meal.ingredients) {
      const name = (ing?.item || "").toLowerCase();
      if (!name) continue;
      // naive contains check; expand with your alias list if needed
      if (allergies.some(a => name.includes(a))) return false;
    }
  }
  if (avoidBadges.length && Array.isArray(meal.badges)) {
    for (const b of meal.badges) {
      if (avoidBadges.includes(String(b).toLowerCase())) return false;
    }
  }
  return true;
}

function pickFromTemplates(list: "breakfast"|"lunch"|"dinner"|"snacks"): Meal[] {
  return TEMPLATE_SETS[list];
}

// Category key normalization map
const CATEGORY_KEY_MAP: Record<string, string> = {
  "Proteins": "proteins",
  "Starchy Carbs": "starchyCarbs",
  "Fibrous Carbs": "fibrousCarbs",
  "Fats": "fats",
  "Fruit": "fruit"
};

export function MealPickerDrawer({
  open, list, onClose, onPick, useAntiInflammatory = false
}:{
  open: boolean;
  list: "breakfast"|"lunch"|"dinner"|"snacks"|null;
  onClose: ()=>void;
  onPick: (meal: Meal)=>void;
  useAntiInflammatory?: boolean;
}){
  const [loading, setLoading] = React.useState<"cafeteria"|"generate"|null>(null);
  const [templates, setTemplates] = React.useState<Meal[]>([]);
  const [showInfoModal, setShowInfoModal] = React.useState(false);
  const profile = useOnboardingProfile();
  const [activeCategory, setActiveCategory] = useState<
    "Proteins" | "Starchy Carbs" | "Fibrous Carbs" | "Fats" | "Fruit" | string | null
  >(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);

  // Cafeteria selection counter for deterministic rotation
  const cafeteriaCounterRef = useRef(0);

  // Cafeteria generation with deterministic selection and safe fallback
  async function generateFromCafeteria(list: "breakfast"|"lunch"|"dinner"|"snacks"): Promise<Meal[]> {
    // prefer profile-filtered pool, fall back to all, and if still empty → safe stub
    const filtered = TEMPLATE_SETS[list].filter(m => matchesProfile(m, profile));
    const base = (filtered.length ? filtered : TEMPLATE_SETS[list]);
    
    // Deterministic selection: rotate through templates based on counter
    const index = cafeteriaCounterRef.current % Math.max(base.length, 1);
    cafeteriaCounterRef.current++;
    let pick = base[index];

    if (!pick) {
      // last-resort stub to avoid UI failure
      pick = {
        id: "caf_stub",
        title: `Quick ${list} Meal`,
        servings: 1,
        ingredients: [{ item: "egg", amount: "2" }],
        instructions: ["Scramble eggs (2) 3–4 min."],
        nutrition: { calories: 140, protein: 12, carbs: 1, fat: 9 },
        badges: ["low-GI"],
      } as any;
    }

    // deep clone + stable id based on template + guards
    const meal: any = JSON.parse(JSON.stringify(pick));
    const stableId = simpleHash(`caf_${list}_${pick.id || pick.title}`);
    meal.id = `caf_${stableId.toString(36)}`;
    meal.ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
    meal.instructions = Array.isArray(meal.instructions) ? meal.instructions : [];
    meal.nutrition = meal.nutrition || { calories:0, protein:0, carbs:0, fat:0 };
    return [meal as Meal];
  }

  React.useEffect(() => {
    if (!list) return;
    const raw = pickFromTemplates(list);
    const filtered = raw.filter(m => matchesProfile(m, profile));
    setTemplates(filtered.length > 0 ? filtered : raw);
  }, [list, profile]);

  // Auto-expand first category when drawer opens
  React.useEffect(() => {
    if (open && list) {
      if (list === "snacks") {
        const firstSnackCategory = Object.keys(useAntiInflammatory ? antiInflammatorySnacks : snackIngredients)[0];
        setActiveCategory(firstSnackCategory as any);
      } else {
        // For breakfast, lunch, dinner - auto-expand "Proteins"
        setActiveCategory("Proteins");
      }
    } else {
      setActiveCategory(null);
    }
  }, [open, list, useAntiInflammatory]);

  if (!open || !list) return null;

  const toggleIngredient = (ingredientName: string) => {
    setSelectedIngredients((prev) => {
      const isSelected = prev.some((i) => i.toLowerCase() === ingredientName.toLowerCase());
      if (isSelected) {
        return prev.filter((i) => i.toLowerCase() !== ingredientName.toLowerCase());
      } else {
        return [...prev, ingredientName];
      }
    });
  };

  type IngredientSource = Record<string, string[] | any[]>;

  const ingredientSource: IngredientSource =
    list === "snacks"
      ? (useAntiInflammatory ? antiInflammatorySnacks : snackIngredients)
      : useAntiInflammatory
      ? antiInflammatoryIngredients
      : {
          Proteins: mealIngredients.proteins,
          "Starchy Carbs": mealIngredients.starchyCarbs,
          "Fibrous Carbs": mealIngredients.fibrousCarbs,
          Fats: mealIngredients.fats,
          Fruit: fruitIngredients,
        };

  console.log("🔍 ingredientSource keys:", Object.keys(ingredientSource));
  console.log("🔍 activeCategory:", activeCategory);
  console.log("🔍 Fruit ingredients count:", ingredientSource["Fruit"]?.length);

  const currentIngredients = activeCategory
    ? (ingredientSource[activeCategory] ?? []).slice().sort((a, b) => {
        const nameA = typeof a === "string" ? a : a.name;
        const nameB = typeof b === "string" ? b : b.name;
        return nameA.localeCompare(nameB);
      })
    : [];

  const handleCategorySelect = (category: string) => {
    setActiveCategory(category as any);
  };

  // For snacks: items are already complete snacks, not ingredients to combine
  const isSnackList = list === "snacks";

  return (
    <>
    <Drawer open={open} onOpenChange={(v)=>!v && onClose()}>
      <DrawerContent className="bg-zinc-900/95 border-zinc-800 text-white max-h-[75vh] sm:max-h-[90vh] rounded-t-2xl overflow-hidden flex flex-col">
        {/* Sticky header with iOS safe-area padding */}
        <div className="sticky top-0 z-10 backdrop-blur bg-zinc-900/90 border-b border-zinc-800 pt-2 sm:pt-[calc(env(safe-area-inset-top,0px)+12px)] px-3 sm:px-4 pb-2 sm:pb-3">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-sm sm:text-base font-semibold">Add to {list}</DrawerTitle>
            <button
              onClick={() => setShowInfoModal(true)}
              className="bg-lime-700 hover:bg-lime-800 border-2 border-lime-600 text-white rounded-xl w-5 h-5 flex items-center justify-center text-sm font-bold flash-border"
              aria-label="How to use Meal Picker"
            >
              ?
            </button>
          </div>

          <div className="mt-1.5 sm:mt-3 flex flex-col sm:flex-row gap-1.5 sm:gap-2">
            <div className="flex gap-1.5 sm:gap-2 flex-wrap">
              {!isSnackList && (
                <Button
                  size="sm"
                  disabled={selectedIngredients.length === 0 || !!loading}
                  onClick={async ()=>{
                    setLoading("generate");
                    // Create meal from selected ingredients with stable ID
                    const ingredientKey = selectedIngredients.sort().join('_');
                    const stableId = simpleHash(`gen_${list}_${ingredientKey}`);
                    const meal: Meal = {
                      id: `gen_${stableId.toString(36)}`,
                      title: selectedIngredients.join(', '),
                      servings: 1,
                      ingredients: selectedIngredients.map(ing => ({ item: ing, amount: '1 serving' })),
                      instructions: ['Prepare ingredients as desired'],
                      nutrition: { calories: 300, protein: 25, carbs: 20, fat: 10 }
                    };
                    setLoading(null);
                    onPick(meal);
                    setSelectedIngredients([]);
                  }}
                  className="bg-purple-600/80 hover:bg-purple-600 rounded-2xl text-xs sm:text-sm px-2 sm:px-3"
                  data-testid="button-generate"
                >
                  {loading==="generate" ? "Generating…" : `Generate${selectedIngredients.length > 0 ? ` (${selectedIngredients.length})` : ""}`}
                </Button>
              )}
              <Button
                size="sm"
                disabled={!!loading}
                onClick={async ()=>{ setLoading("cafeteria"); const [m] = await generateFromCafeteria(list); setLoading(null); onPick(m);} }
                className="bg-emerald-600/80 hover:bg-emerald-600 rounded-2xl text-xs sm:text-sm px-2 sm:px-3"
                data-testid="button-cafeteria"
              >
                {loading==="cafeteria" ? "Generating…" : "Cafeteria"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose} className="text-white/80 hover:bg-white/10 rounded-2xl text-xs sm:text-sm px-2 sm:px-3" data-testid="button-close">Close</Button>
            </div>
          </div>

          {/* Category Buttons */}
          <div className="mt-2">
            <div className="flex flex-nowrap overflow-x-auto space-x-2 w-full min-w-0 pb-2 overscroll-x-contain touch-pan-x">
            {(list === "snacks" ? Object.keys(useAntiInflammatory ? antiInflammatorySnacks : snackIngredients) : ["Proteins", "Starchy Carbs", "Fibrous Carbs", "Fats", "Fruit"] as const).map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategorySelect(cat)}
                  className={cn(
                    "flex-shrink-0 rounded-2xl px-3 py-1.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                    activeCategory === cat
                      ? "bg-lime-500 text-black shadow-md"
                      : "bg-white/10 hover:bg-white/20 text-white/80"
                  )}
                >
                  {cat}
                </button>
              )
            )}
            </div>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 sm:px-4 py-2 sm:py-4">
            {activeCategory && isSnackList && (
              // SNACKS: Single-column tappable list, immediate add
              <ul className="space-y-2">
              {currentIngredients.map((item) => {
                const itemName = typeof item === "string" ? item : item.name;
                return (
                  <li
                    key={itemName}
                    onClick={() => {
                      const stableId = simpleHash(`snack_${activeCategory}_${itemName}`);
                      const snackMeal: Meal = {
                        id: `snack_${stableId.toString(36)}`,
                        name: itemName,
                        title: itemName,
                        servings: 1,
                        ingredients: [itemName],
                        instructions: [],
                        nutrition: { calories: 150, protein: 10, carbs: 15, fat: 5 }
                      };
                      onPick(snackMeal);
                      onClose();
                    }}
                    className="cursor-pointer rounded-xl border border-white/15 bg-white/5 px-4 py-3 transition-all hover:border-emerald-400/50 hover:bg-emerald-500/10 text-white/90 hover:text-white"
                  >
                    {itemName}
                  </li>
                );
              })}
              </ul>
            )}

            {activeCategory && !isSnackList && (
              // MEALS: 2-column grid, select ingredients, then Generate
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {currentIngredients.map((item) => {
                const itemName = typeof item === "string" ? item : item.name;
                const isSelected = selectedIngredients.some(
                  (i) => i.toLowerCase() === itemName.toLowerCase()
                );
                const fruitItem = typeof item === "object" && "gi" in item ? item : null;

                return (
                  <li
                    key={itemName}
                    onClick={() => toggleIngredient(itemName)}
                    className={cn(
                      "cursor-pointer rounded-xl border px-3 py-2 transition-all flex items-center justify-between",
                      isSelected
                        ? "border-purple-400/50 bg-purple-500/20 text-white shadow-md"
                        : "border-white/15 bg-white/5 text-white/80 hover:border-purple-300/30 hover:bg-white/10"
                    )}
                  >
                    <span className="text-sm">{itemName}</span>
                    {fruitItem && (
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-md border ml-2 whitespace-nowrap",
                          fruitItem.gi === "Low GI"
                            ? "text-emerald-200 border-emerald-300/30 bg-emerald-500/10"
                            : "text-amber-200 border-amber-300/30 bg-amber-500/10"
                        )}
                        title={fruitItem.gi === "Low GI" ? "Lower glycemic impact" : "Regular GI"}
                      >
                        {fruitItem.gi}
                      </span>
                    )}
                  </li>
                );
              })}
              </ul>
            )}

            {!activeCategory && (
              <div className="px-3 sm:px-4 py-2 sm:py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={()=>{
                      // deep clone + stable id based on template
                      const clone: any = JSON.parse(JSON.stringify(t));
                      const stableId = simpleHash(`tpl_${list}_${t.id || t.title}`);
                      clone.id = `tpl_pick_${stableId.toString(36)}`;
                      if (!Array.isArray(clone.ingredients)) clone.ingredients = [];
                      if (!Array.isArray(clone.instructions)) clone.instructions = [];
                      if (!clone.nutrition) clone.nutrition = { calories:0, protein:0, carbs:0, fat:0 };
                      onPick(clone);
                    }}
                    className="text-left rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900/80 p-2 sm:p-3"
                    data-testid={`card-meal-${t.id}`}
                  >
                    <div className="text-white/90 font-medium text-xs sm:text-base">{t.title}</div>
                    <div className="text-white/60 text-xs mt-0.5 sm:mt-1">
                      {t.nutrition?.calories || 0} kcal · P {t.nutrition?.protein || 0} · C {t.nutrition?.carbs || 0} · F {t.nutrition?.fat || 0}
                    </div>
                    {t.badges?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.badges.map((b)=>(
                          <span key={b} className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded-full">
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>

    {/* Info Modal */}
    {showInfoModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-xl">
          <h3 className="text-xl font-bold text-white mb-4">How to Use Meal Picker</h3>

          <div className="space-y-4 text-white/90 text-sm">
            <p>Quick and easy way to add pre-made meals to your plan.</p>

            <ul className="space-y-2 text-white/80 text-sm">
              <li><strong className="text-white">Browse meals:</strong> Scroll through our curated meal templates</li>
              <li><strong className="text-white">Cafeteria option:</strong> Click "Cafeteria" for a quick random meal suggestion</li>
              <li><strong className="text-white">Click to add:</strong> Tap any meal card to add it instantly to your {list} slot</li>
              <li><strong className="text-white">Personalized:</strong> Meals are filtered based on your allergies and preferences</li>
            </ul>

            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="font-semibold text-white mb-1">💡 Tip:</p>
              <p className="text-white/70">
                Use the Cafeteria button when you want a quick healthy suggestion without browsing!
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