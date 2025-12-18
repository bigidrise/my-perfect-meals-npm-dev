import { useEffect, useMemo, useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Home } from "lucide-react";
import { useLocation } from "wouter";
import { breakfastMeals } from "@/data/breakfastMealsData";
import { lunchMealsData } from "@/data/lunchMealsData";
import { dinnerMealsData } from "@/data/dinnerMealsData";
import { snacksMealsData } from "@/data/snacksMealsData";
import { getUserNutritionTargets, explainNutritionTargets, evaluateMealAgainstTargets } from "@/utils/nutritionTargetsIntegration";
import type { MacroTargets } from "@/utils/computeTargets";
import { RecipeQuickActions } from "@/components/RecipeQuickActions";
import { generateMedicalBadges, getUserMedicalProfile } from "@/utils/medicalBadges";
import MedicalBadges from "@/components/meal/MedicalBadges";

export type Ingredient = { item: string; quantity: number; unit: string };
export type MealTemplate = {
  slug: string;
  name: string;
  description: string;
  healthBadges: string[];
  ingredients: Ingredient[];
  instructions: string[];
  prepTime?: string;
  servings?: number;
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
  };
};
export type PresetMeal = {
  id: string;
  slug: string;
  name: string;
  description: string;
  baseServings: number;
  image: string;
  templates: {
    classic: MealTemplate;
    light: MealTemplate;
    highProtein: MealTemplate;
  };
};

function round1(n: number) { return Math.round(n * 10) / 10; }
function scaleIngredients(baseServings: number, targetServings: number, items: Ingredient[]): Ingredient[] {
  if (!baseServings || baseServings === targetServings) return items;
  const factor = targetServings / baseServings;
  return items.map((it) => ({ ...it, quantity: round1(it.quantity * factor) }));
}

