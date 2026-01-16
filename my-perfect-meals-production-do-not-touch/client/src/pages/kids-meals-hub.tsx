// client/src/pages/kids-meals-hub.tsx
import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, ChefHat, ArrowLeft } from "lucide-react";
import { kidsMeals, type KidsMeal } from "@/data/kidsMealsData";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import MealCardActions from "@/components/MealCardActions";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";

const KIDS_MEALS_TOUR_STEPS: TourStep[] = [
  { title: "Browse Meals", description: "Scroll through 21 kid-approved healthy meal options." },
  { title: "Adjust Servings", description: "Set your serving size to scale ingredient quantities." },
  { title: "View Details", description: "Tap any meal to see ingredients, nutrition, and cooking instructions." },
  { title: "Add to Shopping", description: "Use the shopping bar to add ingredients to your list." },
];

const SERVING_OPTIONS = [1, 2, 4, 6, 8] as const;

function roundQty(value: number): number {
  if (!isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function scaleQty(qty: number, fromServings: number, toServings: number): number {
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

type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
};

function scaledIngredient(
  ing: Ingredient,
  baseServings: number,
  toServings: number
): Ingredient {
  const scaled = scaleQty(ing.quantity, baseServings, toServings);
  const rounded = roundQty(scaled);
  return { ...ing, quantity: rounded };
}

function scaleIngredients(
  ings: Ingredient[],
  baseServings: number,
  toServings: number
): Ingredient[] {
  return ings.map((ing) => scaledIngredient(ing, baseServings, toServings));
}

export default function KidsMealsHub() {
  const [, setLocation] = useLocation();
  const quickTour = useQuickTour("kids-meals");
  const [selectedServings, setSelectedServings] = useState<number>(2);
  const [filterText, setFilterText] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);

  // Auto-mark info as seen since Copilot provides guidance now
  useEffect(() => {
    if (!localStorage.getItem("hasSeenKidsMealsInfo")) {
      localStorage.setItem("hasSeenKidsMealsInfo", "true");
    }
    
    // Phase C.7: Emit hub "opened" event after page loads
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "kids-hub-opened", event: "opened" },
      });
      window.dispatchEvent(event);
    }, 500);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedMeal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedMeal]);

  const meals = useMemo(() => {
    const q = filterText.trim().toLowerCase();

    const withFallback = kidsMeals.map((m) => ({
      ...m,
      image: m.image ?? `/images/kids-meals/${m.id}.jpg`,
    }));

    if (!q) return withFallback;

    return withFallback.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.healthBadges?.some((t) => t.toLowerCase().includes(q)) ?? false) ||
        m.description.toLowerCase().includes(q)
    );
  }, [filterText]);

  const selected = meals.find(m => m.id === selectedMeal);
  const scaledIngs = selected ? scaleIngredients(selected.ingredients, selected.baseServings, selectedServings) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav">
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => setLocation("/healthy-kids-meals")}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Title */}
          <h1 data-testid="kids-meals-hero" className="text-lg font-bold text-white">Kids Meals Hub</h1>

          <div className="flex-grow" />
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>

      <div
        className="max-w-6xl mx-auto px-4 sm:px-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >

        {/* Controls */}
        <Card data-testid="kids-meals-controls" className="mb-6 bg-black/50 backdrop-blur-sm border border-orange-400/70">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-lg text-white">Search meals</Label>
                <Input
                  data-wt="cp-search-input"
                  placeholder="Search by name or tag…"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="bg-black/40 text-white border-white/20 placeholder:text-white/40"
                />
              </div>

              <div>
                <Label className="text-md text-white">Servings</Label>
                <div data-wt="cp-servings-selector" className="flex gap-2 flex-wrap">
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
        <div data-testid="kids-meals-grid" data-wt="cp-meal-gallery" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {meals.map((meal, idx) => (
            <Card
              key={meal.id}
              data-testid="kidsmeals-card"
              className="cursor-pointer transform hover:scale-105 transition-all duration-200 bg-black/50 backdrop-blur-sm border border-orange-400/70 shadow-xl hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
              onClick={() => {
                setSelectedMeal(meal.id);
                
                // Dispatch "done" event after opening a meal (500ms debounce)
                setTimeout(() => {
                  const event = new CustomEvent("walkthrough:event", {
                    detail: { testId: "kids-meal-opened", event: "done" },
                  });
                  window.dispatchEvent(event);
                }, 500);
              }}
            >
              <div className="aspect-square overflow-hidden rounded-t-lg">
                <img
                  src={meal.image ?? `/images/kids-meals/${meal.id}.jpg`}
                  alt={meal.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/meal-placeholder.jpg';
                  }}
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-bold text-lg mb-2 text-white">{meal.name}</h3>
                <p className="text-sm text-white/80 mb-3 line-clamp-2">{meal.description}</p>
                <HealthBadgesPopover badges={meal.healthBadges} className="mt-2" />
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
              data-testid="kids-meals-modal"
              data-wt="cp-meal-card"
              className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-black/50 border border-orange-400/70 shadow-[0_0_30px_rgba(249,115,22,0.2)]"
              onClick={(e) => e.stopPropagation()}
            >
              <CardContent className="p-6 pb-32">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-3xl font-bold text-white">{selected.name}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMeal(null)}
                    className="text-orange-300 hover:text-white"
                  >
                    ✕
                  </Button>
                </div>

                <img
                  src={selected.image ?? `/images/kids-meals/${selected.id}.jpg`}
                  alt={selected.name}
                  className="w-full h-64 object-cover rounded-lg mb-4 border border-orange-500/30"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/meal-placeholder.jpg';
                  }}
                />

                <p className="text-white/90 mb-4">{selected.description}</p>

                {/* Action Buttons */}
                <div className="flex gap-2 mb-4">
                  <AddToMealPlanButton
                    meal={{
                      id: selected.id,
                      name: selected.name,
                      description: selected.description,
                      imageUrl: selected.image ?? `/images/kids-meals/${selected.id}.jpg`,
                      ingredients: scaledIngs.map(ing => ({
                        name: ing.name,
                        amount: formatQty(ing.quantity),
                        unit: pluralize(ing.unit, ing.quantity) || "",
                      })),
                      instructions: selected.instructions,
                    }}
                  />
                  <MealCardActions
                    meal={{
                      name: selected.name,
                      description: selected.description,
                      ingredients: scaledIngs.map(ing => ({
                        name: ing.name,
                        amount: formatQty(ing.quantity),
                        unit: pluralize(ing.unit, ing.quantity)
                      })),
                      instructions: selected.instructions,
                    }}
                  />
                </div>

                {/* Health Badges */}
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <HealthBadgesPopover badges={selected.healthBadges} />
                    <h3 className="font-bold text-lg text-white">Health Benefits</h3>
                  </div>
                </div>

                {/* Ingredients */}
                <div className="mb-4">
                  <h3 className="font-bold text-lg mb-2 text-white">
                    Ingredients (for {selectedServings} {selectedServings === 1 ? "child" : "children"})
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
                    <h3 className="font-bold text-lg mb-2 text-white">Cooking Instructions</h3>
                    <ol className="list-decimal list-inside space-y-1">
                      {selected.instructions.map((instruction, idx) => (
                        <li key={idx} className="text-white/90">{instruction}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Fun Fact */}
                {selected.funFact && (
                  <div className="mb-4 p-4 bg-orange-600/20 border border-orange-400/40 rounded-lg">
                    <h4 className="font-bold text-white mb-2">Fun Fact!</h4>
                    <p className="text-white/90 text-sm">{selected.funFact}</p>
                  </div>
                )}

                {/* Add to Macros */}
                <Button
                  onClick={() => setLocation("/biometrics?from=kids-meals&view=macros")}
                  className="w-full bg-black hover:bg-black/80 text-white flex items-center justify-center"
                >
                  Add to Macros
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Shopping Bar - Fixed at bottom when modal is open */}
        {selected && (
          <div data-testid="kids-meals-shopping-bar">
            <ShoppingAggregateBar
              ingredients={scaledIngs.map(ing => ({
                name: ing.name,
                qty: ing.quantity,
                unit: ing.unit
              }))}
              source={`${selected.name} (${selectedServings} servings)`}
              sourceSlug="kids-meals"
              hideShareButton={true}
              onAddComplete={() => {
                // Dispatch "done" event after adding to shopping list (500ms debounce)
                setTimeout(() => {
                  const event = new CustomEvent("walkthrough:event", {
                    detail: { testId: "kids-meal-added", event: "done" },
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
          title="How to Use Kids Meals"
          steps={KIDS_MEALS_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />
      </div>
    </div>
  );
}