// client/src/pages/craving-creator/CravingStudio.tsx
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Refrigerator,
  Sparkles,
  ChefHat,
  FlameIcon,
  Loader2,
  Users,
  Brain,
  Flame,
} from "lucide-react";

import { KitchenStepCard } from "@/components/chefs-kitchen/KitchenStepCard";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import { apiUrl } from "@/lib/resolveApiBase";

import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import MealCardActions from "@/components/MealCardActions";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import {
  generateMedicalBadges,
  getUserMedicalProfile,
} from "@/utils/medicalPersonalization";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import TalkToChefButton from "@/components/voice/TalkToChefButton";
import { useVoiceStudio } from "@/hooks/useVoiceStudio";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { FlavorToggle } from "@/components/FlavorToggle";

type StudioStep = 1 | 2 | 3 | 4 | 5;

interface GeneratedMeal {
  id: string;
  name: string;
  description?: string;
  mealType?: string;
  ingredients: Array<{
    name: string;
    quantity?: string;
    amount?: number;
    unit?: string;
    notes?: string;
  }>;
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
  servings?: number;
  reasoning?: string;
}

// Keep it consistent with Chef’s Kitchen: normalize to step array for prep mode later.
function normalizeInstructions(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const filtered = raw.filter(Boolean);
    if (filtered.length > 1) return filtered;
    if (filtered.length === 1) return normalizeInstructions(filtered[0]);
    return filtered;
  }

  const numberedInlinePattern = /\b(\d+[\.\):])\s+/g;
  const hasNumberedSteps = numberedInlinePattern.test(raw);

  if (hasNumberedSteps) {
    return raw
      .split(/\b\d+[\.\):]\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.endsWith(".") ? s : s + "."));
  }

  const sentences = raw
    .split(/\.\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(".") ? s : s + "."));

  return sentences.length ? sentences : [raw];
}

/** Voice scripts (tight + not corny) */
const CRAVING_STUDIO_INTRO = "Alright — what are we craving today?";
const CRAVING_STUDIO_STEP2 =
  "Any dietary preferences, allergies, or foods you want to avoid?";
const CRAVING_STUDIO_STEP3 =
  "Anything custom? Low sugar, low sodium, gluten-free, special diets?";
const CRAVING_STUDIO_STEP4 = "How many servings?";
const CRAVING_STUDIO_OPEN_START = "";
const CRAVING_STUDIO_OPEN_PROGRESS1 =
  "If you are satisfied with your meal press the Enter Chef’s Kitchen button, if not, press, Create New, and we create a new meal.";
const CRAVING_STUDIO_OPEN_PROGRESS2 = "";
const CRAVING_STUDIO_OPEN_COMPLETE = "";

