// 🔒 LOCKED: FUTURE FEATURE
// This page is intentionally not imported in the router yet.
// It is reserved for launch or future upgrades.
// DO NOT delete, refactor, or auto-route this file without explicit user approval.

// client/src/pages/kids-drinks-hub.tsx
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Coffee, Sparkles } from "lucide-react";
import { kidsDrinks, type KidsDrink } from "@/data/kidsDrinksData";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";

type FilterTab = "All" | "Everyday Smoothie" | "No Added Sugar" | "Occasional Treat";

const FILTER_TABS: FilterTab[] = ["All", "Everyday Smoothie", "No Added Sugar", "Occasional Treat"];

export default function KidsDrinksHubPage() {
  const [, setLocation] = useLocation();
  const [filterText, setFilterText] = useState("");
  const [tab, setTab] = useState<FilterTab>("All");
  const [selectedDrink, setSelectedDrink] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = filterText.trim().toLowerCase();

    const withFallback = kidsDrinks.map((d) => ({
      ...d,
      image: d.image ?? `/images/kids-drinks/${d.id}.jpg`,
    }));

    const byText = (d: KidsDrink) =>
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      (d.badges ?? []).some((b) => b.toLowerCase().includes(q));

    const byTab = (d: KidsDrink) =>
      tab === "All" || (d.badges ?? []).some((b) => b.toLowerCase() === tab.toLowerCase());

    return withFallback.filter((d) => byText(d) && byTab(d));
  }, [filterText, tab]);

  const selected = items.find(d => d.id === selectedDrink);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-yellow-500 to-black/80 p-4 sm:p-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => setLocation("/meals-for-kids")}
        className="fixed top-2 left-2 sm:top-4 sm:left-4 z-50 bg-yellow-900/40 backdrop-blur-none border border-yellow-400/60 hover:bg-yellow-800/50 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl shadow-lg flex items-center gap-2 font-semibold text-sm sm:text-base transition-all"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="max-w-6xl mx-auto pt-16">
        {/* Header */}
        <div className="text-center mb-8 bg-black/20 backdrop-blur-lg border border-yellow-400/70 rounded-2xl p-8 shadow-[0_0_30px_rgba(234,179,8,0.15)]">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Coffee className="h-12 w-12 text-yellow-300" />
            <h1 className="text-3xl font-bold text-white">Kids Drinks Hub</h1>
          </div>
          <p className="text-md text-white/90 max-w-2xl mx-auto">
            Smoothies, no-sugar blends, and fun treats kids love
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6 bg-black/50 backdrop-blur-sm border border-yellow-400/70">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-white/80">Search drinks</Label>
                <Input
                  placeholder="Search by name or badge…"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="bg-black/40 text-white border-white/20 placeholder:text-white/40"
                />
              </div>

              <div>
                <Label className="text-white/80">Quick filter</Label>
                <div className="grid grid-cols-2 gap-2">
                  {FILTER_TABS.map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      onClick={() => setTab(t)}
                      className={tab === t ? "bg-yellow-600 text-white" : "bg-black/60 border border-white/30 text-white hover:bg-black/80"}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Drinks Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {items.map((drink) => (
            <Card
              key={drink.id}
              className="cursor-pointer transform hover:scale-105 transition-all duration-200 bg-black/50 backdrop-blur-sm border border-yellow-400/70 shadow-xl hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]"
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
                <p className="text-sm text-white/80 mb-3 line-clamp-2">{drink.description}</p>
                <div className="flex flex-wrap gap-2">
                  {(drink.badges ?? []).slice(0, 2).map((b) => (
                    <Badge key={b} className="bg-yellow-600/30 border border-yellow-400/60 text-yellow-100 text-xs">
                      {b}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {items.length === 0 && (
          <div className="mt-8 text-center text-white/80">No drinks match that search.</div>
        )}

        {/* Detail Modal */}
        {selected && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDrink(null)}
          >
            <Card
              className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-black/50 border border-yellow-400/70 shadow-[0_0_30px_rgba(234,179,8,0.2)]"
              onClick={(e) => e.stopPropagation()}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-3xl font-bold text-white">{selected.name}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDrink(null)}
                    className="text-yellow-300 hover:text-white"
                  >
                    ✕
                  </Button>
                </div>

                <img
                  src={selected.image}
                  alt={selected.name}
                  className="w-full h-64 object-cover rounded-lg mb-4 border border-yellow-500/30"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/meal-placeholder.jpg';
                  }}
                />

                <p className="text-white/90 mb-4">{selected.description}</p>

                {/* Badges */}
                <div className="mb-4">
                  <h3 className="font-bold text-lg mb-2 text-white">Benefits</h3>
                  <div className="flex flex-wrap gap-2">
                    {(selected.badges ?? []).map((badge) => (
                      <span
                        key={badge}
                        className="px-3 py-1 bg-yellow-600/30 border border-yellow-400/60 text-yellow-100 rounded-full text-sm font-medium"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Ingredients */}
                {selected.ingredients && selected.ingredients.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-bold text-lg mb-2 text-white">Ingredients</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {selected.ingredients.map((ingredient, idx) => (
                        <li key={idx} className="text-white/90">
                          {ingredient.quantity} {ingredient.unit} {ingredient.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Instructions */}
                {selected.instructions && selected.instructions.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-bold text-lg mb-2 text-white">How to Make</h3>
                    <ol className="list-decimal list-inside space-y-1">
                      {selected.instructions.map((instruction, idx) => (
                        <li key={idx} className="text-white/90">{instruction}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Shopping Bar - Fixed within modal */}
                {selected.ingredients && selected.ingredients.length > 0 && (
                  <div className="sticky bottom-0 left-0 right-0 mt-6 mb-24">
                    <ShoppingAggregateBar
                      ingredients={selected.ingredients.map(ing => ({
                        name: ing.name,
                        qty: ing.quantity,
                        unit: ing.unit
                      }))}
                      source={selected.name}
                      sourceSlug="kids-drinks-hub"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
