import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wine } from "lucide-react";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";

import MealCardActions from "@/components/MealCardActions";

const LEAN_SOCIAL_TOUR_STEPS: TourStep[] = [
  { title: "Browse Smart Drinks", description: "Find lower-calorie drink options for social occasions." },
  { title: "See Details", description: "Tap any drink to see ingredients and how to order it." },
  { title: "Easy Strategies", description: "Use simple strategies to stay on track at parties and events." },
];

type Drink = {
  id: string;
  name: string;
  serve: string;
  kcal: string;
  carbs: string;
  how: string;
  image: string;
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
};

const DRINKS: Drink[] = [
  {
    id: "vodka-soda-lime",
    name: "Vodka Soda + Lime",
    serve: "1.5 oz + soda",
    kcal: "~100",
    carbs: "~0g",
    how: "Ask for extra lime; no juice.",
    image: "/images/alcohol/lean-and-social/vodka-soda-lime.jpg",
    ingredients: [
      { name: "Vodka", quantity: 1.5, unit: "oz" },
      { name: "Soda water", quantity: 6, unit: "oz" },
      { name: "Lime wedge", quantity: 2, unit: "whole" }
    ],
  },
  {
    id: "tequila-soda-lime",
    name: "Tequila Soda + Lime (Blanco)",
    serve: "1.5 oz + soda",
    kcal: "~100",
    carbs: "~0g",
    how: "Blanco tequila; skip agave.",
    image: "/images/alcohol/lean-and-social/tequila-soda-lime.jpg",
    ingredients: [
      { name: "Tequila blanco", quantity: 1.5, unit: "oz" },
      { name: "Soda water", quantity: 6, unit: "oz" },
      { name: "Lime wedge", quantity: 1, unit: "whole" }
    ],
  },
  {
    id: "gin-soda-cucumber",
    name: "Gin & Soda + Cucumber",
    serve: "1.5 oz + soda",
    kcal: "~100",
    carbs: "~0g",
    how: "Skip tonic; add cucumber.",
    image: "/images/alcohol/lean-and-social/gin-soda-cucumber.jpg",
    ingredients: [
      { name: "Gin", quantity: 1.5, unit: "oz" },
      { name: "Soda water", quantity: 6, unit: "oz" },
      { name: "Cucumber slices", quantity: 3, unit: "slices" }
    ],
  },
  {
    id: "whiskey-neat-rocks",
    name: "Whiskey Neat/Rocks",
    serve: "1.5 oz",
    kcal: "~105",
    carbs: "~0g",
    how: "Optional splash water.",
    image: "/images/alcohol/lean-and-social/whiskey-neat-rocks.jpg",
    ingredients: [
      { name: "Whiskey", quantity: 1.5, unit: "oz" },
      { name: "Ice", quantity: 1, unit: "cup" }
    ],
  },
  {
    id: "skinny-margarita",
    name: "Skinny Margarita",
    serve: "1.5 oz tequila + lime + soda",
    kcal: "~130–150",
    carbs: "~4–6g",
    how: "No sour mix; add bitters.",
    image: "/images/alcohol/lean-and-social/skinny-margarita.jpg",
    ingredients: [
      { name: "Tequila", quantity: 1.5, unit: "oz" },
      { name: "Fresh lime juice", quantity: 1, unit: "oz" },
      { name: "Soda water", quantity: 2, unit: "oz" },
      { name: "Angostura bitters", quantity: 2, unit: "dashes" }
    ],
  },
  {
    id: "paloma-lite",
    name: "Paloma Lite",
    serve: "tequila + grapefruit wedge + soda",
    kcal: "~110–130",
    carbs: "~2–4g",
    how: "No grapefruit soda.",
    image: "/images/alcohol/lean-and-social/paloma-lite.jpg",
    ingredients: [
      { name: "Tequila", quantity: 1.5, unit: "oz" },
      { name: "Fresh grapefruit wedge", quantity: 2, unit: "whole" },
      { name: "Soda water", quantity: 4, unit: "oz" }
    ],
  },
  {
    id: "rum-diet-cola",
    name: "Rum & Diet Cola",
    serve: "1.5 oz",
    kcal: "~100",
    carbs: "~0g",
    how: "Add lime (diet Cuba Libre).",
    image: "/images/alcohol/lean-and-social/rum-diet-cola.jpg",
    ingredients: [
      { name: "White rum", quantity: 1.5, unit: "oz" },
      { name: "Diet cola", quantity: 6, unit: "oz" },
      { name: "Lime wedge", quantity: 1, unit: "whole" }
    ],
  },
  {
    id: "vodka-unsweet-tea",
    name: "Vodka + Unsweet Iced Tea",
    serve: "1.5 oz",
    kcal: "~100–120",
    carbs: "~0–2g",
    how: "Unsweet tea; squeeze lemon.",
    image: "/images/alcohol/lean-and-social/vodka-unsweet-tea.jpg",
    ingredients: [
      { name: "Vodka", quantity: 1.5, unit: "oz" },
      { name: "Unsweetened iced tea", quantity: 6, unit: "oz" },
      { name: "Lemon wedge", quantity: 1, unit: "whole" }
    ],
  },
  {
    id: "dry-martini",
    name: "Dry Martini",
    serve: "2.5 oz spirit + dry vermouth",
    kcal: "~180–200",
    carbs: "~1–2g",
    how: "Small, slow sip.",
    image: "/images/alcohol/lean-and-social/dry-martini.jpg",
    ingredients: [
      { name: "Gin or vodka", quantity: 2.5, unit: "oz" },
      { name: "Dry vermouth", quantity: 0.5, unit: "oz" },
      { name: "Olives or lemon twist", quantity: 1, unit: "garnish" }
    ],
  },
  {
    id: "white-wine-spritzer",
    name: "Wine Spritzer (Dry White)",
    serve: "5 oz wine + soda",
    kcal: "~80–90",
    carbs: "~2–3g",
    how: "Tall glass; more soda.",
    image: "/images/alcohol/lean-and-social/white-wine-spritzer.jpg",
    ingredients: [
      { name: "Dry white wine", quantity: 5, unit: "oz" },
      { name: "Soda water", quantity: 5, unit: "oz" },
      { name: "Lemon slice", quantity: 1, unit: "whole" }
    ],
  },
  {
    id: "dry-white-wine",
    name: "Dry White Wine",
    serve: "5 oz",
    kcal: "~115–125",
    carbs: "~2–4g",
    how: "Ask for 'dry' varietals.",
    image: "/images/alcohol/lean-and-social/dry-white-wine.jpg",
    ingredients: [
      { name: "Dry white wine", quantity: 5, unit: "oz" }
    ],
  },
  {
    id: "dry-red-wine",
    name: "Dry Red Wine",
    serve: "5 oz",
    kcal: "~120–130",
    carbs: "~3–4g",
    how: "Pick drier styles (Pinot, Cab).",
    image: "/images/alcohol/lean-and-social/dry-red-wine.jpg",
    ingredients: [
      { name: "Dry red wine", quantity: 5, unit: "oz" }
    ],
  },
  {
    id: "brut-bubbles",
    name: "Brut Bubbles",
    serve: "5 oz prosecco/champagne",
    kcal: "~90–110",
    carbs: "~2–4g",
    how: "Say 'brut' for drier.",
    image: "/images/alcohol/lean-and-social/brut-bubbles.jpg",
    ingredients: [
      { name: "Brut prosecco or champagne", quantity: 5, unit: "oz" }
    ],
  },
  {
    id: "light-beer",
    name: "Light Beer",
    serve: "12 oz",
    kcal: "~90–110",
    carbs: "~3–7g",
    how: "Ask for light/session.",
    image: "/images/alcohol/lean-and-social/light-beer.jpg",
    ingredients: [
      { name: "Light beer", quantity: 12, unit: "oz" }
    ],
  },
  {
    id: "michelada-lite",
    name: "Michelada-Lite",
    serve: "light beer + lime + hot sauce",
    kcal: "~110–130",
    carbs: "~4–6g",
    how: "No premade mix.",
    image: "/images/alcohol/lean-and-social/michelada-lite.jpg",
    ingredients: [
      { name: "Light beer", quantity: 12, unit: "oz" },
      { name: "Fresh lime juice", quantity: 1, unit: "oz" },
      { name: "Hot sauce", quantity: 3, unit: "dashes" },
      { name: "Salt", quantity: 0.25, unit: "tsp" }
    ],
  },
  {
    id: "hard-seltzer-zero",
    name: "Hard Seltzer (Zero Sugar)",
    serve: "12 oz",
    kcal: "~90–100",
    carbs: "~2g",
    how: "Confirm zero sugar.",
    image: "/images/alcohol/lean-and-social/hard-seltzer-zero.jpg",
    ingredients: [
      { name: "Hard seltzer (zero sugar)", quantity: 12, unit: "oz" }
    ],
  },
  {
    id: "tequila-rocks-orange-peel",
    name: "Tequila Rocks + Orange Peel",
    serve: "1.5 oz",
    kcal: "~100–110",
    carbs: "~0g",
    how: "Aromatic without syrup.",
    image: "/images/alcohol/lean-and-social/tequila-rocks-orange-peel.jpg",
    ingredients: [
      { name: "Tequila", quantity: 1.5, unit: "oz" },
      { name: "Orange peel", quantity: 1, unit: "twist" },
      { name: "Ice", quantity: 1, unit: "cup" }
    ],
  },
  {
    id: "whiskey-highball",
    name: "Whiskey Highball",
    serve: "1.5 oz whiskey + soda",
    kcal: "~105",
    carbs: "~0g",
    how: "Tall glass; slow sip.",
    image: "/images/alcohol/lean-and-social/whiskey-highball.jpg",
    ingredients: [
      { name: "Whiskey", quantity: 1.5, unit: "oz" },
      { name: "Soda water", quantity: 6, unit: "oz" },
      { name: "Ice", quantity: 1, unit: "cup" }
    ],
  },
  {
    id: "aperol-spritz-lite",
    name: "Aperol Spritz-Lite",
    serve: "2 oz Aperol + prosecco + soda",
    kcal: "~140–160",
    carbs: "~10–12g",
    how: "Extra soda; light Aperol.",
    image: "/images/alcohol/lean-and-social/aperol-spritz-lite.jpg",
    ingredients: [
      { name: "Aperol", quantity: 2, unit: "oz" },
      { name: "Prosecco", quantity: 3, unit: "oz" },
      { name: "Soda water", quantity: 2, unit: "oz" },
      { name: "Orange slice", quantity: 1, unit: "whole" }
    ],
  },
  {
    id: "na-saver-soda-bitters-lime",
    name: "NA Saver: Soda + Bitters + Lime",
    serve: "12–16 oz",
    kcal: "0–10",
    carbs: "~0g",
    how: "No syrup; looks like a cocktail.",
    image: "/images/alcohol/lean-and-social/na-saver-soda-bitters-lime.jpg",
    ingredients: [
      { name: "Soda water", quantity: 14, unit: "oz" },
      { name: "Angostura bitters", quantity: 4, unit: "dashes" },
      { name: "Lime wedge", quantity: 2, unit: "whole" }
    ],
  },
];