export default function CravingStudio() {
  const [, setLocation] = useLocation();

  // Studio flow
  const [studioStep, setStudioStep] = useState<StudioStep>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const { speak, stop: stopChef } = useChefVoice(setIsPlaying);

  // Step 1 — craving
  const [craving, setCraving] = useState("");
  const [s1Listened, setS1Listened] = useState(false);
  const [s1Locked, setS1Locked] = useState(false);

  // Step 2 — dietary prefs
  const [dietaryPrefs, setDietaryPrefs] = useState("");
  const [s2Listened, setS2Listened] = useState(false);
  const [s2Locked, setS2Locked] = useState(false);

  // Step 3 — servings
  const [servings, setServings] = useState<number>(2);
  const [s3Listened, setS3Listened] = useState(false);
  const [s3Locked, setS3Locked] = useState(false);

  // Step 4 — custom restrictions / notes
  const [customNotes, setCustomNotes] = useState("");
  const [s4Listened, setS4Listened] = useState(false);
  const [s4Locked, setS4Locked] = useState(false);

  // Step 5 — generate
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Voice studio ref for stopping voice when editing steps
  const voiceStopRef = useRef<(() => void) | null>(null);

  const [generatedMeal, setGeneratedMeal] = useState<GeneratedMeal | null>(
    null,
  );
  const [displayMeal, setDisplayMeal] = useState<GeneratedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SafetyGuard preflight system
  const {
    checking: safetyChecking,
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride,
  } = useSafetyGuardPrecheck();
  const [pendingGeneration, setPendingGeneration] = useState(false);
  
  // 🎨 FlavorToggle state (Personal = use palate prefs, Neutral = skip them)
  const [flavorPersonal, setFlavorPersonal] = useState(true);

  const handleSafetyOverride = (token: string) => {
    setOverrideToken(token);
    setPendingGeneration(true);
  };

  // Auto-generate after override token is set
  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGenerating) {
      setPendingGeneration(false);
      doGenerate(true);
    }
  }, [pendingGeneration, overrideToken, isGenerating]);

  const mealToShow = displayMeal || generatedMeal;

  // Persistence key for Craving Studio meal
  const CRAVING_MEAL_KEY = "mpm_craving_studio_meal";

  // Load persisted meal on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CRAVING_MEAL_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GeneratedMeal;
        setGeneratedMeal(parsed);
        setStudioStep(5);
        // Lock all steps since we have a generated meal
        setS1Locked(true);
        setS2Locked(true);
        setS3Locked(true);
        setS4Locked(true);
        setCraving(parsed.name || "");
        // Hydrate servings from persisted meal
        if (parsed.servings) {
          setServings(parsed.servings);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Persist meal when generated
  useEffect(() => {
    if (generatedMeal) {
      try {
        localStorage.setItem(CRAVING_MEAL_KEY, JSON.stringify(generatedMeal));
      } catch {
        // Ignore storage errors
      }
    }
  }, [generatedMeal]);

  // Edits
  // Edit step handlers (also stop voice if active)
  const stopVoiceIfActive = () => {
    voiceStopRef.current?.();
  };

  const editStep1 = () => {
    stopVoiceIfActive();
    setS1Locked(false);
    setS2Locked(false);
    setS3Locked(false);
    setS4Locked(false);
    setS2Listened(false);
    setS3Listened(false);
    setS4Listened(false);
    setStudioStep(1);
  };

  const editStep2 = () => {
    stopVoiceIfActive();
    setS2Locked(false);
    setS3Locked(false);
    setS4Locked(false);
    setS3Listened(false);
    setS4Listened(false);
    setStudioStep(2);
  };

  const editStep3 = () => {
    stopVoiceIfActive();
    setS3Locked(false);
    setS4Locked(false);
    setS4Listened(false);
    setStudioStep(3);
  };

  const editStep4 = () => {
    stopVoiceIfActive();
    setS4Locked(false);
    setStudioStep(4);
  };

  const restartStudio = () => {
    setStudioStep(1);
    setCraving("");
    setDietaryPrefs("");
    setServings(2);
    setCustomNotes("");
    setS1Listened(false);
    setS2Listened(false);
    setS3Listened(false);
    setS4Listened(false);
    setS1Locked(false);
    setS2Locked(false);
    setS3Locked(false);
    setS4Locked(false);

    setIsGenerating(false);
    setProgress(0);
    setGeneratedMeal(null);
    setDisplayMeal(null);
    setError(null);

    // Clear persisted meal when restarting
    localStorage.removeItem(CRAVING_MEAL_KEY);

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = null;

    stopChef();
  };

  useEffect(() => {
    document.title = "Craving Studio ✨ | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current)
        clearInterval(progressIntervalRef.current);
    };
  }, []);

  const buildCravingPrompt = () => {
    const parts: string[] = [];
    parts.push(`Craving: ${craving}`);
    if (dietaryPrefs?.trim()) parts.push(`Dietary: ${dietaryPrefs.trim()}`);
    if (customNotes?.trim()) parts.push(`Notes: ${customNotes.trim()}`);
    return parts.join(". ");
  };

  // Main entry point - runs preflight check first
  const generateMeal = async () => {
    const prompt = buildCravingPrompt();
    
    // Run SafetyGuard preflight check
    const isSafe = await checkSafety(prompt, "craving-studio");
    if (!isSafe) {
      // Alert will be shown by SafetyGuardBanner
      return;
    }
    
    // Safe to proceed
    doGenerate(false);
  };

  // Actual generation logic
  const doGenerate = async (skipPreflight: boolean) => {
    setIsGenerating(true);
    setProgress(10);
    setError(null);

    stopChef();
    speak(CRAVING_STUDIO_OPEN_START);

    progressIntervalRef.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.floor(Math.random() * 8) + 4));
    }, 700);

    setTimeout(() => speak(CRAVING_STUDIO_OPEN_PROGRESS1), 1700);
    setTimeout(() => speak(CRAVING_STUDIO_OPEN_PROGRESS2), 3400);

    try {
      const prompt = buildCravingPrompt();
      const fullUrl = apiUrl("/api/meals/craving-creator");

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cravingInput: prompt,
          targetMealType: "dinner",
          servings,
          safetyMode: hasActiveOverride ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: hasActiveOverride ? overrideToken : undefined,
          skipPalate: !flavorPersonal,
        }),
      });

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to generate meal: ${response.status} ${errorText}`,
        );
      }

      const data = await response.json();
      const meal = data?.meal;

      if (!meal) throw new Error("No meal data returned from API");

      const srcNutrition = meal.nutrition || {};
      const nutritionCalories = srcNutrition.calories ?? meal.calories ?? 0;
      const nutritionProtein = srcNutrition.protein ?? meal.protein ?? 0;
      const nutritionCarbs = srcNutrition.carbs ?? meal.carbs ?? 0;
      const nutritionFat = srcNutrition.fat ?? meal.fat ?? 0;

      const normalized: GeneratedMeal = {
        id: meal.id || crypto.randomUUID(),
        name: meal.name || meal.title || "Craving Creation",
        description: meal.description || meal.reasoning,
        mealType: meal.mealType || "dinner",
        ingredients: Array.isArray(meal.ingredients)
          ? meal.ingredients.map((ing: any) => {
              if (typeof ing === "string") return { name: ing };
              return {
                // Handle both 'item' (from meal-engine) and 'name' (from other APIs)
                name: ing.name || ing.item || "",
                quantity: ing.quantity,
                amount: ing.amount ?? ing.grams,
                unit: ing.unit ?? "g",
                notes: ing.notes ?? "",
              };
            })
          : [],
        instructions: normalizeInstructions(
          meal.cookingInstructions || meal.instructions,
        ),
        imageUrl: meal.imageUrl,
        calories: nutritionCalories,
        protein: nutritionProtein,
        carbs: nutritionCarbs,
        fat: nutritionFat,
        nutrition: {
          calories: nutritionCalories,
          protein: nutritionProtein,
          carbs: nutritionCarbs,
          fat: nutritionFat,
        },
        medicalBadges: Array.isArray(meal.medicalBadges)
          ? meal.medicalBadges
          : [],
        flags: Array.isArray(meal.flags) ? meal.flags : [],
        servingSize:
          meal.servingSize ||
          `${servings} ${servings === 1 ? "serving" : "servings"}`,
        servings: meal.servings || servings,
        reasoning: meal.reasoning,
      };

      setProgress(100);
      setIsGenerating(false);
      setGeneratedMeal(normalized);

      setTimeout(() => speak(CRAVING_STUDIO_OPEN_COMPLETE), 500);
    } catch (e) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setIsGenerating(false);
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(`${msg}. Please try again.`);
      // eslint-disable-next-line no-console
      console.error("🚨 Craving Studio error:", e);
    }
  };

  // Voice studio integration - hands-free mode
  const voiceStudio = useVoiceStudio({
    steps: [
      {
        voiceScript: CRAVING_STUDIO_INTRO,
        setValue: setCraving,
        setLocked: setS1Locked,
        setListened: setS1Listened,
      },
      {
        voiceScript: CRAVING_STUDIO_STEP2,
        setValue: setDietaryPrefs,
        setLocked: setS2Locked,
        setListened: setS2Listened,
      },
      {
        voiceScript: CRAVING_STUDIO_STEP3,
        setValue: (val) => {
          const num = parseInt(val.replace(/\D/g, ""), 10);
          setServings(num > 0 && num <= 10 ? num : 2);
        },
        setLocked: setS3Locked,
        setListened: setS3Listened,
        parseValue: (transcript) => {
          const words: Record<string, number> = {
            one: 1,
            two: 2,
            three: 3,
            four: 4,
            five: 5,
            six: 6,
            seven: 7,
            eight: 8,
            nine: 9,
            ten: 10,
          };
          const lower = transcript.toLowerCase();
          for (const [word, num] of Object.entries(words)) {
            if (lower.includes(word)) return String(num);
          }
          const match = transcript.match(/\d+/);
          return match ? match[0] : "2";
        },
      },
      {
        voiceScript: CRAVING_STUDIO_STEP4,
        setValue: setCustomNotes,
        setLocked: setS4Locked,
        setListened: setS4Listened,
      },
    ],
    onAllStepsComplete: generateMeal,
    setStudioStep: (step) => setStudioStep(step as StudioStep),
  });

  // Assign stop function to ref for edit handlers (in effect to avoid render-time side effects)
  useEffect(() => {
    voiceStopRef.current = voiceStudio.stopVoiceMode;
  }, [voiceStudio.stopVoiceMode]);

  const goToChefsKitchenPrepare = () => {
    if (!generatedMeal) return;
    try {
      localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
      localStorage.setItem(
        "mpm_chefs_kitchen_meal",
        JSON.stringify(generatedMeal),
      );
      localStorage.removeItem("mpm_chefs_kitchen_prep");
    } catch {
      // ignore
    }
    setLocation("/chefs-kitchen");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-40"
    >
      {/* Safe-Area Header (same pattern as Chef’s Kitchen) */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 pb-3 flex items-center gap-2 flex-nowrap overflow-hidden">
          <button
            onClick={() => setLocation("/lifestyle")}
            className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            data-testid="button-back-to-lifestyle"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <h1 className="text-lg font-bold text-white truncate min-w-0">
            Craving Studio <span className="text-xl leading-none">✨</span>
          </h1>

          <div className="flex-grow" />
        </div>
      </div>

      <div
        className="px-4 space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)" }}
      >
        {/* Intro Card */}
        <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-lime-400" />
              <h2 className="text-lg font-bold text-white">Create with Chef</h2>
            </div>
            <p className="text-sm text-white/80">
              Same system as Chef&apos;s Kitchen — answer a few quick steps,
              then we generate a full meal card.
            </p>
          </CardContent>
        </Card>

        {/* Step 1 — Craving */}
        {studioStep >= 1 && (
          <KitchenStepCard
            stepTitle="Step 1 · The Craving"
            question="What are you craving?"
            summaryText={craving ? `Craving: ${craving}` : "Pick a craving"}
            value={craving}
            setValue={setCraving}
            hasListened={s1Listened}
            isLocked={s1Locked}
            isPlaying={isPlaying}
            placeholder="e.g., tacos, pizza, pancakes, something sweet..."
            inputType="textarea"
            onInputFocus={stopChef}
            onListen={() => {
              if (s1Listened || isPlaying) return;
              speak(CRAVING_STUDIO_INTRO, () => setS1Listened(true));
            }}
            onSubmit={() => {
              stopChef();
              setS1Locked(true);
              setStudioStep(2);
            }}
            onEdit={() => {
              stopChef();
              editStep1();
            }}
            canEdit={!generatedMeal && !isGenerating}
          />
        )}

        {/* Step 2 — Dietary (Yes/No pattern) */}
        {studioStep >= 2 && (
          <KitchenStepCard
            stepTitle="Step 2 · Dietary Preferences"
            question="Any dietary preference, allergy, or avoid list?"
            summaryText={
              dietaryPrefs ? `Dietary: ${dietaryPrefs}` : "No dietary notes"
            }
            value={dietaryPrefs}
            setValue={setDietaryPrefs}
            hasListened={s2Listened}
            isLocked={s2Locked}
            isPlaying={isPlaying}
            placeholder="e.g., high protein, gluten-free, no dairy, no peanuts..."
            inputType="yesno"
            yesnoConfig={{
              noLabel: "No, I'm good",
              yesLabel: "Yes, add preferences",
              noValue: "None",
              yesPlaceholder:
                "e.g., high protein, gluten-free, no dairy, no peanuts...",
            }}
            onInputFocus={stopChef}
            onListen={() => {
              if (s2Listened || isPlaying) return;
              speak(CRAVING_STUDIO_STEP2, () => setS2Listened(true));
            }}
            onSubmit={() => {
              stopChef();
              setS2Locked(true);
              setStudioStep(3);
            }}
            onEdit={() => {
              stopChef();
              editStep2();
            }}
            canEdit={!generatedMeal && !isGenerating}
          />
        )}

        {/* Step 3 — Custom Notes (Yes/No pattern) */}
        {studioStep >= 3 && (
          <KitchenStepCard
            stepTitle="Step 3 · Custom Notes"
            question="Any custom restriction or tweak?"
            summaryText={
              customNotes ? `Notes: ${customNotes}` : "No custom notes"
            }
            value={customNotes}
            setValue={setCustomNotes}
            hasListened={s4Listened}
            isLocked={s4Locked}
            isPlaying={isPlaying}
            placeholder="e.g., lower sugar, low sodium, 15-minute meal, extra veggies..."
            inputType="yesno"
            yesnoConfig={{
              noLabel: "No, I'm good",
              yesLabel: "Yes, add notes",
              noValue: "None",
              yesPlaceholder:
                "e.g., lower sugar, low sodium, 15-minute meal, extra veggies...",
            }}
            onInputFocus={stopChef}
            onListen={() => {
              if (s4Listened || isPlaying) return;
              speak(CRAVING_STUDIO_STEP3, () => setS4Listened(true));
            }}
            onSubmit={() => {
              stopChef();
              setS4Locked(true);
              setStudioStep(4);
            }}
            onEdit={() => {
              stopChef();
              editStep4();
            }}
            canEdit={!generatedMeal && !isGenerating}
          />
        )}
        {/* Step 4 — Servings */}
        {studioStep >= 4 && (
          <KitchenStepCard
            stepTitle="Step 4 · Servings"
            question="How many servings?"
            summaryText={`Servings: ${servings} ${servings === 1 ? "person" : "people"}`}
            value={String(servings)}
            setValue={(v) => setServings(Number(v) || 2)}
            hasListened={s3Listened}
            isLocked={s3Locked}
            isPlaying={isPlaying}
            inputType="buttons"
            buttonOptions={["1", "2", "3", "4", "5", "6"]}
            onInputFocus={stopChef}
            onListen={() => {
              if (s3Listened || isPlaying) return;
              speak(CRAVING_STUDIO_STEP4, () => setS3Listened(true));
            }}
            onSubmit={() => {
              stopChef();
              setS3Locked(true);
              setStudioStep(5);

              speak("If everything looks good, tap, Create the Plan.");
            }}
            onEdit={() => {
              stopChef();
              editStep3();
            }}
            canEdit={!generatedMeal && !isGenerating}
          />
        )}

        {/* Step 5 — Generate */}
        {studioStep >= 5 && (
          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-white">Generate</h3>
              </div>

              {/* Not started */}
              {!isGenerating && !generatedMeal && !error && (
                <div className="text-center py-6">
                  <Sparkles className="h-8 w-8 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">
                    Ready to Create Your Meal
                  </h3>
                  <p className="text-sm text-white/70 mb-4">
                    We’ll generate a full meal card with ingredients, macros,
                    and cooking steps.
                  </p>

                  <div className="rounded-xl border border-white/20 bg-black/40 p-4 text-left space-y-2 mb-4">
                    <p className="text-xs text-white/60">Your session:</p>
                    <p className="text-sm text-white/90">
                      <strong>Craving:</strong> {craving}
                    </p>
                    <p className="text-sm text-white/90">
                      <strong>Dietary:</strong> {dietaryPrefs || "None"}
                    </p>
                    <p className="text-sm text-white/90">
                      <strong>Servings:</strong> {servings}{" "}
                      {servings === 1 ? "person" : "people"}
                    </p>
                    <p className="text-sm text-white/90">
                      <strong>Notes:</strong> {customNotes || "None"}
                    </p>
                  </div>

                  {/* SafetyGuard Banner */}
                  {safetyAlert.show && (
                    <SafetyGuardBanner
                      alert={safetyAlert}
                      mealRequest={buildCravingPrompt()}
                      onDismiss={clearSafetyAlert}
                      onOverrideSuccess={handleSafetyOverride}
                      className="mb-4"
                    />
                  )}

                  {/* Flavor Toggle */}
                  <div className="mb-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                    <FlavorToggle
                      flavorPersonal={flavorPersonal}
                      onFlavorChange={setFlavorPersonal}
                      disabled={isGenerating || safetyChecking}
                    />
                  </div>

                  <button
                    className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-semibold text-sm transition disabled:opacity-50"
                    onClick={generateMeal}
                    disabled={safetyChecking}
                    data-testid="button-generate-craving-meal"
                  >
                    {safetyChecking ? "Checking safety…" : "Create the plan"}
                  </button>
                </div>
              )}

              {/* Generating */}
              {isGenerating && !generatedMeal && (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 text-lime-500 mx-auto mb-4 animate-spin" />
                  <p className="text-sm text-white/80 mb-4">
                    Creating your meal…
                  </p>
                  <div className="w-full bg-black/40 border border-white/20 rounded-lg h-3 overflow-hidden">
                    <div
                      className="bg-lime-600 h-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="text-center py-6">
                  <p className="text-sm text-red-400 mb-4">{error}</p>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm transition"
                      onClick={generateMeal}
                    >
                      Try Again
                    </button>
                    <button
                      className="flex-1 py-3 rounded-xl bg-black/40 border border-white/20 text-white text-sm transition"
                      onClick={restartStudio}
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              )}

              {/* Meal Ready */}
              {generatedMeal && mealToShow && (
                <div className="space-y-4">
                  {/* Title + Create New */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-6 w-6 text-yellow-600" />
                      <h3 className="text-xl font-bold text-white">
                        {mealToShow.name}
                      </h3>
                    </div>
                    <button
                      onClick={restartStudio}
                      className="text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
                    >
                      Create New
                    </button>
                  </div>

                  {mealToShow.description && (
                    <p className="text-white/90">{mealToShow.description}</p>
                  )}

                  {/* Image */}
                  {mealToShow.imageUrl && (
                    <div className="rounded-lg overflow-hidden">
                      <img
                        src={mealToShow.imageUrl}
                        alt={mealToShow.name}
                        className="w-full h-64 object-cover"
                      />
                    </div>
                  )}

                  {/* Serving Size */}
                  <div className="p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">Serving Size:</span>
                      <span>
                        {mealToShow.servingSize ||
                          `${servings} ${servings === 1 ? "serving" : "servings"}`}
                      </span>
                    </div>
                  </div>

                  {/* Macros */}
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                      <div className="text-lg font-bold text-white">
                        {mealToShow.calories || 0}
                      </div>
                      <div className="text-xs text-white">Calories</div>
                    </div>
                    <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                      <div className="text-lg font-bold text-white">
                        {mealToShow.protein || 0}g
                      </div>
                      <div className="text-xs text-white">Protein</div>
                    </div>
                    <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                      <div className="text-lg font-bold text-white">
                        {mealToShow.carbs || 0}g
                      </div>
                      <div className="text-xs text-white">Carbs</div>
                    </div>
                    <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                      <div className="text-lg font-bold text-white">
                        {mealToShow.fat || 0}g
                      </div>
                      <div className="text-xs text-white">Fat</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <AddToMealPlanButton meal={generatedMeal} />
                    <MealCardActions
                      meal={{
                        name: generatedMeal.name,
                        description: generatedMeal.description,
                        ingredients: generatedMeal.ingredients.map((ing) => ({
                          name: ing.name,
                          amount: String(ing.amount ?? ing.quantity ?? ""),
                          unit: ing.unit,
                        })),
                        instructions: generatedMeal.instructions,
                        nutrition: generatedMeal.nutrition,
                      }}
                      onContentUpdate={(updated) => {
                        setDisplayMeal({
                          ...generatedMeal,
                          name: updated.name || generatedMeal.name,
                          description:
                            updated.description || generatedMeal.description,
                          instructions:
                            updated.instructions || generatedMeal.instructions,
                        });
                      }}
                    />
                  </div>

                  {/* Medical Badges */}
                  {(() => {
                    const profile = getUserMedicalProfile(1);
                    const mealForBadges = {
                      name: generatedMeal.name,
                      calories: generatedMeal.calories || 0,
                      protein: generatedMeal.protein || 0,
                      carbs: generatedMeal.carbs || 0,
                      fat: generatedMeal.fat || 0,
                      ingredients: generatedMeal.ingredients.map((ing) => ({
                        name: ing.name,
                        amount: ing.amount ?? 1,
                        unit: (ing.unit ?? "serving").toLowerCase(),
                      })),
                    };
                    const medicalBadges = generatedMeal.medicalBadges?.length
                      ? generatedMeal.medicalBadges
                      : generateMedicalBadges(mealForBadges as any, profile);

                    return medicalBadges && medicalBadges.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <HealthBadgesPopover
                          badges={medicalBadges.map((b: any) =>
                            typeof b === "string"
                              ? b
                              : b.badge || b.id || b.condition || b.label,
                          )}
                        />
                        <h3 className="font-semibold text-white">
                          Medical Safety
                        </h3>
                      </div>
                    ) : null;
                  })()}

                  {/* Ingredients */}
                  {generatedMeal.ingredients?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-white">
                        Ingredients:
                      </h4>
                      <ul className="text-sm text-white/80 space-y-1">
                        {generatedMeal.ingredients.map((ing, i) => (
                          <li key={i}>
                            {ing.amount ?? ing.quantity} {ing.unit} {ing.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Instructions */}
                  {mealToShow.instructions && (
                    <div>
                      <h4 className="font-semibold mb-2 text-white">
                        Instructions:
                      </h4>
                      <div className="text-sm text-white/80 whitespace-pre-line max-h-40 overflow-y-auto">
                        {Array.isArray(mealToShow.instructions)
                          ? mealToShow.instructions.join("\n")
                          : mealToShow.instructions}
                      </div>
                    </div>
                  )}

                  {/* Reasoning */}
                  {mealToShow.reasoning && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                        <Brain className="h-4 w-4" />
                        Why This Works For You:
                      </h4>
                      <p className="text-sm text-white/80">
                        {mealToShow.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Final CTA → Chef’s Kitchen */}
                  <button
                    onClick={goToChefsKitchenPrepare}
                    className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-semibold text-sm transition"
                    data-testid="button-enter-chefs-kitchen"
                  >
                    Enter Chef&apos;s Kitchen
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Extra padding for shopping bar */}
        {generatedMeal && generatedMeal.ingredients?.length > 0 && (
          <div className="h-28" />
        )}
      </div>

      {/* Shopping Aggregate Bar */}
      {generatedMeal && generatedMeal.ingredients?.length > 0 && (
        <ShoppingAggregateBar
          ingredients={generatedMeal.ingredients.map((ing) => ({
            name: ing.name,
            qty: ing.amount ?? ing.quantity,
            unit: ing.unit || "",
          }))}
          source="Craving Studio"
          sourceSlug="craving-studio"
        />
      )}

      {/* Floating Hands-Free Voice Button - temporarily hidden until mobile experience improves */}
      {/* {!isGenerating && !generatedMeal && (
        <TalkToChefButton
          voiceState={voiceStudio.voiceState}
          currentStep={voiceStudio.currentVoiceStep}
          totalSteps={4}
          lastTranscript={voiceStudio.lastTranscript}
          isPlaying={voiceStudio.isPlaying}
          onStart={voiceStudio.startVoiceMode}
          onStop={voiceStudio.stopVoiceMode}
        />
      )} */}
    </motion.div>
  );
}
