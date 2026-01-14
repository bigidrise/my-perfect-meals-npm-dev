import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sparkles, ChefHat, Loader2 } from "lucide-react";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { KitchenStepCard } from "@/components/chefs-kitchen/KitchenStepCard";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import { apiUrl } from "@/lib/resolveApiBase";
import {
  KITCHEN_STUDIO_INTRO,
  KITCHEN_STUDIO_STEP2,
  KITCHEN_STUDIO_COOK_METHOD,
  KITCHEN_STUDIO_COOK_CONFIRMED,
  KITCHEN_STUDIO_INGREDIENTS_PACE,
  KITCHEN_STUDIO_INGREDIENTS_CONFIRMED,
  KITCHEN_STUDIO_EQUIPMENT,
  KITCHEN_STUDIO_EQUIPMENT_CONFIRMED,
  KITCHEN_STUDIO_OPEN_START,
  KITCHEN_STUDIO_OPEN_PROGRESS1,
  KITCHEN_STUDIO_OPEN_PROGRESS2,
  KITCHEN_STUDIO_OPEN_COMPLETE,
  EQUIPMENT_BY_METHOD,
} from "@/components/copilot/scripts/kitchenStudioScripts";

type KitchenMode = "entry" | "studio";

interface GeneratedMeal {
  id: string;
  name: string;
  description?: string;
  mealType?: string;
  ingredients: Array<{ name: string; quantity?: string; amount?: number; unit?: string; notes?: string }>;
  instructions: string[] | string;
  imageUrl?: string | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  medicalBadges?: string[];
  flags?: string[];
  servingSize?: string;
  reasoning?: string;
}