export default function AlcoholLeanAndSocial() {
  const [, setLocation] = useLocation();
  const quickTour = useQuickTour("lean-and-social");
  const [selectedDrink, setSelectedDrink] = useState<string | null>(null);

  const selected = DRINKS.find(d => d.id === selectedDrink);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedDrink) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedDrink]);


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
            onClick={() => setLocation("/alcohol-hub")}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Title */}
          <h1 className="text-lg font-bold text-white">Lean & Social</h1>

          <div className="flex-grow" />
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>

      <div
        className="max-w-6xl mx-auto px-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >

        {/* Drinks Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {DRINKS.map((drink) => (
            <Card
              key={drink.id}
              data-testid="leansocial-card"
              className="cursor-pointer transform hover:scale-105 transition-all duration-200 bg-black/50 backdrop-blur-sm border border-rose-400/70 shadow-xl hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]"
              onClick={() => setSelectedDrink(drink.id)}
            >
              <div className="aspect-square overflow-hidden rounded-t-lg">
                <img
                  src={drink.image}
                  alt={drink.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/meal-placeholder.jpg';
                  }}
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-bold text-lg mb-2 text-white">{drink.name}</h3>
                <p className="text-sm text-white/80 mb-3">{drink.serve}</p>
                <div className="flex justify-between text-xs text-rose-200 font-semibold">
                  <span>{drink.kcal} cal</span>
                  <span>{drink.carbs} carbs</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail Modal */}
        {selected && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDrink(null)}
          >
            <Card
              data-testid="leansocial-detail"
              className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-black/50 border border-rose-400/70 shadow-[0_0_30px_rgba(244,63,94,0.2)]"
              onClick={(e) => e.stopPropagation()}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-3xl font-bold text-white">{selected.name}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDrink(null)}
                    className="text-rose-300 hover:text-white"
                  >
                    ✕
                  </Button>
                </div>

                <img
                  src={selected.image}
                  alt={selected.name}
                  className="w-full h-64 object-cover rounded-lg mb-4 border border-rose-500/30"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/meal-placeholder.jpg';
                  }}
                />

                <p className="text-white/90 mb-4 text-lg">{selected.serve}</p>

                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                  <div className="text-center">
                    <div className="font-bold text-2xl text-rose-300">{selected.kcal}</div>
                    <div className="text-sm text-white/70">calories</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-2xl text-rose-300">{selected.carbs}</div>
                    <div className="text-sm text-white/70">carbs</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="font-bold text-lg text-white">Ingredients</h3>
                    <MealCardActions
                      meal={{
                        name: selected.name,
                        ingredients: selected.ingredients.map(ing => ({
                          name: ing.name,
                          amount: String(ing.quantity),
                          unit: ing.unit
                        })),
                        instructions: [selected.how],
                      }}
                      showTranslate={false}
                    />
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {selected.ingredients.map((ingredient, idx) => (
                      <li key={idx} className="text-white/90">
                        {ingredient.quantity} {ingredient.unit} {ingredient.name}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-24">
                  <h3 className="font-bold text-lg mb-2 text-white">How to Mix</h3>
                  <p className="text-white/90 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                    {selected.how}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Shopping Bar - Fixed at bottom when modal is open */}
        {selected && (
          <ShoppingAggregateBar
            ingredients={selected.ingredients.map(ing => ({
              name: ing.name,
              qty: ing.quantity,
              unit: ing.unit
            }))}
            source={selected.name}
            sourceSlug="lean-and-social"
            hideCopyButton={true}
          />
        )}

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Lean & Social"
          steps={LEAN_SOCIAL_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />
      </div>
    </div>
  );
}