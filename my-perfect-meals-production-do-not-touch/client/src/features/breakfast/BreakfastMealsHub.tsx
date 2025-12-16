import { useMemo, useState } from "react";
import { breakfastMeals } from "@/data/breakfastMealsData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Coffee, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

function scaleIngredients<T extends { quantity: number }>(
  baseServings: number,
  targetServings: number,
  items: T[]
): T[] {
  if (!baseServings || baseServings === targetServings) return items;
  const factor = targetServings / baseServings;
  return items.map((it) => ({
    ...it,
    quantity: Math.round(it.quantity * factor * 10) / 10
  }));
}

export default function BreakfastMealsHub() {
  const [open, setOpen] = useState(false);
  const [servings, setServings] = useState<number>(2);
  const [activeMealId, setActiveMealId] = useState<string | null>(null);
  const [activeTemplateSlug, setActiveTemplateSlug] = useState<string | null>(null);
  const { toast } = useToast();

  const activeMeal = useMemo(
    () => breakfastMeals.find((m) => m.id === activeMealId) || null,
    [activeMealId]
  );

  const activeTemplate = useMemo(() => {
    if (!activeMeal || !activeTemplateSlug) return null;
    return activeMeal.templates.find((t) => t.slug === activeTemplateSlug) || null;
  }, [activeMeal, activeTemplateSlug]);

  const scaledIngredients = useMemo(() => {
    if (!activeTemplate || !activeMeal) return [];
    const target = servings || activeMeal.baseServings;
    return scaleIngredients(activeMeal.baseServings, target, activeTemplate.ingredients);
  }, [activeMeal, activeTemplate, servings]);

  const openMeal = (id: string, slug: string) => {
    setActiveMealId(id);
    setActiveTemplateSlug(slug);
    setServings(breakfastMeals.find((m) => m.id === id)?.baseServings || 2);
    setOpen(true);
  };

  const acceptMeal = async () => {
    if (!activeMeal || !activeTemplate) return;
    
    // Create meal object for weekly plan integration
    const mealToAdd = {
      id: `${activeMeal.id}-${activeTemplate.slug}`,
      name: `${activeMeal.name} - ${activeTemplate.name}`,
      servings: servings,
      ingredients: scaledIngredients.map(ing => `${ing.quantity} ${ing.unit} ${ing.item}`),
      instructions: activeTemplate.instructions,
      nutritionPerServing: null, // Could be calculated based on ingredients
      source: "breakfast"
    };
    
    // Store the meal to be added to weekly plan
    localStorage.setItem("weeklyPlanMealToAdd", JSON.stringify({
      meal: mealToAdd,
      targetDay: null, // User will choose
      targetSlot: null // User will choose
    }));
    
    toast({
      title: "Breakfast saved to weekly plan!",
      description: `${activeTemplate.name} saved with ${servings} servings.`,
    });
    
    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 text-center mt-14">
          <Link href="/">
            <Button variant="ghost" className="mb-4 text-white hover:text-white/90">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          
          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 backdrop-blur">
            <Coffee className="h-4 w-4 text-white/80" />
            <span className="text-sm text-white/80">Breakfast — Pre-Designed</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Start Your Day Right
          </h1>
          <p className="mt-2 text-white/70">
            Choose from 30 healthy breakfast options across 10 meal types with 3 variations each.
          </p>
        </div>

        {/* Meal Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {breakfastMeals.map((m) =>
            m.templates.map((t) => (
              <Card key={`${m.id}-${t.slug}`} className="border-white/10 bg-white/5 backdrop-blur mt-14">
                <CardHeader>
                  <CardTitle className="text-white text-lg">
                    {m.name} — {t.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white/70 mb-3">{t.description}</p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {t.healthBadges.slice(0, 3).map((b) => (
                      <Badge key={b} className="bg-white/10 text-white text-xs">
                        {b}
                      </Badge>
                    ))}
                  </div>
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white" 
                    onClick={() => openMeal(m.id, t.slug)}
                    data-testid={`choose-breakfast-${m.id}-${t.slug}`}
                  >
                    Choose This Breakfast
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Meal Detail Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 text-white border-white/15 max-w-4xl max-h-[90vh] overflow-y-auto">
          {activeMeal && activeTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {activeMeal.name} — {activeTemplate.name}
                </DialogTitle>
                <DialogDescription className="text-white/70">
                  {activeTemplate.description}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {/* Servings Control */}
                <div>
                  <label className="text-sm font-medium text-white/80">Servings</label>
                  <Input
                    type="number"
                    min={1}
                    value={servings}
                    onChange={(e) =>
                      setServings(
                        Math.max(
                          1,
                          Number(e.target.value || activeMeal.baseServings)
                        )
                      )
                    }
                    className="mt-1 bg-black/30 text-white border-white/20"
                    data-testid="servings-input"
                  />
                  <p className="mt-1 text-xs text-white/50">
                    Base recipe: {activeMeal.baseServings} servings
                  </p>
                </div>

                {/* Scaled Ingredients */}
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-white/80">Ingredients (scaled)</label>
                  <div className="mt-1 max-h-60 overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
                    <ul className="space-y-2">
                      {scaledIngredients.map((ing, i) => (
                        <li key={i} className="flex justify-between">
                          <span className="text-white/90">{ing.item}</span>
                          <span className="text-white/70 font-medium">
                            {ing.quantity} {ing.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="mt-6">
                <label className="text-sm font-medium text-white/80">Instructions</label>
                <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-4">
                  <ol className="list-decimal list-inside space-y-2 text-sm text-white/80">
                    {activeTemplate.instructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Health Badges */}
              <div className="mt-4">
                <label className="text-sm font-medium text-white/80">Health Benefits</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeTemplate.healthBadges.map((badge) => (
                    <Badge key={badge} className="bg-green-600/20 text-green-300 border-green-500/30">
                      {badge}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <Button 
                  onClick={acceptMeal}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="add-to-plan-button"
                >
                  Add to Weekly Plan
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setServings(activeMeal ? activeMeal.baseServings : 2)
                  }
                  className="border-white/20 text-white hover:bg-white/10"
                  data-testid="reset-servings-button"
                >
                  Reset Servings
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}