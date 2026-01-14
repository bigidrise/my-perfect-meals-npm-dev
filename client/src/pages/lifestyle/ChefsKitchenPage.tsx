import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sparkles } from "lucide-react";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { KitchenStepCard } from "@/components/chefs-kitchen/KitchenStepCard";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import {
  KITCHEN_STUDIO_INTRO,
  KITCHEN_STUDIO_STEP2,
  KITCHEN_STUDIO_COOK_METHOD,
  KITCHEN_STUDIO_COOK_CONFIRMED,
  KITCHEN_STUDIO_INGREDIENTS_PACE,
  KITCHEN_STUDIO_INGREDIENTS_CONFIRMED,
  KITCHEN_STUDIO_EQUIPMENT,
  KITCHEN_STUDIO_EQUIPMENT_CONFIRMED,
} from "@/components/copilot/scripts/kitchenStudioScripts";

type KitchenMode = "entry" | "studio";

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

  useEffect(() => {
    document.title = "Chef's Kitchen | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

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
            Chef's Kitchen
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
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 64px)",
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
              />
            )}

            {/* Step 3 - Ingredients & Pace */}
            {studioStep >= 3 && (
              <KitchenStepCard
                stepTitle="Step 3 · Ingredients & Pace"
                question="Any ingredients to include or avoid?"
                summaryText={
                  ingredientNotes
                    ? `Notes: ${ingredientNotes}`
                    : "No ingredient restrictions"
                }
                value={ingredientNotes}
                setValue={setIngredientNotes}
                hasListened={step3Listened}
                isLocked={step3Locked}
                isPlaying={isPlaying}
                placeholder="e.g., no mushrooms, extra garlic, dairy-free..."
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
              />
            )}

            {/* Step 4 - Equipment */}
            {studioStep >= 4 && (
              <KitchenStepCard
                stepTitle="Step 4 · Equipment Roll Call"
                question="What equipment do you have ready?"
                summaryText={`Equipment: ${equipment}`}
                value={equipment}
                setValue={setEquipment}
                hasListened={step4Listened}
                isLocked={step4Locked}
                isPlaying={isPlaying}
                placeholder="Skillet, cutting board, knife, mixing bowl..."
                inputType="textarea"
                onListen={() => {
                  if (step4Listened || isPlaying) return;
                  speak(KITCHEN_STUDIO_EQUIPMENT, () => setStep4Listened(true));
                }}
                onSubmit={() => {
                  setStep4Locked(true);
                  setStudioStep(5);
                  speak(KITCHEN_STUDIO_EQUIPMENT_CONFIRMED);
                }}
              />
            )}

            {/* Step 5 - Final: Meal Generation (placeholder) */}
            {studioStep >= 5 && (
              <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                <CardContent className="p-4 space-y-4">
                  <div className="text-center py-8">
                    <Sparkles className="h-8 w-8 text-orange-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">
                      Ready to Create Your Meal
                    </h3>
                    <p className="text-sm text-white/70 mb-4">
                      Based on your preferences, we'll generate a complete meal
                      with macros, ingredients, and instructions.
                    </p>
                    <div className="rounded-xl border border-white/20 bg-black/40 p-4 text-left space-y-2">
                      <p className="text-xs text-white/60">Your session:</p>
                      <p className="text-sm text-white/90">
                        <strong>Dish:</strong> {dishIdea}
                      </p>
                      <p className="text-sm text-white/90">
                        <strong>Method:</strong> {cookMethod}
                      </p>
                      <p className="text-sm text-white/90">
                        <strong>Notes:</strong>{" "}
                        {ingredientNotes || "None"}
                      </p>
                      <p className="text-sm text-white/90">
                        <strong>Equipment:</strong> {equipment}
                      </p>
                    </div>
                    <button
                      className="w-full py-3 mt-4 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm transition"
                      data-testid="button-generate-meal"
                    >
                      Generate My Meal
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
