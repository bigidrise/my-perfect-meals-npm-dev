// client/src/pages/CravingPresets.tsx
import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, ChefHat, ArrowLeft } from "lucide-react";
import {
  CRAVING_PRESETS,
  type CravingPreset,
  type Ingredient,
} from "@/data/cravingsPresetsData";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import FavoriteButton from "@/components/FavoriteButton";

const SERVING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function roundQty(value: number): number {
  if (!isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function scaleQty(
  qty: number,
  fromServings: number,
  toServings: number,
): number {
  if (!fromServings || fromServings <= 0) return qty;
  return qty * (toServings / fromServings);
}

function formatQty(qty: number): string {
  const s = qty.toFixed(2);
  return parseFloat(s).toString();
}

function pluralize(unit: string | undefined, qty: number): string | undefined {
  if (!unit) return unit;
  const u = unit.trim();
  if (qty === 1) return u.replace(/s$/i, "");
  if (!/s$/i.test(u) && !/(oz|ml|g|kg|lb)$/i.test(u)) return `${u}s`;
  return u;
}

function scaledIngredient(
  ing: Ingredient,
  baseServings: number,
  toServings: number,
): Ingredient {
  const scaled = scaleQty(ing.quantity, baseServings, toServings);
  const rounded = roundQty(scaled);
  return { ...ing, quantity: rounded };
}

function scaleIngredients(
  ings: Ingredient[],
  baseServings: number,
  toServings: number,
): Ingredient[] {
  return ings.map((ing) => scaledIngredient(ing, baseServings, toServings));
}

const PRESETS_TOUR_STEPS: TourStep[] = [
  {
    title: "Set Your Servings",
    description:
      "Choose how many servings you’re making and your rounding preference so portions stay realistic.",
  },
  {
    title: "Browse Premade Meals",
    description:
      "Scroll through ready-made craving meals and tap any image to view ingredients, nutrition, and cooking instructions.",
  },
  {
    title: "Take Action",
    description:
      "Send ingredients to your shopping list, log your macros, or do both with a single tap.",
  },
];

export default function CravingPresetsPage() {
  const [, setLocation] = useLocation();
  const quickTour = useQuickTour("craving-presets");
  const [selectedServings, setSelectedServings] = useState<number>(2);
  const [filterText, setFilterText] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);

  // Auto-mark info as seen since Copilot provides guidance now
  useEffect(() => {
    if (!localStorage.getItem("hasSeenPresetsInfo")) {
      localStorage.setItem("hasSeenPresetsInfo", "true");
    }

    // Dispatch "ready" event after page loads (500ms debounce)
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "craving-premades-ready", event: "ready" },
      });
      window.dispatchEvent(event);
    }, 500);
  }, []);

  const meals = useMemo(() => {
    const q = filterText.trim().toLowerCase();

    const withFallback = CRAVING_PRESETS.map((m) => ({
      ...m,
      image: m.image ?? `/images/cravings/${m.id}.jpg`,
    }));

    if (!q) return withFallback;

    return withFallback.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.badges?.some((t) => t.toLowerCase().includes(q)) ?? false) ||
        (m.tags?.some((t) => t.toLowerCase().includes(q)) ?? false) ||
        (m.summary?.toLowerCase().includes(q) ?? false),
    );
  }, [filterText]);

  const selected = meals.find((m) => m.id === selectedMeal);
  const scaledIngs = selected
    ? scaleIngredients(
        selected.ingredients,
        selected.baseServings,
        selectedServings,
      )
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav">
      {/* Universal Safe-Area Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3 flex-nowrap">
          {/* Back Button */}
          <Button
            onClick={() => setLocation("/craving-creator-landing")}
            variant="ghost"
            className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </Button>

          {/* Title */}
          <h1
            data-testid="craving-premades-hero"
            className="text-lg font-bold text-white truncate min-w-0"
          >
            Premade Cravings
          </h1>

          <div className="flex-grow" />
          <QuickTourButton
            onClick={quickTour.openTour}
            className="flex-shrink-0"
          />
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-6xl mx-auto px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* Controls */}
        <Card
          data-testid="craving-premades-controls"
          className="mb-6 bg-black/50 backdrop-blur-sm border border-orange-400/70"
        >
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-lg text-white">Search meals</Label>
                <Input
                  placeholder="Search by name or tag…"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="bg-black/40 text-white border-white/20 placeholder:text-white/40"
                />
              </div>

              <div>
                <Label className="text-md text-white">Servings</Label>
                <div className="flex gap-2 flex-wrap">
                  {SERVING_OPTIONS.map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      onClick={() => setSelectedServings(n)}
                      className={
                        selectedServings === n
                          ? "bg-orange-600 text-white"
                          : "bg-black/60 border border-white/30 text-white hover:bg-black/80"
                      }
                    >
                      <Users className="w-4 h-4 mr-1" /> {n}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meals Grid */}
        <div
          data-testid="cravingpremades-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8"
        >
          {meals.map((meal, idx) => (
            <Card
              key={meal.id}
              data-testid="cravingpremades-card"
              className="cursor-pointer transform hover:scale-105 transition-all duration-200 bg-black/50 backdrop-blur-sm border border-orange-400/70 shadow-xl hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
              onClick={() => {
                setSelectedMeal(meal.id);

                // Dispatch "done" event after selecting a meal (500ms debounce)
                setTimeout(() => {
                  const event = new CustomEvent("walkthrough:event", {
                    detail: {
                      testId: "craving-premade-selected",
                      event: "done",
                    },
                  });
                  window.dispatchEvent(event);
                }, 500);
              }}
            >
              <div className="aspect-square overflow-hidden rounded-t-lg">
                <img
                  src={meal.image || `/images/cravings/${meal.id}.jpg`}
                  alt={meal.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/images/meal-placeholder.jpg";
                  }}
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-bold text-lg mb-2 text-white">
                  {meal.name}
                </h3>
                <p className="text-sm text-white/80 mb-3 line-clamp-2">
                  {meal.summary}
                </p>
                {meal.badges && (
                  <div className="flex items-center gap-2">
                    <HealthBadgesPopover badges={meal.badges} />
                    <h3 className="font-semibold text-white text-sm">Medical Safety</h3>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail Modal */}
        {selected && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedMeal(null)}
          >
            <Card
              data-testid="craving-premades-modal"
              className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-black/50 border border-orange-400/70 shadow-[0_0_30px_rgba(249,115,22,0.2)]"
              onClick={(e) => e.stopPropagation()}
            >
              <CardContent className="p-6 pb-32">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold text-white">
                      {selected.name}
                    </h2>
                    <FavoriteButton
                      title={selected.name}
                      sourceType="craving-premade"
                      mealData={{
                        name: selected.name,
                        description: selected.summary,
                        imageUrl: selected.image || `/images/cravings/${selected.id}.jpg`,
                        calories: selected.macros?.calories || 0,
                        protein: selected.macros?.protein || 0,
                        carbs: selected.macros?.carbs || 0,
                        fat: selected.macros?.fat || 0,
                        ingredients: selected.ingredients,
                        instructions: selected.instructions,
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMeal(null)}
                    className="text-orange-300 active:scale-[0.98]"
                  >
                    ✕
                  </Button>
                </div>

                <img
                  src={selected.image || `/images/cravings/${selected.id}.jpg`}
                  alt={selected.name}
                  className="w-full h-64 object-cover rounded-lg mb-4 border border-orange-500/30"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/images/meal-placeholder.jpg";
                  }}
                />

                <p className="text-white/90 mb-4">{selected.summary}</p>

                {/* Macros Grid */}
                {selected.macros && (
                  <div className="mb-4 grid grid-cols-4 gap-2 text-center">
                    <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                      <div className="text-lg font-bold text-white">
                        {Math.round((selected.macros.calories * selectedServings) / selected.baseServings)}
                      </div>
                      <div className="text-xs text-white/70">Calories</div>
                    </div>
                    <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                      <div className="text-lg font-bold text-white">
                        {Math.round((selected.macros.protein * selectedServings) / selected.baseServings)}g
                      </div>
                      <div className="text-xs text-white/70">Protein</div>
                    </div>
                    <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                      <div className="text-lg font-bold text-white">
                        {Math.round((selected.macros.carbs * selectedServings) / selected.baseServings)}g
                      </div>
                      <div className="text-xs text-white/70">Carbs</div>
                    </div>
                    <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                      <div className="text-lg font-bold text-white">
                        {Math.round((selected.macros.fat * selectedServings) / selected.baseServings)}g
                      </div>
                      <div className="text-xs text-white/70">Fat</div>
                    </div>
                  </div>
                )}

                {/* Medical Safety Badges */}
                {selected.badges && selected.badges.length > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <HealthBadgesPopover badges={selected.badges} />
                    <h3 className="font-semibold text-white text-sm">Medical Safety</h3>
                  </div>
                )}

                {/* Ingredients */}
                <div className="mb-4">
                  <h3 className="font-bold text-lg mb-2 text-white">
                    Ingredients (for {selectedServings}{" "}
                    {selectedServings === 1 ? "serving" : "servings"})
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {scaledIngs.map((ing, idx) => {
                      const unit = pluralize(ing.unit, ing.quantity);
                      return (
                        <li key={idx} className="text-white/90">
                          {formatQty(ing.quantity)} {unit} {ing.name}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Instructions */}
                {selected.instructions && selected.instructions.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-bold text-white mb-2">Instructions</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      {selected.instructions.map((instruction, idx) => (
                        <li key={idx} className="text-white/90">
                          {instruction}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Standardized 3-Row Button Layout */}
                <div className="space-y-2">
                  {/* Row 1: Add to Macros (full width) */}
                  <Button
                    onClick={() => setLocation("/biometrics?from=craving-presets&view=macros")}
                    className="w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white border border-white/30"
                  >
                    Add to Macros
                  </Button>

                  {/* Row 2: Add to Plan + Translate (50/50) */}
                  <div className="grid grid-cols-2 gap-2">
                    <AddToMealPlanButton
                      meal={{
                        id: selected.id,
                        name: selected.name,
                        description: selected.summary,
                        imageUrl: selected.image || `/images/cravings/${selected.id}.jpg`,
                        ingredients: scaledIngs.map((ing) => ({
                          name: ing.name,
                          amount: formatQty(ing.quantity),
                          unit: pluralize(ing.unit, ing.quantity) || "",
                        })),
                        instructions: selected.instructions,
                        calories: selected.macros
                          ? Math.round((selected.macros.calories * selectedServings) / selected.baseServings)
                          : 0,
                        protein: selected.macros
                          ? Math.round((selected.macros.protein * selectedServings) / selected.baseServings)
                          : 0,
                        carbs: selected.macros
                          ? Math.round((selected.macros.carbs * selectedServings) / selected.baseServings)
                          : 0,
                        fat: selected.macros
                          ? Math.round((selected.macros.fat * selectedServings) / selected.baseServings)
                          : 0,
                        medicalBadges: selected.badges || [],
                      }}
                    />
                    <TranslateToggle
                      content={{
                        name: selected.name,
                        description: selected.summary,
                        instructions: selected.instructions,
                      }}
                      onTranslate={() => {}}
                    />
                  </div>

                  {/* Row 3: Prepare with Chef + Share (50/50) */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold text-xs shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-1.5"
                      onClick={() => {
                        const mealData = {
                          id: selected.id,
                          name: selected.name,
                          description: selected.summary,
                          ingredients: scaledIngs.map((ing) => ({
                            name: ing.name,
                            amount: formatQty(ing.quantity),
                            unit: pluralize(ing.unit, ing.quantity) || "",
                          })),
                          instructions: selected.instructions,
                          imageUrl: selected.image || `/images/cravings/${selected.id}.jpg`,
                        };
                        localStorage.setItem("mpm_chefs_kitchen_meal", JSON.stringify(mealData));
                        localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
                        setLocation("/lifestyle/chefs-kitchen");
                      }}
                    >
                      
                      Cook w/ Chef
                    </Button>
                    <ShareRecipeButton
                      recipe={{
                        name: selected.name,
                        description: selected.summary,
                        nutrition: selected.macros,
                        ingredients: scaledIngs.map((ing) => ({
                          name: ing.name,
                          amount: formatQty(ing.quantity),
                          unit: pluralize(ing.unit, ing.quantity),
                        })),
                      }}
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Shopping Bar - Fixed at bottom when modal is open */}
        {selected && (
          <div data-testid="craving-premades-shopping-bar">
            <ShoppingAggregateBar
              ingredients={scaledIngs.map((ing) => ({
                name: ing.name,
                qty: ing.quantity,
                unit: ing.unit || "",
              }))}
              source={`${selected.name} (${selectedServings} servings)`}
              sourceSlug="craving-presets"
              hideShareButton={true}
              onAddComplete={() => {
                // Dispatch "done" event after adding to shopping list (500ms debounce)
                setTimeout(() => {
                  const event = new CustomEvent("walkthrough:event", {
                    detail: { testId: "craving-premade-added", event: "done" },
                  });
                  window.dispatchEvent(event);
                }, 500);
              }}
            />
          </div>
        )}

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Craving Premades"
          steps={PRESETS_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />
      </div>
    </div>
  );
}