export function createMealHub(type: "breakfast"|"lunch"|"dinner"|"snacks", meals: PresetMeal[]) {
  return function MealHub() {
    const [, setLocation] = useLocation();
    const [open, setOpen] = useState(false);
    const [servings, setServings] = useState<number>(2);
    const [activeMealId, setActiveMealId] = useState<string | null>(null);
    const [activeTemplateSlug, setActiveTemplateSlug] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editedIngredients, setEditedIngredients] = useState<Ingredient[]>([]);
    const [editedInstructions, setEditedInstructions] = useState<string[]>([]);
    const { toast } = useToast();

    // URL deep-link support: /meals/{type}?mealId=..&template=..
    useEffect(() => {
      const sp = new URLSearchParams(window.location.search);
      const mid = sp.get("mealId");
      const tpl = sp.get("template");
      if (mid) {
        const m = meals.find((x) => x.id === mid);
        if (m) {
          setActiveMealId(m.id);
          const template = tpl && Object.values(m.templates).some(t => t.slug === tpl) ? tpl : "classic";
          setActiveTemplateSlug(template);
          setServings(m.baseServings);
          setOpen(true);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const activeMeal = useMemo(() => meals.find((m) => m.id === activeMealId) || null, [activeMealId]);
    const activeTemplate = useMemo(() => {
      if (!activeMeal || !activeTemplateSlug) return null;
      const templateKey = activeTemplateSlug as keyof typeof activeMeal.templates;
      return activeMeal.templates[templateKey] || null;
    }, [activeMeal, activeTemplateSlug]);
    const scaledIngredients = useMemo(() => {
      if (!activeMeal || !activeTemplate) return [];
      const ingredients = editMode ? editedIngredients : activeTemplate.ingredients;
      return scaleIngredients(activeMeal.baseServings, servings || activeMeal.baseServings, ingredients);
    }, [activeMeal, activeTemplate, servings, editMode, editedIngredients]);

    // Science-driven nutrition targets (mock user data for now)
    const nutritionTargets = useMemo(() => {
      const mockUserData = {
        fitnessGoal: 'weight_loss', // weight_loss, muscle_gain, maintenance
        sex: 'male', // male, female
        weight: 90.7, // kg (200 lbs)
        height: 175, // cm
        mealsPerDay: 3,
        snacksPerDay: 1
      };
      return getUserNutritionTargets(mockUserData);
    }, []);

    // Evaluate current meal against targets
    const mealEvaluation = useMemo(() => {
      if (!activeTemplate) return null;

      // Estimate nutrition for current meal (these would come from a nutrition database)
      const mockNutrition = {
        protein: activeTemplate.slug === 'highProtein' ? 45 : 
                activeTemplate.slug === 'light' ? 30 : 35,
        carbs: activeTemplate.slug === 'light' ? 15 : 
               activeTemplate.slug === 'highProtein' ? 20 : 25
      };

      return evaluateMealAgainstTargets(mockNutrition, nutritionTargets);
    }, [activeTemplate, nutritionTargets]);

    const openMeal = (id: string, slug?: string) => {
      const m = meals.find((x) => x.id === id);
      if (!m) return;
      setActiveMealId(id);
      const templateSlug = slug || "classic";
      setActiveTemplateSlug(templateSlug);
      setServings(m.baseServings);
      setEditMode(false);

      // Initialize edit state
      const template = m.templates[templateSlug as keyof typeof m.templates];
      setEditedIngredients([...template.ingredients]);
      setEditedInstructions([...template.instructions]);
      setOpen(true);
    };

    const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
      const updated = [...editedIngredients];
      if (field === 'quantity') {
        updated[index] = { ...updated[index], [field]: Number(value) || 0 };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      setEditedIngredients(updated);
    };

    const updateInstruction = (index: number, value: string) => {
      const updated = [...editedInstructions];
      updated[index] = value;
      setEditedInstructions(updated);
    };

    const addIngredient = () => {
      setEditedIngredients([...editedIngredients, { item: "", quantity: 1, unit: "" }]);
    };

    const removeIngredient = (index: number) => {
      setEditedIngredients(editedIngredients.filter((_, i) => i !== index));
    };

    const acceptMeal = async () => {
      if (!activeMeal || !activeTemplate) return;

      // Create meal with edited template if in edit mode
      const finalTemplate = editMode ? {
        ...activeTemplate,
        ingredients: editedIngredients,
        instructions: editedInstructions
      } : activeTemplate;

      const res = await fetch(apiUrl(`/api/${type}/accept`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          meal: { ...activeMeal, template: finalTemplate }, 
          servings 
        })
      });

      if (!res.ok) {
        toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
        return;
      }

      toast({ title: `${type[0].toUpperCase() + type.slice(1)} saved`, description: `${finalTemplate.name} — ${servings} servings added to your weekly plan.` });
      setOpen(false);

      // Navigate to weekly plan page after successful save
      window.location.href = "/weekly-plan";
    };

    const toggleEditMode = () => {
      if (!editMode && activeTemplate) {
        // Entering edit mode - initialize with current template
        setEditedIngredients([...activeTemplate.ingredients]);
        setEditedInstructions([...activeTemplate.instructions]);
      }
      setEditMode(!editMode);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-800 px-4 py-6 sm:px-6">
        {/* Back to Template Hub Button */}
        <div className="fixed top-4 left-4 z-50">
          <Button
            onClick={() => setLocation("/template-hub")}
            variant="outline"
            size="sm"
            className="bg-black/20 backdrop-blur-md border-black/20 text-white hover:bg-black/30 hover:border-white/40 rounded-2xl transition-all duration-200"
          >
            <Home className="w-4 h-4 mr-2" />
            Template Hub
          </Button>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center mt-14">
            <div className="inline-block bg-black/20 backdrop-blur-md border border-white/10 rounded-xl px-8 py-6">
              <h1 className="text-3xl font-bold text-white mb-2 capitalize">
                {type} Meals
              </h1>
              <p className="mt-3 text-lg text-white/70">
                Choose a {type} template, customize if needed, scale servings, and add to your weekly plan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {meals.map((meal) => (
              <Card key={meal.id} className="border-white/20 bg-black/30 backdrop-blur-sm hover:bg-white/10 transition-all mt-14">
                <CardHeader>
                  <CardTitle className="text-white text-xl">{meal.name}</CardTitle>
                  <p className="text-white/60 text-sm">{meal.description}</p>
                </CardHeader>
                <CardContent className="p-4">
                    <h3 className="text-white font-semibold text-lg mb-2">{meal.name}</h3>
                    <p className="text-white/70 text-sm mb-3 line-clamp-2">{meal.description}</p>

                    <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
                      <Clock className="h-4 w-4" />
                      <span>{meal.prepTime || "15-20 minutes"}</span>
                    </div>

                    {/* Medical Safety Badges */}
                    {(() => {
                      const userProfile = getUserMedicalProfile(1);
                      const mealForBadges = {
                        name: meal.name,
                        ingredients: meal.ingredients || [],
                        description: meal.description,
                        nutrition: meal.nutrition
                      };
                      const medicalBadges = generateMedicalBadges(mealForBadges, userProfile);
                      const badgeItems = medicalBadges.map(b => ({
                        key: b.badge,
                        label: b.badge,
                        description: b.explanation
                      }));

                      return medicalBadges && medicalBadges.length > 0 && (
                        <div className="mb-3">
                          <MedicalBadges badges={badgeItems} />
                        </div>
                      );
                    })()}

                    <div className="text-white/80 text-sm">
                      <strong>Nutrition per serving:</strong><br />
                      {meal.nutrition?.calories}cal • {meal.nutrition?.protein}g protein • {meal.nutrition?.carbs}g carbs
                    </div>
                  </CardContent>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white/80 mb-2">Choose a Template:</h4>
                    {Object.entries(meal.templates).map(([key, template]) => (
                      <Button 
                        key={key} 
                        variant="outline" 
                        className="w-full justify-start text-left h-auto p-3 bg-white/10 border-white/30 hover:bg-white/20 hover:border-white/50 text-white" 
                        onClick={() => openMeal(meal.id, key)}
                      >
                        <div className="flex flex-col items-start w-full">
                          <span className="font-medium text-white">{template.name}</span>
                          <span className="text-xs text-white/70 mt-1">{template.description}</span>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.healthBadges.slice(0, 2).map((badge) => (
                              <Badge key={badge} variant="secondary" className="text-xs bg-green-600/30 text-green-200 border-green-500/40">
                                {badge}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                  <Button 
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-medium" 
                    onClick={() => openMeal(meal.id, "classic")}
                  >
                    🍽️ Quick Choose Classic
                  </Button>

                  {/* Recipe Quick Actions */}
                  <div className="mt-4 pt-3 border-t border-white/20">
                    <h4 className="text-sm font-medium text-white/80 mb-3">Quick Actions:</h4>
                    <RecipeQuickActions 
                      recipe={{
                        id: meal.id,
                        slug: meal.slug,
                        name: meal.name,
                        type: type as "breakfast" | "lunch" | "dinner" | "snack"
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="bg-zinc-900/95 text-white border-white/20 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {activeMeal && activeTemplate && (
              <>
                {/* Sticky header */}
                <div className="sticky top-0 z-10 backdrop-blur bg-zinc-900/90 border-b border-white/20 pb-4">
                  <DialogHeader>
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-2xl">{activeMeal.name} — {activeTemplate.name}</DialogTitle>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setOpen(false)}
                        className="border-white/20 text-black bg-white/90 hover:bg-white/80"
                      >
                        ✕ Close
                      </Button>
                    </div>
                    <DialogDescription className="text-white/70 text-base">
                      {activeTemplate.description}
                    </DialogDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {activeTemplate.healthBadges.map((badge) => (
                        <Badge key={badge} variant="secondary" className="bg-green-600/20 text-green-300">
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </DialogHeader>
                </div>

                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto pt-4">

                {/* Servings Control - Prominent Display */}
                <div className="bg-gradient-to-r from-orange-900/30 to-yellow-900/30 rounded-lg p-4 border border-orange-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-orange-600/20 text-orange-300">🍽️ Portion Size</Badge>
                        <label className="text-sm font-medium text-white/90">Servings:</label>
                        <Input 
                          type="number" 
                          min={1} 
                          max={20}
                          value={servings} 
                          onChange={(e) => setServings(Math.max(1, Number(e.target.value || activeMeal.baseServings)))} 
                          className="w-20 bg-black/30 text-white border-white/20 font-bold text-lg" 
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-orange-300">{servings} {servings === 1 ? 'Person' : 'People'}</div>
                        <div className="text-xs text-white/60">Currently Scaled For</div>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={toggleEditMode}
                      className="border-white/20 text-black bg-white/90 hover:bg-white/80"
                    >
                      {editMode ? "Exit Edit Mode" : "Edit Template"}
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-white/50">
                    Original recipe serves {activeMeal.baseServings} • Ingredients automatically scaled
                  </div>
                </div>

                {/* Science-Driven Nutrition Targets */}
                <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-blue-600/20 text-blue-300">🧬 Science-Driven</Badge>
                    <h3 className="text-sm font-medium text-white/90">Personalized Nutrition Target</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-300">{nutritionTargets.proteinPerMeal_g}g</div>
                      <div className="text-xs text-white/60">Protein Target/Meal</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-300">{nutritionTargets.starchyCarbsPerMeal_g_min}-{nutritionTargets.starchyCarbsPerMeal_g_max}g</div>
                      <div className="text-xs text-white/60">Carbs Target/Meal</div>
                    </div>
                  </div>

                  {mealEvaluation && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          mealEvaluation.proteinMatch === 'good' ? 'bg-green-400' :
                          mealEvaluation.proteinMatch === 'low' ? 'bg-yellow-400' : 'bg-red-400'
                        }`}></span>
                        <span className="text-xs text-white/70">
                          Protein: {mealEvaluation.proteinMatch === 'good' ? 'Perfect Match' : 
                                   mealEvaluation.proteinMatch === 'low' ? 'Needs More' : 'Too Much'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          mealEvaluation.carbsMatch === 'good' ? 'bg-green-400' :
                          mealEvaluation.carbsMatch === 'low' ? 'bg-yellow-400' : 'bg-red-400'
                        }`}></span>
                        <span className="text-xs text-white/70">
                          Carbs: {mealEvaluation.carbsMatch === 'good' ? 'Perfect Match' : 
                                  mealEvaluation.carbsMatch === 'low' ? 'Needs More' : 'Too Much'}
                        </span>
                      </div>
                      <div className="ml-auto">
                        <Badge variant={mealEvaluation.score >= 80 ? 'default' : 'secondary'} 
                               className={mealEvaluation.score >= 80 ? 'bg-green-600/20 text-green-300' : 'bg-yellow-600/20 text-yellow-300'}>
                          {mealEvaluation.score}% Match
                        </Badge>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-white/50 italic">
                    {explainNutritionTargets(nutritionTargets)}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">

                  {/* Ingredients */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-white/80">
                        Ingredients {editMode && "(Editable)"}
                      </label>
                      {editMode && (
                        <Button size="sm" onClick={addIngredient} variant="outline">
                          Add Ingredient
                        </Button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-auto rounded-xl border border-white/10 bg-black/30 p-4">
                      <ul className="space-y-2">
                        {scaledIngredients.map((ing, i) => (
                          <li key={i} className="flex items-center gap-2">
                            {editMode ? (
                              <div className="flex items-center gap-2 w-full">
                                <Input 
                                  value={ing.item}
                                  onChange={(e) => updateIngredient(i, 'item', e.target.value)}
                                  className="flex-1 bg-black/20 text-white border-white/20 text-sm"
                                  placeholder="Ingredient name"
                                />
                                <Input 
                                  type="number"
                                  value={ing.quantity}
                                  onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
                                  className="w-20 bg-black/20 text-white border-white/20 text-sm"
                                />
                                <Input 
                                  value={ing.unit}
                                  onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                                  className="w-20 bg-black/20 text-white border-white/20 text-sm"
                                  placeholder="unit"
                                />
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  onClick={() => removeIngredient(i)}
                                >
                                  ×
                                </Button>
                              </div>
                            ) : (
                              <span className="text-white/90">
                                <strong>{ing.item}</strong> — {ing.quantity} {ing.unit}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div>
                    <label className="text-sm font-medium text-white/80">
                      Instructions {editMode && "(Editable)"}
                    </label>
                    <div className="mt-2 space-y-2">
                      {(editMode ? editedInstructions : activeTemplate.instructions).map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-white/60 text-sm mt-1 min-w-[1.5rem]">{i + 1}.</span>
                          {editMode ? (
                            <Textarea 
                              value={step}
                              onChange={(e) => updateInstruction(i, e.target.value)}
                              className="flex-1 bg-black/20 text-white border-white/20 text-sm"
                              rows={2}
                            />
                          ) : (
                            <span className="text-white/80 text-sm">{step}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-white/10">
                    <Button 
                      onClick={acceptMeal}
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                    >
                      Add to Weekly Plan
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => window.location.href = "/weekly-plan"}
                      className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                    >
                      View Weekly Plan
                    </Button>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  };
}

// Export individual meal hubs
export const BreakfastMealsHub = createMealHub("breakfast", breakfastMeals);
export const LunchMealsHub = createMealHub("lunch", lunchMealsData);
export const DinnerMealsHub = createMealHub("dinner", dinnerMealsData);
export const SnacksMealsHub = createMealHub("snacks", snacksMealsData);