export default function ChefsKitchenPage() {
  const [, setLocation] = useLocation();
  const quickTour = useQuickTour("chefs-kitchen");
  const [mode, setMode] = useState<KitchenMode>("entry");

  // Kitchen Studio state
  const [studioStep, setStudioStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const { speak } = useChefVoice(setIsPlaying);

  // Step 1 - Dish Idea
  const [dishIdea, setDishIdea] = useState("");
  const [step1Listened, setStep1Listened] = useState(false);
  const [step1Locked, setStep1Locked] = useState(false);

  // Step 2 - Cooking Method
  const [cookMethod, setCookMethod] = useState("");
  const [step2Listened, setStep2Listened] = useState(false);
  const [step2Locked, setStep2Locked] = useState(false);

  // Step 3 - Ingredients & Pace
  const [ingredientNotes, setIngredientNotes] = useState("");
  const [step3Listened, setStep3Listened] = useState(false);
  const [step3Locked, setStep3Locked] = useState(false);

  // Step 4 - Equipment
  const [equipment, setEquipment] = useState("");
  const [step4Listened, setStep4Listened] = useState(false);
  const [step4Locked, setStep4Locked] = useState(false);

  // Get equipment list based on cooking method
  const suggestedEquipment = cookMethod ? EQUIPMENT_BY_METHOD[cookMethod] || [] : [];

  // Edit handlers - unlock step and reset downstream
  const editStep1 = () => {
    setStep1Locked(false);
    setStep2Locked(false);
    setStep3Locked(false);
    setStep4Locked(false);
    setStep2Listened(false);
    setStep3Listened(false);
    setStep4Listened(false);
    setStudioStep(1);
  };

  const editStep2 = () => {
    setStep2Locked(false);
    setStep3Locked(false);
    setStep4Locked(false);
    setStep3Listened(false);
    setStep4Listened(false);
    setCookMethod("");
    setEquipment("");
    setStudioStep(2);
  };

  const editStep3 = () => {
    setStep3Locked(false);
    setStep4Locked(false);
    setStep4Listened(false);
    setStudioStep(3);
  };

  const editStep4 = () => {
    setStep4Locked(false);
    setStudioStep(4);
  };

  // Restart Kitchen Studio - clears all state without page reload
  const restartKitchenStudio = () => {
    // Clear step states
    setStudioStep(1);
    setDishIdea("");
    setStep1Listened(false);
    setStep1Locked(false);
    setCookMethod("");
    setStep2Listened(false);
    setStep2Locked(false);
    setIngredientNotes("");
    setStep3Listened(false);
    setStep3Locked(false);
    setEquipment("");
    setStep4Listened(false);
    setStep4Locked(false);
    
    // Clear generation state
    setIsGeneratingMeal(false);
    setGenerationProgress(0);
    setGeneratedMeal(null);
    setGenerationError(null);
    
    // Clear any running progress interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  // Step 5 - Open Kitchen
  const [isGeneratingMeal, setIsGeneratingMeal] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedMeal, setGeneratedMeal] = useState<GeneratedMeal | null>(
    null
  );
  const [generationError, setGenerationError] = useState<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    document.title = "Chef's Kitchen 👨🏿‍🍳 | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const startOpenKitchen = async () => {
    setIsGeneratingMeal(true);
    setGenerationProgress(10);
    setGenerationError(null);

    // Start narration
    speak(KITCHEN_STUDIO_OPEN_START);

    // Progress ticker
    progressIntervalRef.current = setInterval(() => {
      setGenerationProgress((p) => {
        if (p >= 90) return p;
        return p + Math.floor(Math.random() * 8) + 4;
      });
    }, 700);

    // Narration beats
    setTimeout(() => speak(KITCHEN_STUDIO_OPEN_PROGRESS1), 2000);
    setTimeout(() => speak(KITCHEN_STUDIO_OPEN_PROGRESS2), 4000);

    try {
      // Build "Create with Chef" prompt wrapper for Craving Creator
      // This includes all context from the guided steps
      const chefPromptParts = [
        `Create with Chef: ${dishIdea}`,
        `Cooking method: ${cookMethod}`,
      ];
      
      // Add preferences/guardrails from Step 3 (dietary, pace, etc.)
      if (ingredientNotes) {
        chefPromptParts.push(`Preferences: ${ingredientNotes}`);
      }
      
      // Equipment context (informational - helps AI understand constraints)
      const equipmentContext = equipment || suggestedEquipment.join(", ");
      if (equipmentContext) {
        chefPromptParts.push(`Equipment available: ${equipmentContext}`);
      }

      const cravingPrompt = chefPromptParts.join(". ");

      // Call Craving Creator endpoint (intent-first generation)
      const response = await fetch(apiUrl("/api/craving-creator/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          craving: cravingPrompt,
          mealType: "dinner",
          source: "chefs-kitchen",
        }),
      });

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      if (!response.ok) {
        throw new Error("Failed to generate meal");
      }

      const data = await response.json();
      console.log("🍳 Chef's Kitchen API response:", data);
      
      const meal = data.meal;
      
      if (!meal) {
        throw new Error("No meal data returned from API");
      }
      
      // Normalize the meal response - preserve all fields exactly as Craving Creator returns
      // FinalMeal from stableMealGenerator has: nutrition.{calories, protein, carbs, fat}
      const srcNutrition = meal.nutrition || {};
      
      // Compute nutrition values - prioritize nested nutrition object (what Craving Creator returns)
      const nutritionCalories = srcNutrition.calories ?? meal.calories ?? 0;
      const nutritionProtein = srcNutrition.protein ?? meal.protein ?? 0;
      const nutritionCarbs = srcNutrition.carbs ?? meal.carbs ?? 0;
      const nutritionFat = srcNutrition.fat ?? meal.fat ?? 0;
      
      const normalizedMeal: GeneratedMeal = {
        id: meal.id || crypto.randomUUID(),
        name: meal.name || meal.title || "Chef's Creation",
        description: meal.description || meal.reasoning,
        mealType: meal.mealType || "dinner",
        // Preserve ingredient objects exactly - FinalMeal uses amount/unit/notes
        ingredients: Array.isArray(meal.ingredients) 
          ? meal.ingredients.map((ing: any) => {
              // Handle both string ingredients and full objects
              if (typeof ing === 'string') {
                return { name: ing, amount: undefined, unit: undefined, notes: undefined };
              }
              return {
                name: ing.name || '',
                quantity: ing.quantity,
                amount: ing.amount ?? ing.grams, // FinalMeal uses 'amount', skeleton uses 'grams'
                unit: ing.unit ?? 'g',
                notes: ing.notes ?? ''
              };
            })
          : [],
        instructions: meal.cookingInstructions || meal.instructions || [],
        imageUrl: meal.imageUrl,
        // Flat nutrition fields for components that expect them
        calories: nutritionCalories,
        protein: nutritionProtein,
        carbs: nutritionCarbs,
        fat: nutritionFat,
        // Nested nutrition object for Meal Card compatibility
        nutrition: {
          calories: nutritionCalories,
          protein: nutritionProtein,
          carbs: nutritionCarbs,
          fat: nutritionFat,
        },
        medicalBadges: Array.isArray(meal.medicalBadges) ? meal.medicalBadges : [],
        flags: Array.isArray(meal.flags) ? meal.flags : [],
        servingSize: meal.servingSize || "1 serving",
        reasoning: meal.reasoning,
      };
      
      console.log("✅ Chef's Kitchen normalized meal:", normalizedMeal);
      
      setGenerationProgress(100);
      setIsGeneratingMeal(false);
      setGeneratedMeal(normalizedMeal);

      // Final narration
      setTimeout(() => speak(KITCHEN_STUDIO_OPEN_COMPLETE), 500);
    } catch (error) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setIsGeneratingMeal(false);
      const errorMessage = error instanceof Error ? error.message : "Something went wrong";
      setGenerationError(`${errorMessage}. Please try again.`);
      console.error("🚨 Chef's Kitchen generation error:", error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
          <button
            onClick={() => setLocation("/lifestyle")}
            className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            data-testid="button-back-to-lifestyle"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <h1 className="text-lg font-bold text-white truncate min-w-0">
            Chef&apos;s Kitchen <span className="text-4xl leading-none">👨🏿‍🍳</span>
          </h1>

          <div className="flex-grow" />

          <QuickTourButton
            onClick={quickTour.openTour}
            className="flex-shrink-0"
          />
        </div>
      </div>

      <div
        className="px-4 space-y-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)",
        }}
      >
        {/* ENTRY MODE */}
        {mode === "entry" && (
          <div className="space-y-4">
            <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  <h2 className="text-lg font-bold text-white">
                    Welcome to Chef's Kitchen
                  </h2>
                </div>
                <p className="text-sm text-white/80">
                  Create great-tasting, healthy food with AI. This is where
                  ideas turn into dishes.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-black/40 border border-white/20">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">
                      What are we cooking today?
                    </h3>
                    <p className="text-xs text-white/70">
                      Start with an idea, a craving, or an ingredient - we'll
                      build it together.
                    </p>
                  </div>
                </div>

                <button
                  className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm active:scale-[0.98] transition"
                  data-testid="button-enter-kitchen-studio"
                  onClick={() => setMode("studio")}
                >
                  Enter Kitchen Studio
                </button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STUDIO MODE */}
        {mode === "studio" && (
          <div className="space-y-4">
            {/* Step 1 - Dish Idea */}
            {studioStep >= 1 && (
              <KitchenStepCard
                stepTitle="Step 1 · The Dish"
                question="What are we making today?"
                summaryText={`We're making: ${dishIdea}`}
                value={dishIdea}
                setValue={setDishIdea}
                hasListened={step1Listened}
                isLocked={step1Locked}
                isPlaying={isPlaying}
                placeholder="Describe the dish, flavor, or vibe..."
                inputType="textarea"
                onListen={() => {
                  if (step1Listened || isPlaying) return;
                  speak(KITCHEN_STUDIO_INTRO, () => setStep1Listened(true));
                }}
                onSubmit={() => {
                  setStep1Locked(true);
                  setStudioStep(2);
                  speak(KITCHEN_STUDIO_STEP2);
                }}
                onEdit={editStep1}
                canEdit={studioStep < 5}
              />
            )}

            {/* Step 2 - Cooking Method */}
            {studioStep >= 2 && (
              <KitchenStepCard
                stepTitle="Step 2 · Cooking Method"
                question="How are we cooking this?"
                summaryText={`Cooking method: ${cookMethod}`}
                value={cookMethod}
                setValue={setCookMethod}
                hasListened={step2Listened}
                isLocked={step2Locked}
                isPlaying={isPlaying}
                inputType="buttons"
                buttonOptions={["Stovetop", "Oven", "Air Fryer", "Grill"]}
                onListen={() => {
                  if (step2Listened || isPlaying) return;
                  speak(KITCHEN_STUDIO_COOK_METHOD, () =>
                    setStep2Listened(true)
                  );
                }}
                onSubmit={() => {
                  setStep2Locked(true);
                  setStudioStep(3);
                  speak(KITCHEN_STUDIO_COOK_CONFIRMED);
                }}
                onEdit={editStep2}
                canEdit={studioStep < 5}
              />
            )}

            {/* Step 3 - Preferences & Guardrails */}
            {studioStep >= 3 && (
              <KitchenStepCard
                stepTitle="Step 3 · Preferences"
                question="Anything to adjust — lower sugar, less salt, gluten-free, dairy-free? Quick or taking your time?"
                summaryText={
                  ingredientNotes
                    ? `Preferences: ${ingredientNotes}`
                    : "No special preferences"
                }
                value={ingredientNotes}
                setValue={setIngredientNotes}
                hasListened={step3Listened}
                isLocked={step3Locked}
                isPlaying={isPlaying}
                placeholder="e.g., low sugar, gluten-free, no dairy, quick 15 min meal..."
                inputType="textarea"
                onListen={() => {
                  if (step3Listened || isPlaying) return;
                  speak(KITCHEN_STUDIO_INGREDIENTS_PACE, () =>
                    setStep3Listened(true)
                  );
                }}
                onSubmit={() => {
                  setStep3Locked(true);
                  setStudioStep(4);
                  speak(KITCHEN_STUDIO_INGREDIENTS_CONFIRMED);
                }}
                onEdit={editStep3}
                canEdit={studioStep < 5}
              />
            )}

            {/* Step 4 - Chef's Setup (Equipment) */}
            {studioStep >= 4 && (
              <KitchenStepCard
                stepTitle="Step 4 · Chef's Setup"
                question="Do you have these, or are you missing anything?"
                summaryText={`Kitchen setup: ${equipment || suggestedEquipment.join(", ")}`}
                value={equipment}
                setValue={setEquipment}
                hasListened={step4Listened}
                isLocked={step4Locked}
                isPlaying={isPlaying}
                placeholder="Yes, all set / I don't have a skillet but I have a pan..."
                inputType="textarea"
                equipmentList={suggestedEquipment}
                onListen={() => {
                  if (step4Listened || isPlaying) return;
                  speak(KITCHEN_STUDIO_EQUIPMENT, () => setStep4Listened(true));
                }}
                onSubmit={() => {
                  setStep4Locked(true);
                  setStudioStep(5);
                  speak(KITCHEN_STUDIO_EQUIPMENT_CONFIRMED);
                }}
                onEdit={editStep4}
                canEdit={studioStep < 5}
              />
            )}

            {/* Step 5 - Open Kitchen */}
            {studioStep >= 5 && (
              <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-orange-500" />
                    <h3 className="text-sm font-semibold text-white">
                      Open Kitchen
                    </h3>
                  </div>

                  {/* Not started yet */}
                  {!isGeneratingMeal && !generatedMeal && !generationError && (
                    <div className="text-center py-6">
                      <Sparkles className="h-8 w-8 text-orange-500 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-white mb-2">
                        Ready to Create Your Meal
                      </h3>
                      <p className="text-sm text-white/70 mb-4">
                        Based on your preferences, we'll generate a complete
                        meal with macros, ingredients, and instructions.
                      </p>
                      <div className="rounded-xl border border-white/20 bg-black/40 p-4 text-left space-y-2 mb-4">
                        <p className="text-xs text-white/60">Your session:</p>
                        <p className="text-sm text-white/90">
                          <strong>Dish:</strong> {dishIdea}
                        </p>
                        <p className="text-sm text-white/90">
                          <strong>Method:</strong> {cookMethod}
                        </p>
                        <p className="text-sm text-white/90">
                          <strong>Notes:</strong> {ingredientNotes || "None"}
                        </p>
                        <p className="text-sm text-white/90">
                          <strong>Equipment:</strong> {equipment}
                        </p>
                      </div>
                      <button
                        className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm transition"
                        onClick={startOpenKitchen}
                        data-testid="button-generate-meal"
                      >
                        Generate My Meal
                      </button>
                    </div>
                  )}

                  {/* Generating */}
                  {isGeneratingMeal && !generatedMeal && (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 text-lime-500 mx-auto mb-4 animate-spin" />
                      <p className="text-sm text-white/80 mb-4">
                        Creating your dish...
                      </p>
                      <div className="w-full bg-black/40 border border-white/20 rounded-lg h-3 overflow-hidden">
                        <div
                          className="bg-lime-600 h-full transition-all duration-500"
                          style={{ width: `${generationProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {generationError && (
                    <div className="text-center py-6">
                      <p className="text-sm text-red-400 mb-4">
                        {generationError}
                      </p>
                      <button
                        className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm transition"
                        onClick={startOpenKitchen}
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {/* Meal Ready */}
                  {generatedMeal && (
                    <div className="space-y-4">
                      {generatedMeal.imageUrl && (
                        <img
                          src={generatedMeal.imageUrl}
                          alt={generatedMeal.name}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      )}

                      <div className="space-y-3">
                        <h4 className="text-lg font-bold text-white">
                          {generatedMeal.name}
                        </h4>

                        {generatedMeal.description && (
                          <p className="text-sm text-white/70">
                            {generatedMeal.description}
                          </p>
                        )}

                        {/* Macros */}
                        <div className="grid grid-cols-4 gap-2 py-2">
                          <div className="text-center">
                            <p className="text-lg font-bold text-white">
                              {generatedMeal.calories || 0}
                            </p>
                            <p className="text-xs text-white/60">cal</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-blue-400">
                              {generatedMeal.protein || 0}g
                            </p>
                            <p className="text-xs text-white/60">protein</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-green-400">
                              {generatedMeal.carbs || 0}g
                            </p>
                            <p className="text-xs text-white/60">carbs</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-yellow-400">
                              {generatedMeal.fat || 0}g
                            </p>
                            <p className="text-xs text-white/60">fat</p>
                          </div>
                        </div>

                        {/* Ingredients */}
                        {generatedMeal.ingredients?.length > 0 && (
                          <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                            <p className="text-sm font-semibold text-white mb-2">
                              Ingredients
                            </p>
                            <ul className="space-y-1">
                              {generatedMeal.ingredients.map((ing, i) => (
                                <li
                                  key={i}
                                  className="text-sm text-white/70 flex justify-between"
                                >
                                  <span>{ing.name}</span>
                                  <span className="text-white/50">
                                    {ing.amount ?? ing.quantity} {ing.unit}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Instructions */}
                        {generatedMeal.instructions && (
                          <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                            <p className="text-sm font-semibold text-white mb-2">
                              Instructions
                            </p>
                            {Array.isArray(generatedMeal.instructions) ? (
                              <ol className="space-y-2 list-decimal list-inside">
                                {generatedMeal.instructions.map((step, i) => (
                                  <li key={i} className="text-sm text-white/70">
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-sm text-white/70">
                                {generatedMeal.instructions}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            className="flex-1 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-sm transition border border-white/20"
                            onClick={restartKitchenStudio}
                          >
                            Start Over
                          </button>
                          <button
                            className="flex-1 py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm transition"
                            onClick={() => setLocation("/lifestyle")}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
