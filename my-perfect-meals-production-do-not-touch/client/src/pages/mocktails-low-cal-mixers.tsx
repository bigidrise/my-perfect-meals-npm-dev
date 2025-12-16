import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Sparkles } from "lucide-react";
import { mocktailsData } from "@/data/mocktailsData";
import { useState, useEffect } from "react";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import CopyRecipeButton from "@/components/CopyRecipeButton";

export default function MocktailsLowCalMixersPage() {
  const [, setLocation] = useLocation();
  const [selectedMocktail, setSelectedMocktail] = useState<string | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedMocktail) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedMocktail]);

  const selected = mocktailsData.find((m) => m.id === selectedMocktail);

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
          <h1 className="text-lg font-bold text-white">Mocktails & Mixers</h1>

          
        </div>
      </div>

      <div
        className="max-w-6xl mx-auto px-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >

        {/* Mocktails Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {mocktailsData.map((mocktail) => (
            <Card
              key={mocktail.id}
              data-testid="mocktails-card"
              className="cursor-pointer transform hover:scale-105 transition-all duration-200 bg-black/50 backdrop-blur-sm border border-emerald-400/70 shadow-xl hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              onClick={() => setSelectedMocktail(mocktail.id)}
            >
              <div className="aspect-square overflow-hidden rounded-t-lg">
                <img
                  src={mocktail.image}
                  alt={mocktail.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/images/meal-placeholder.jpg";
                  }}
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-bold text-lg mb-2 text-white">
                  {mocktail.name}
                </h3>
                <p className="text-sm text-white/80 mb-3">
                  {mocktail.description}
                </p>
                <div className="flex justify-between text-xs text-emerald-200 font-semibold">
                  <span>{mocktail.calories} cal</span>
                  <span>{mocktail.carbs} carbs</span>
                  <span>{mocktail.sugar} sugar</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail Modal */}
        {selected && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedMocktail(null)}
          >
            <Card
              className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-black/50 border border-emerald-400/70 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
              onClick={(e) => e.stopPropagation()}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-3xl font-bold text-white">
                    {selected.name}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMocktail(null)}
                    className="text-emerald-300 hover:text-white"
                  >
                    ✕
                  </Button>
                </div>

                <img
                  src={selected.image}
                  alt={selected.name}
                  className="w-full h-64 object-cover rounded-lg mb-4 border border-emerald-500/30"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/images/meal-placeholder.jpg";
                  }}
                />

                <p className="text-white/90 mb-4">{selected.description}</p>

                <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="text-center">
                    <div className="font-bold text-2xl text-emerald-300">
                      {selected.calories}
                    </div>
                    <div className="text-sm text-white/70">calories</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-2xl text-emerald-300">
                      {selected.carbs}
                    </div>
                    <div className="text-sm text-white/70">carbs</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-2xl text-emerald-300">
                      {selected.sugar}
                    </div>
                    <div className="text-sm text-white/70">sugar</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="font-bold text-lg text-white">Ingredients</h3>
                    <CopyRecipeButton recipe={{
                      name: selected.name,
                      ingredients: selected.ingredients.map(ing => ({
                        name: ing.name,
                        amount: String(ing.quantity),
                        unit: ing.unit
                      })),
                      instructions: selected.instructions
                    }} />
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {selected.ingredients.map((ingredient, idx) => (
                      <li key={idx} className="text-white/90">
                        {ingredient.quantity} {ingredient.unit} {ingredient.name}
                        {ingredient.notes && ` (${ingredient.notes})`}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-4">
                  <h3 className="font-bold text-lg mb-2 text-white">
                    Instructions
                  </h3>
                  <ol className="list-decimal list-inside space-y-1">
                    {selected.instructions.map((instruction, idx) => (
                      <li key={idx} className="text-white/90">
                        {instruction}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mb-24">
                  <h3 className="font-bold text-lg mb-2 text-white">
                    Benefits
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.benefits.map((benefit, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-emerald-600/30 border border-emerald-400/60 text-emerald-100 rounded-full text-sm font-medium"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Shopping Bar - Fixed at bottom when modal is open */}
        {selected && (
          <ShoppingAggregateBar
            ingredients={selected.ingredients.map((ing) => ({
              name: ing.name,
              qty: ing.quantity,
              unit: ing.unit,
            }))}
            source={selected.name}
            sourceSlug="mocktails"
            hideCopyButton={true}
          />
        )}
      </div>
    </div>
  );
}
