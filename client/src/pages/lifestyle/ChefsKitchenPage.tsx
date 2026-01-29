import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Sparkles,
  ChefHat,
  Loader2,
  Users,
  Brain,
  Play,
  Pause,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { KitchenStepCard } from "@/components/chefs-kitchen/KitchenStepCard";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import TalkToChefButton from "@/components/voice/TalkToChefButton";
import VoiceModeOverlay from "@/components/voice/VoiceModeOverlay";
import { useVoiceStudio } from "@/hooks/useVoiceStudio";
import { apiUrl } from "@/lib/resolveApiBase";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import MealCardActions from "@/components/MealCardActions";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import {
  generateMedicalBadges,
  getUserMedicalProfile,
} from "@/utils/medicalPersonalization";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { setQuickView } from "@/lib/macrosQuickView";
import {
  extractTimerSeconds,
  formatTimeRemaining,
} from "@/components/chefs-kitchen/timerUtils";
import {
  KITCHEN_STUDIO_INTRO,
  KITCHEN_STUDIO_STEP2,
  KITCHEN_STUDIO_COOK_METHOD,
  KITCHEN_STUDIO_COOK_CONFIRMED,
  KITCHEN_STUDIO_INGREDIENTS_PACE,
  KITCHEN_STUDIO_INGREDIENTS_CONFIRMED,
  KITCHEN_STUDIO_SERVINGS,
  KITCHEN_STUDIO_SERVINGS_CONFIRMED,
  KITCHEN_STUDIO_EQUIPMENT,
  KITCHEN_STUDIO_EQUIPMENT_CONFIRMED,
  KITCHEN_STUDIO_OPEN_START,
  KITCHEN_STUDIO_OPEN_PROGRESS1,
  KITCHEN_STUDIO_OPEN_PROGRESS2,
  KITCHEN_STUDIO_OPEN_COMPLETE,
  EQUIPMENT_BY_METHOD,
  // Phase 2 - Cooking narration
  KITCHEN_COOK_SETUP,
  KITCHEN_COOK_READY,
  KITCHEN_TIMER_START,
  KITCHEN_TIMER_DONE,
  KITCHEN_PLATING,
  KITCHEN_FINISHED,
} from "@/components/copilot/scripts/kitchenStudioScripts";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";

type KitchenMode = "entry" | "studio" | "prepare";

// Normalize instructions to always be an array for Phase 2 step-by-step navigation
function normalizeInstructions(raw: string | string[] | undefined): string[] {
  if (!raw) return [];

  // If array, always try to split single-element arrays that might be paragraphs
  if (Array.isArray(raw)) {
    const filtered = raw.filter(Boolean);
    // If we have multiple items already, return them
    if (filtered.length > 1) return filtered;
    // If single item, always try to parse it as a string (could be paragraph)
    if (filtered.length === 1) {
      const parsed = normalizeInstructions(filtered[0]);
      // Only use parsed result if it produced multiple steps
      return parsed.length > 1 ? parsed : filtered;
    }
    return filtered;
  }

  // Split paragraph into steps - try numbered steps first (inline or newline separated)
  // Pattern matches: "1. ", "1) ", "Step 1:", etc.
  const numberedInlinePattern = /\b(\d+[\.\):])\s+/g;
  const hasNumberedSteps = numberedInlinePattern.test(raw);

  if (hasNumberedSteps) {
    // Split on numbered patterns like "1. " or "2) "
    return raw
      .split(/\b\d+[\.\):]\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\.$/, "").trim() + ".");
  }

  // Fall back to sentence splitting (split on ". " followed by capital letter or end)
  const sentences = raw
    .split(/\.\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(".") ? s : s + "."));

  return sentences.length > 0 ? sentences : [raw];
}

// Check for external prepare mode synchronously on load
// NOTE: We do NOT clear flags here due to React StrictMode double-render in dev
function getInitialMode(): { mode: KitchenMode; meal: GeneratedMeal | null } {
  try {
    const externalPrepare = localStorage.getItem(
      "mpm_chefs_kitchen_external_prepare",
    );
    const saved = localStorage.getItem("mpm_chefs_kitchen_meal");

    // 🔥 PRODUCTION DIAGNOSTIC - Remove after verification
    console.log(
      "🔥 CHEF KITCHEN INIT - externalPrepare:",
      externalPrepare,
      "hasMeal:",
      !!saved,
    );

    if (externalPrepare === "true" && saved) {
      const parsed = JSON.parse(saved) as GeneratedMeal;
      // Normalize instructions for Phase 2 step-by-step
      parsed.instructions = normalizeInstructions(parsed.instructions);
      console.log("🔥 CHEF KITCHEN → ENTERING PHASE 2 (prepare mode)");
      return { mode: "prepare", meal: parsed };
    }
  } catch (err) {
    console.log("🔥 CHEF KITCHEN INIT ERROR:", err);
  }
  console.log("🔥 CHEF KITCHEN → ENTERING PHASE 1 (entry mode)");
  return { mode: "entry", meal: null };
}

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

export default function ChefsKitchenPage() {
  const [, setLocation] = useLocation();
  const quickTour = useQuickTour("chefs-kitchen");

  // Check for external prepare mode SYNCHRONOUSLY on first render
  const initialState = getInitialMode();
  const [mode, setMode] = useState<KitchenMode>(initialState.mode);
  const [externalMeal] = useState<GeneratedMeal | null>(initialState.meal);

  // Clear localStorage flags AFTER mount to avoid React StrictMode double-render issues
  useEffect(() => {
    localStorage.removeItem("mpm_chefs_kitchen_external_prepare");
    localStorage.removeItem("mpm_chefs_kitchen_prep");
  }, []);

  // Kitchen Studio state (6 steps: Dish, Method, Preferences, Servings, Equipment, Generate)
  const [studioStep, setStudioStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const { speak, stop: stopChef } = useChefVoice(setIsPlaying);

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

  // Step 4 - Servings
  const [servings, setServings] = useState<number>(2);
  const [step4Listened, setStep4Listened] = useState(false);
  const [step4Locked, setStep4Locked] = useState(false);

  // Step 5 - Equipment
  const [equipment, setEquipment] = useState("");
  const [step5Listened, setStep5Listened] = useState(false);
  const [step5Locked, setStep5Locked] = useState(false);

  // Phase Two - Preparation Mode
  const [prepStep, setPrepStep] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice studio ref for stopping voice when editing steps
  const voiceStopRef = useRef<(() => void) | null>(null);

  // Stop voice if active (used when manually editing)
  const stopVoiceIfActive = () => {
    voiceStopRef.current?.();
  };

  // Get equipment list based on cooking method
  const suggestedEquipment = cookMethod
    ? EQUIPMENT_BY_METHOD[cookMethod] || []
    : [];

  // Edit handlers - unlock step and reset downstream (also stop voice if active)
  const editStep1 = () => {
    stopVoiceIfActive();
    setStep1Locked(false);
    setStep2Locked(false);
    setStep3Locked(false);
    setStep4Locked(false);
    setStep5Locked(false);
    setStep2Listened(false);
    setStep3Listened(false);
    setStep4Listened(false);
    setStep5Listened(false);
    setStudioStep(1);
  };

  const editStep2 = () => {
    stopVoiceIfActive();
    setStep2Locked(false);
    setStep3Locked(false);
    setStep4Locked(false);
    setStep5Locked(false);
    setStep3Listened(false);
    setStep4Listened(false);
    setStep5Listened(false);
    setCookMethod("");
    setEquipment("");
    setStudioStep(2);
  };

  const editStep3 = () => {
    stopVoiceIfActive();
    setStep3Locked(false);
    setStep4Locked(false);
    setStep5Locked(false);
    setStep4Listened(false);
    setStep5Listened(false);
    setStudioStep(3);
  };

  const editStep4 = () => {
    stopVoiceIfActive();
    setStep4Locked(false);
    setStep5Locked(false);
    setStep5Listened(false);
    setStudioStep(4);
  };

  const editStep5 = () => {
    stopVoiceIfActive();
    setStep5Locked(false);
    setStudioStep(5);
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
    setServings(2);
    setStep4Listened(false);
    setStep4Locked(false);
    setEquipment("");
    setStep5Listened(false);
    setStep5Locked(false);

    // Clear generation state
    setIsGeneratingMeal(false);
    setGenerationProgress(0);
    setGeneratedMeal(null);
    setGenerationError(null);

    // Clear Phase Two state
    setPrepStep(0);
    setIsTimerRunning(false);
    setTimerSeconds(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Clear persisted meal and prep state
    try {
      localStorage.removeItem("mpm_chefs_kitchen_meal");
      localStorage.removeItem("mpm_chefs_kitchen_prep");
    } catch {
      // Ignore storage errors
    }

    // Clear any running progress interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    // Return to studio mode
    setMode("studio");
  };

  // Timer countdown effect
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            // Timer finished - speak alert
            speak(KITCHEN_TIMER_DONE);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTimerRunning, timerSeconds > 0]);

  // Step 5 - Open Kitchen
  const [isGeneratingMeal, setIsGeneratingMeal] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Safety override integration - always starts ON, auto-resets after generation
  const [safetyEnabled, setSafetyEnabled] = useState(true);

  // 🔐 SafetyGuard preflight system
  const {
    checking: safetyChecking,
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setAlert: setSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride,
  } = useSafetyGuardPrecheck();

  // 🔐 Pending request for SafetyGuard continuation bridge
  const [pendingGeneration, setPendingGeneration] = useState(false);

  // Handle safety override continuation - auto-generate when override token received
  const handleSafetyOverride = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert(); // Clear banner on successful override
      // Set pending flag - generation will auto-trigger
      setPendingGeneration(true);
    }
  };

  // Effect: Auto-generate when override token is set and generation is pending
  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGeneratingMeal) {
      setPendingGeneration(false);
      startOpenKitchen(true); // true = skip preflight (already have override)
    }
  }, [pendingGeneration, overrideToken, isGeneratingMeal]);

  // Initialize with external meal if coming from prepare mode
  const [generatedMeal, setGeneratedMeal] = useState<GeneratedMeal | null>(
    externalMeal,
  );
  const [generationError, setGenerationError] = useState<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Display meal for translations (allows showing translated content while preserving original)
  const [displayMeal, setDisplayMeal] = useState<GeneratedMeal | null>(null);

  // Use displayMeal for rendering, fallback to generatedMeal
  const mealToShow = displayMeal || generatedMeal;

  // Persistence key for Chef's Kitchen meal
  const CHEF_MEAL_KEY = "mpm_chefs_kitchen_meal";

  // Load persisted meal on mount (only for studio/entry mode - external prepare is handled synchronously)
  useEffect(() => {
    // Skip if we already have an external meal loaded for prepare mode
    if (externalMeal) return;

    try {
      const saved = localStorage.getItem(CHEF_MEAL_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as GeneratedMeal;
        setGeneratedMeal(parsed);
        setStudioStep(6);
        // Lock all steps since we have a generated meal
        setStep1Locked(true);
        setStep2Locked(true);
        setStep3Locked(true);
        setStep4Locked(true);
        setStep5Locked(true);
        setDishIdea(parsed.name || "");
        // Hydrate servings from persisted meal
        if (parsed.servings) {
          setServings(parsed.servings);
        }
        setMode("studio");
      }
    } catch {
      // Ignore parse errors
    }
  }, [externalMeal]);

  // Persist meal when generated
  useEffect(() => {
    if (generatedMeal) {
      try {
        localStorage.setItem(CHEF_MEAL_KEY, JSON.stringify(generatedMeal));
      } catch {
        // Ignore storage errors
      }
    }
  }, [generatedMeal]);

  // Auto-trigger voice for Step 5 (Chef's Setup)
  useEffect(() => {
    if (studioStep === 5 && !step5Listened && !step5Locked && !isPlaying) {
      speak(KITCHEN_STUDIO_EQUIPMENT, () => setStep5Listened(true));
    }
  }, [studioStep, step5Listened, step5Locked, isPlaying]);

  // Persist prep state
  useEffect(() => {
    if (mode === "prepare" && generatedMeal) {
      try {
        localStorage.setItem(
          "mpm_chefs_kitchen_prep",
          JSON.stringify({
            prepStep,
            timerSeconds,
            isTimerRunning,
            mealId: generatedMeal.id,
          }),
        );
      } catch {
        // Ignore storage errors
      }
    }
  }, [mode, prepStep, timerSeconds, isTimerRunning, generatedMeal]);

  // Load prep state when meal is restored
  useEffect(() => {
    if (generatedMeal && mode === "studio") {
      try {
        const saved = localStorage.getItem("mpm_chefs_kitchen_prep");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.mealId === generatedMeal.id && parsed.prepStep > 0) {
            setPrepStep(parsed.prepStep);
            setTimerSeconds(parsed.timerSeconds || 0);
            setIsTimerRunning(parsed.isTimerRunning || false);
            setMode("prepare");
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [generatedMeal?.id]);

  useEffect(() => {
    document.title = "Chef's Kitchen 👨🏿‍🍳 | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Voice Studio configuration for hands-free mode (4 input steps)
  const KITCHEN_VOICE_STEP1 = "Alright — what are we making today?";
  const KITCHEN_VOICE_STEP2 =
    "Got it. How do you want to cook it? Stovetop, oven, air fryer, or something else?";
  const KITCHEN_VOICE_STEP3 =
    "Any specific ingredients you want, or anything you want to avoid?";
  const KITCHEN_VOICE_STEP4 = "How many servings should I make?";

  const voiceStudio = useVoiceStudio({
    steps: [
      {
        voiceScript: KITCHEN_VOICE_STEP1,
        setValue: setDishIdea,
        setLocked: setStep1Locked,
        setListened: setStep1Listened,
      },
      {
        voiceScript: KITCHEN_VOICE_STEP2,
        setValue: setCookMethod,
        setLocked: setStep2Locked,
        setListened: setStep2Listened,
        parseValue: (transcript) => {
          const lower = transcript.toLowerCase();
          if (
            lower.includes("stove") ||
            lower.includes("pan") ||
            lower.includes("skillet")
          )
            return "stovetop";
          if (
            lower.includes("oven") ||
            lower.includes("bake") ||
            lower.includes("roast")
          )
            return "oven";
          if (lower.includes("air") || lower.includes("fryer"))
            return "air fryer";
          if (lower.includes("grill")) return "grill";
          if (lower.includes("instant") || lower.includes("pressure"))
            return "instant pot";
          if (lower.includes("slow") || lower.includes("crock"))
            return "slow cooker";
          if (
            lower.includes("no cook") ||
            lower.includes("raw") ||
            lower.includes("fresh")
          )
            return "no-cook";
          return transcript;
        },
      },
      {
        voiceScript: KITCHEN_VOICE_STEP3,
        setValue: setIngredientNotes,
        setLocked: setStep3Locked,
        setListened: setStep3Listened,
      },
      {
        voiceScript: KITCHEN_VOICE_STEP4,
        setValue: (val) => {
          const num = parseInt(val.replace(/\D/g, ""), 10);
          setServings(num > 0 && num <= 12 ? num : 2);
        },
        setLocked: setStep4Locked,
        setListened: setStep4Listened,
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
            eleven: 11,
            twelve: 12,
          };
          const lower = transcript.toLowerCase();
          for (const [word, num] of Object.entries(words)) {
            if (lower.includes(word)) return String(num);
          }
          const match = transcript.match(/\d+/);
          return match ? match[0] : "2";
        },
      },
    ],
    onAllStepsComplete: (collectedValues: string[]) => {
      // Use collected values directly to avoid React state timing issues
      // Values order: [dishIdea, cookMethod, ingredientNotes, servings] - 4 steps
      const [voiceDish, voiceMethod, voiceIngredients, voiceServings] =
        collectedValues;
      console.log("🎤 Voice studio collected:", {
        voiceDish,
        voiceMethod,
        voiceIngredients,
        voiceServings,
      });

      // Skip step 5 (equipment) in hands-free mode - go directly to generation (step 6)
      // This prevents the step 5 useEffect from triggering overlapping TTS
      setStudioStep(6);
      setStep5Listened(true); // Mark as listened to prevent auto-speak
      setStep5Locked(true); // Lock to prevent interaction

      // Use suggested equipment as default since we don't ask for it in voice mode
      startOpenKitchenWithValues(
        voiceDish,
        voiceMethod,
        voiceIngredients,
        voiceServings,
        suggestedEquipment.join(", "),
      );
    },
    setStudioStep: (step) => setStudioStep(step as 1 | 2 | 3 | 4 | 5 | 6),
  });

  // Wire voiceStopRef to the voice studio
  useEffect(() => {
    voiceStopRef.current = voiceStudio.stopVoiceMode;
  }, [voiceStudio.stopVoiceMode]);

  // Phase 2: Calm transition when entering first cooking step
  useEffect(() => {
    if (mode === "prepare" && prepStep === 1) {
      speak(KITCHEN_COOK_READY);
    }
  }, [prepStep, mode]);

  // Reset displayMeal when generatedMeal changes
  useEffect(() => {
    setDisplayMeal(null);
  }, [generatedMeal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Core generation logic - accepts explicit values to avoid React state timing issues
  const generateMealWithValues = async (
    voiceDish: string,
    voiceMethod: string,
    voiceIngredients: string,
    voiceServingsStr: string,
    voiceEquipment: string,
    skipPreflight = false,
  ) => {
    // Parse servings from voice input
    const voiceServings =
      parseInt(voiceServingsStr?.replace(/\D/g, ""), 10) || 2;

    // 🔐 Preflight safety check - BEFORE starting progress bar
    if (!skipPreflight && !hasActiveOverride) {
      const requestDescription =
        `${voiceDish} ${voiceMethod} ${voiceIngredients}`.trim();
      const isSafe = await checkSafety(requestDescription, "chefs-kitchen");
      if (!isSafe) {
        return;
      }
    }

    setIsGeneratingMeal(true);
    setGenerationProgress(10);
    setGenerationError(null);

    // Note: Voice studio already speaks completion message, so skip TTS here to avoid overlap
    progressIntervalRef.current = setInterval(() => {
      setGenerationProgress((p) => {
        if (p >= 90) return p;
        return p + Math.floor(Math.random() * 8) + 4;
      });
    }, 700);

    try {
      const chefPromptParts = [
        `Create with Chef: ${voiceDish}`,
        `Cooking method: ${voiceMethod}`,
      ];

      if (voiceIngredients) {
        chefPromptParts.push(`Preferences: ${voiceIngredients}`);
      }

      const equipmentContext = voiceEquipment || suggestedEquipment.join(", ");
      if (equipmentContext) {
        chefPromptParts.push(`Equipment available: ${equipmentContext}`);
      }

      const cravingPrompt = chefPromptParts.join(". ");

      const fullUrl = apiUrl("/api/meal-engine/generate");
      console.log("🔥 CHEF KITCHEN API CALL - URL:", fullUrl);
      console.log("🔥 CHEF KITCHEN API CALL - Payload:", {
        cravingInput: cravingPrompt,
        mealType: "dinner",
        source: "chefs-kitchen",
        servings: voiceServings,
      });

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cravingInput: cravingPrompt,
          mealType: "dinner",
          source: "chefs-kitchen",
          servings: voiceServings,
          safetyMode: overrideToken ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: overrideToken || undefined,
        }),
      });

      console.log(
        "🔥 CHEF KITCHEN API RESPONSE - Status:",
        response.status,
        response.statusText,
      );

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("🔥 CHEF KITCHEN API ERROR - Body:", errorText);
        throw new Error(
          `Failed to generate meal: ${response.status} ${errorText}`,
        );
      }

      const data = await response.json();
      console.log("🍳 Chef's Kitchen API response:", data);

      if (data.safetyBlocked || data.safetyAmbiguous) {
        setGenerationProgress(0);
        setIsGeneratingMeal(false);
        setSafetyAlert({
          show: true,
          result: data.safetyBlocked ? "BLOCKED" : "AMBIGUOUS",
          blockedTerms: data.blockedTerms || [],
          blockedCategories: [],
          ambiguousTerms: data.ambiguousTerms || [],
          message: data.error || "Safety alert detected",
          suggestion: data.suggestion,
        });
        return;
      }

      const meal = data.meal;

      if (!meal) {
        throw new Error("No meal data returned from API");
      }

      const srcNutrition = meal.nutrition || {};
      const nutritionCalories = srcNutrition.calories ?? meal.calories ?? 0;
      const nutritionProtein = srcNutrition.protein ?? meal.protein ?? 0;
      const nutritionCarbs = srcNutrition.carbs ?? meal.carbs ?? 0;
      const nutritionFat = srcNutrition.fat ?? meal.fat ?? 0;

      const normalizedMeal: GeneratedMeal = {
        id: meal.id || `chef-${Date.now()}`,
        name: meal.name,
        description: meal.description || "",
        mealType: meal.mealType || "dinner",
        ingredients: (meal.ingredients || []).map((ing: any) => ({
          // Handle both 'item' (from meal-engine) and 'name' (from other APIs)
          name: ing.name || ing.item || "",
          quantity: ing.quantity || ing.displayText,
          amount: ing.amount,
          unit: ing.unit,
          notes: ing.notes || "",
        })),
        instructions: normalizeInstructions(
          meal.instructions || meal.preparationSteps,
        ),
        imageUrl: meal.imageUrl || null,
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
        medicalBadges: meal.medicalBadges || [],
        flags: meal.flags || [],
        servingSize: meal.servingSize,
        servings: voiceServings,
        reasoning: meal.reasoning,
      };

      console.log("✅ Chef's Kitchen normalized meal:", normalizedMeal);

      setGeneratedMeal(normalizedMeal);
      setGenerationProgress(100);
      speak(KITCHEN_STUDIO_OPEN_COMPLETE);

      setTimeout(() => {
        setIsGeneratingMeal(false);
      }, 500);
    } catch (error: any) {
      console.error("Chef's Kitchen generation error:", error);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      if (isAllergyRelatedError(error.message)) {
        const allergyDescription = formatAllergyAlertDescription(error.message);
        setGenerationError(`Safety Alert: ${allergyDescription}`);
      } else {
        setGenerationError(
          error.message || "Failed to generate meal. Please try again.",
        );
      }
      setIsGeneratingMeal(false);
      setGenerationProgress(0);
    }
  };

  // Wrapper for voice studio - uses passed values directly
  const startOpenKitchenWithValues = (
    voiceDish?: string,
    voiceMethod?: string,
    voiceIngredients?: string,
    voiceServings?: string,
    voiceEquipment?: string,
  ) => {
    generateMealWithValues(
      voiceDish || "",
      voiceMethod || "",
      voiceIngredients || "",
      voiceServings || "2",
      voiceEquipment || "",
      false,
    );
  };

  const startOpenKitchen = async (skipPreflight = false) => {
    // 🔐 Preflight safety check - BEFORE starting progress bar
    if (!skipPreflight && !hasActiveOverride) {
      const requestDescription =
        `${dishIdea} ${cookMethod} ${ingredientNotes}`.trim();
      const isSafe = await checkSafety(requestDescription, "chefs-kitchen");
      if (!isSafe) {
        // Banner will show automatically via safetyAlert state
        return;
      }
    }

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

      const fullUrl = apiUrl("/api/meal-engine/generate");
      console.log("🔥 CHEF KITCHEN API CALL - URL:", fullUrl);
      console.log("🔥 CHEF KITCHEN API CALL - Payload:", {
        cravingInput: cravingPrompt,
        mealType: "dinner",
        source: "chefs-kitchen",
        servings,
      });

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cravingInput: cravingPrompt,
          mealType: "dinner",
          source: "chefs-kitchen",
          servings: servings,
          safetyMode: overrideToken ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: overrideToken || undefined,
        }),
      });

      console.log(
        "🔥 CHEF KITCHEN API RESPONSE - Status:",
        response.status,
        response.statusText,
      );

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("🔥 CHEF KITCHEN API ERROR - Body:", errorText);
        throw new Error(
          `Failed to generate meal: ${response.status} ${errorText}`,
        );
      }

      const data = await response.json();
      console.log("🍳 Chef's Kitchen API response:", data);

      // Check for safety blocks/ambiguous - show banner instead of error
      if (data.safetyBlocked || data.safetyAmbiguous) {
        setGenerationProgress(0);
        setIsGeneratingMeal(false);
        setSafetyAlert({
          show: true,
          result: data.safetyBlocked ? "BLOCKED" : "AMBIGUOUS",
          blockedTerms: data.blockedTerms || [],
          blockedCategories: [],
          ambiguousTerms: data.ambiguousTerms || [],
          message: data.error || "Safety alert detected",
          suggestion: data.suggestion,
        });
        return;
      }

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
              if (typeof ing === "string") {
                return {
                  name: ing,
                  amount: undefined,
                  unit: undefined,
                  notes: undefined,
                };
              }
              return {
                // Handle both 'item' (from meal-engine) and 'name' (from other APIs)
                name: ing.name || ing.item || "",
                quantity: ing.quantity,
                amount: ing.amount ?? ing.grams, // FinalMeal uses 'amount', skeleton uses 'grams'
                unit: ing.unit ?? "g",
                notes: ing.notes ?? "",
              };
            })
          : [],
        instructions: normalizeInstructions(
          meal.cookingInstructions || meal.instructions,
        ),
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
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong";
      if (isAllergyRelatedError(errorMessage)) {
        setGenerationError(
          `⚠️ ALLERGY ALERT: ${formatAllergyAlertDescription(errorMessage)}`,
        );
      } else {
        setGenerationError(`${errorMessage}. Please try again.`);
      }
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

          <h1 className="text-lg font-bold text-white truncate min-w-0 flex items-center gap-2">
            Chef&apos;s Kitchen
            <img
              src="/icons/chef.png"
              alt="Chef"
              className="w-16 h-16 rounded-full ring-2 ring-white/10 shadow"
              draggable={false}
            />
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
                  className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-semibold text-sm active:scale-[0.98] transition"
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
                onInputFocus={stopChef}
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
                canEdit={studioStep < 6}
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
                onInputFocus={stopChef}
                onListen={() => {
                  if (step2Listened || isPlaying) return;
                  speak(KITCHEN_STUDIO_COOK_METHOD, () =>
                    setStep2Listened(true),
                  );
                }}
                onSubmit={() => {
                  setStep2Locked(true);
                  setStudioStep(3);
                  speak(KITCHEN_STUDIO_COOK_CONFIRMED);
                }}
                onEdit={editStep2}
                canEdit={studioStep < 6}
              />
            )}

            {/* Step 3 - Preferences & Guardrails (Yes/No pattern) */}
            {studioStep >= 3 && (
              <KitchenStepCard
                stepTitle="Step 3 · Preferences"
                question="Any dietary preference, low sugar, low sodium, gluten free, food allergies, or food to avoid?"
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
                inputType="yesno"
                yesnoConfig={{
                  noLabel: "No, I'm good",
                  yesLabel: "Yes, add preferences",
                  noValue: "None",
                  yesPlaceholder:
                    "e.g., low sugar, gluten-free, no dairy, quick 15 min meal...",
                }}
                onInputFocus={stopChef}
                onListen={() => {
                  if (step3Listened || isPlaying) return;
                  speak(KITCHEN_STUDIO_INGREDIENTS_PACE, () =>
                    setStep3Listened(true),
                  );
                }}
                onSubmit={() => {
                  setStep3Locked(true);
                  setStudioStep(4);
                  speak(KITCHEN_STUDIO_INGREDIENTS_CONFIRMED);
                }}
                onEdit={editStep3}
                canEdit={studioStep < 6}
              />
            )}

            {/* Step 4 - Servings */}
            {studioStep >= 4 && (
              <KitchenStepCard
                stepTitle="Step 4 · Servings"
                question="How many people are we cooking for?"
                summaryText={`Cooking for: ${servings} ${servings === 1 ? "person" : "people"}`}
                value={String(servings)}
                setValue={(v) => setServings(Number(v) || 2)}
                hasListened={step4Listened}
                isLocked={step4Locked}
                isPlaying={isPlaying}
                inputType="buttons"
                buttonOptions={["1", "2", "3", "4", "5", "6"]}
                onInputFocus={stopChef}
                onListen={() => {
                  if (step4Listened || isPlaying) return;
                  speak(KITCHEN_STUDIO_SERVINGS, () => setStep4Listened(true));
                }}
                onSubmit={() => {
                  setStep4Locked(true);
                  setStudioStep(5);
                  speak(KITCHEN_STUDIO_SERVINGS_CONFIRMED);
                }}
                onEdit={editStep4}
                canEdit={studioStep < 6}
              />
            )}

            {/* Step 5 - Chef's Setup (Equipment) */}
            {studioStep >= 5 && (
              <KitchenStepCard
                stepTitle="Step 5 · Chef's Setup"
                question="Take a look — if we have everything we need, tap OK."
                summaryText={`Kitchen setup: ${suggestedEquipment.join(", ") || "Ready"}`}
                value={equipment || "Ready"}
                setValue={setEquipment}
                hasListened={step5Listened}
                isLocked={step5Locked}
                isPlaying={isPlaying}
                inputType="none"
                equipmentList={suggestedEquipment}
                onInputFocus={stopChef}
                onListen={() => {
                  if (step5Listened || isPlaying) return;
                  speak(KITCHEN_STUDIO_EQUIPMENT, () => setStep5Listened(true));
                }}
                onSubmit={() => {
                  setEquipment("Ready");
                  setStep5Locked(true);
                  setStudioStep(6);
                  speak(KITCHEN_STUDIO_EQUIPMENT_CONFIRMED);
                }}
                onEdit={editStep5}
                canEdit={studioStep < 6}
                submitLabel="OK"
                autoReady
              />
            )}

            {/* Step 6 - Open Kitchen */}
            {studioStep >= 6 && (
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
                          <strong>Servings:</strong> {servings}{" "}
                          {servings === 1 ? "person" : "people"}
                        </p>
                        <p className="text-sm text-white/90">
                          <strong>Equipment:</strong> {equipment}
                        </p>
                      </div>

                      {/* SafetyGuard Preflight Banner */}
                      <SafetyGuardBanner
                        alert={safetyAlert}
                        mealRequest={`${dishIdea} ${cookMethod}`}
                        onDismiss={clearSafetyAlert}
                        onOverrideSuccess={(token) =>
                          handleSafetyOverride(false, token)
                        }
                      />

                      {/* Safety Guard Toggle - right before generate button */}
                      <div className="mb-3 flex justify-end">
                        <SafetyGuardToggle
                          safetyEnabled={safetyEnabled}
                          onSafetyChange={handleSafetyOverride}
                          disabled={isGeneratingMeal || safetyChecking}
                        />
                      </div>

                      <button
                        className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-semibold text-sm transition"
                        onClick={() => startOpenKitchen()}
                        disabled={safetyChecking}
                        data-testid="button-generate-meal"
                      >
                        {safetyChecking ? "Checking..." : "Create the Plan"}
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
                        className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-semibold text-sm transition"
                        onClick={() => startOpenKitchen()}
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {/* Meal Ready - Matching Craving Creator Card */}
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
                          onClick={restartKitchenStudio}
                          className="text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
                        >
                          Create New
                        </button>
                      </div>

                      {mealToShow.description && (
                        <p className="text-white/90">
                          {mealToShow.description}
                        </p>
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

                      {/* Serving Size Display */}
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

                      {/* Per-Serving Info for Multiple Servings */}
                      {servings > 1 && (
                        <div className="p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/20">
                          <div className="text-xs text-white text-center">
                            <strong>
                              Total nutrition below is for {servings} servings.
                            </strong>
                            <br />
                            Per serving:{" "}
                            {Math.round(
                              (mealToShow.calories || 0) / servings,
                            )}{" "}
                            cal |{" "}
                            {Math.round((mealToShow.protein || 0) / servings)}g
                            protein |{" "}
                            {Math.round((mealToShow.carbs || 0) / servings)}g
                            carbs |{" "}
                            {Math.round((mealToShow.fat || 0) / servings)}g fat
                          </div>
                        </div>
                      )}

                      {/* Macros Grid */}
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
                        const medicalBadges = generatedMeal.medicalBadges
                          ?.length
                          ? generatedMeal.medicalBadges
                          : generateMedicalBadges(
                              mealForBadges as any,
                              profile,
                            );

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
                                {ing.amount ?? ing.quantity} {ing.unit}{" "}
                                {ing.name}
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

                      {/* Standardized 3-Row Button Layout */}
                      <div className="space-y-2">
                        {/* Row 1: Add to Macros (full width) */}
                        <button
                          onClick={() => {
                            setQuickView({
                              protein: Math.round(generatedMeal.protein || 0),
                              carbs: Math.round(generatedMeal.carbs || 0),
                              starchyCarbs: 0,
                              fibrousCarbs: 0,
                              fat: Math.round(generatedMeal.fat || 0),
                              calories: Math.round(generatedMeal.calories || 0),
                              dateISO: new Date().toISOString().slice(0, 10),
                              mealSlot: "snacks",
                            });
                            setLocation(
                              "/biometrics?from=chefs-kitchen&view=macros",
                            );
                          }}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white font-semibold text-sm transition border border-white/30"
                        >
                          Add to Macros
                        </button>

                        {/* Row 2: Add to Plan + Translate (50/50) */}
                        <div className="grid grid-cols-2 gap-2">
                          <AddToMealPlanButton meal={generatedMeal} />
                          <TranslateToggle
                            content={{
                              name: generatedMeal.name,
                              description: generatedMeal.description,
                              instructions: generatedMeal.instructions,
                            }}
                            onTranslate={(updated) => {
                              setDisplayMeal({
                                ...generatedMeal,
                                name: updated.name || generatedMeal.name,
                                description:
                                  updated.description ||
                                  generatedMeal.description,
                                instructions:
                                  updated.instructions ||
                                  generatedMeal.instructions,
                              });
                            }}
                          />
                        </div>

                        {/* Row 3: Prepare with Chef + Share (50/50) */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              stopChef();
                              setPrepStep(0);
                              setMode("prepare");
                            }}
                            className="flex-1 py-2 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5"
                            data-testid="button-prepare-meal"
                          >
                            Cook w/ Chef
                          </button>
                          <ShareRecipeButton
                            recipe={{
                              name: generatedMeal.name,
                              description: generatedMeal.description,
                              nutrition: generatedMeal.nutrition,
                              ingredients: generatedMeal.ingredients.map(
                                (ing) => ({
                                  name: ing.name,
                                  amount: String(
                                    ing.amount ?? ing.quantity ?? "",
                                  ),
                                  unit: ing.unit,
                                }),
                              ),
                            }}
                            className="flex-1"
                          />
                        </div>

                        {/* Start Cooking - Full width CTA matching studio pattern */}
                        <button
                          onClick={() => {
                            stopChef();
                            setPrepStep(0);
                            setMode("prepare");
                          }}
                          className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-semibold text-sm transition"
                          data-testid="button-start-cooking"
                        >
                          Start Cooking
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* PHASE TWO - PREPARE MODE */}
        {mode === "prepare" && generatedMeal && (
          <div className="space-y-4">
            <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
              <CardContent className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-orange-500" />
                    Preparing: {generatedMeal.name}
                  </h2>
                  <button
                    onClick={() => setMode("studio")}
                    className="text-sm text-white/70 hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>

                {/* STEP 0 — Mise en Place */}
                {prepStep === 0 && (
                  <div className="space-y-4">
                    <p className="text-sm text-white/80">
                      Before we start cooking, let's get everything ready.
                    </p>

                    {/* Ingredients */}
                    <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                      <p className="text-sm font-semibold text-white mb-2">
                        Ingredients
                      </p>
                      <ul className="space-y-1">
                        {generatedMeal.ingredients.map((ing, i) => (
                          <li
                            key={i}
                            className="text-sm text-white/70 flex items-center gap-2"
                          >
                            <span className="text-lime-500">•</span>
                            {ing.amount ?? ing.quantity} {ing.unit} {ing.name}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Equipment */}
                    {suggestedEquipment.length > 0 && (
                      <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                        <p className="text-sm font-semibold text-white mb-2">
                          Equipment
                        </p>
                        <ul className="space-y-1">
                          {suggestedEquipment.map((item, i) => (
                            <li
                              key={i}
                              className="text-sm text-white/70 flex items-center gap-2"
                            >
                              <span className="text-lime-500">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Press to Start */}
                    <button
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 border border-orange-400/50 text-white text-sm font-medium hover:from-orange-500 hover:to-amber-400 animate-pulse transition"
                      onClick={() => speak(KITCHEN_COOK_SETUP)}
                    >
                      👉 Press to Start
                    </button>

                    <button
                      className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm"
                      onClick={() => {
                        stopChef();
                        setPrepStep(1);
                      }}
                    >
                      I'm Ready — Let's Cook
                    </button>
                  </div>
                )}

                {/* COOKING STEPS (prepStep > 0) */}
                {prepStep > 0 &&
                  (() => {
                    const instructions = Array.isArray(
                      generatedMeal.instructions,
                    )
                      ? generatedMeal.instructions
                      : [generatedMeal.instructions || ""];
                    const totalSteps = instructions.length;
                    const currentInstruction = instructions[prepStep - 1] || "";
                    const detectedTimer =
                      extractTimerSeconds(currentInstruction);
                    const isFinalStep = prepStep === totalSteps;
                    const isPastFinalStep = prepStep > totalSteps;

                    // Plating & Serving (after final cooking step)
                    if (isPastFinalStep) {
                      return (
                        <div className="space-y-4">
                          <div className="text-center py-4">
                            <Sparkles className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-white mb-2">
                              Plating & Serving
                            </h3>
                            <p className="text-sm text-white/80">
                              Divide evenly into {servings}{" "}
                              {servings === 1 ? "portion" : "portions"}. Serve
                              warm.
                            </p>
                            <p className="text-sm text-white/60 mt-2">
                              Optional: garnish with herbs, lemon, or fresh
                              greens.
                            </p>
                          </div>

                          {/* Press to Start */}
                          <button
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 border border-orange-400/50 text-white text-sm font-medium hover:from-orange-500 hover:to-amber-400 animate-pulse transition"
                            onClick={() => speak(KITCHEN_PLATING)}
                          >
                            👉 Press to Start
                          </button>

                          <div className="flex gap-3">
                            <button
                              className="flex-1 py-3 rounded-xl bg-black/40 border border-white/20 text-white text-sm"
                              onClick={() => {
                                stopChef();
                                setPrepStep(0);
                                setMode("studio");
                                try {
                                  localStorage.removeItem(
                                    "mpm_chefs_kitchen_prep",
                                  );
                                } catch {}
                              }}
                            >
                              Back to Meal Card
                            </button>
                            <button
                              className="flex-1 py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm"
                              onClick={() => {
                                stopChef();
                                restartKitchenStudio();
                              }}
                            >
                              Cook Another Meal
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {/* Step Progress */}
                        <div className="flex items-center justify-between text-sm text-white/70">
                          <span>
                            Step {prepStep} of {totalSteps}
                          </span>
                          <div className="flex gap-1">
                            {Array.from({ length: totalSteps }, (_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${
                                  i < prepStep ? "bg-lime-500" : "bg-white/30"
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Current Instruction */}
                        <div className="rounded-xl border border-white/20 bg-black/40 p-4">
                          <p className="text-sm text-white/90 leading-relaxed">
                            {currentInstruction}
                          </p>
                        </div>

                        {/* Press to Start for this step */}
                        <button
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 border border-orange-400/50 text-white text-sm font-medium hover:from-orange-500 hover:to-amber-400 animate-pulse transition"
                          onClick={() => speak(currentInstruction)}
                        >
                          👉 Press to Start
                        </button>

                        {/* Timer Controls (if detected or running) */}
                        {(detectedTimer ||
                          isTimerRunning ||
                          timerSeconds > 0) && (
                          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                            {!isTimerRunning &&
                              timerSeconds === 0 &&
                              detectedTimer && (
                                <button
                                  className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-medium text-sm flex items-center justify-center gap-2"
                                  onClick={() => {
                                    stopChef();
                                    setTimerSeconds(detectedTimer);
                                    setIsTimerRunning(true);
                                    speak(KITCHEN_TIMER_START);
                                  }}
                                >
                                  <Play className="h-4 w-4" />
                                  Start Timer ({Math.round(
                                    detectedTimer / 60,
                                  )}{" "}
                                  min)
                                </button>
                              )}

                            {(isTimerRunning || timerSeconds > 0) && (
                              <div className="text-center space-y-3">
                                <p className="text-3xl font-mono font-bold text-white">
                                  {formatTimeRemaining(timerSeconds)}
                                </p>
                                <div className="flex gap-2 justify-center">
                                  {isTimerRunning ? (
                                    <button
                                      className="px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-sm flex items-center gap-2"
                                      onClick={() => {
                                        stopChef();
                                        setIsTimerRunning(false);
                                      }}
                                    >
                                      <Pause className="h-4 w-4" />
                                      Pause
                                    </button>
                                  ) : (
                                    <button
                                      className="px-4 py-2 rounded-lg bg-lime-600 text-black text-sm flex items-center gap-2"
                                      onClick={() => {
                                        stopChef();
                                        setIsTimerRunning(true);
                                      }}
                                    >
                                      <Play className="h-4 w-4" />
                                      Resume
                                    </button>
                                  )}
                                  <button
                                    className="px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-sm flex items-center gap-2"
                                    onClick={() => {
                                      stopChef();
                                      setTimerSeconds(0);
                                      setIsTimerRunning(false);
                                    }}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                    Reset
                                  </button>
                                </div>
                                {timerSeconds === 0 && (
                                  <p className="text-lime-400 font-medium">
                                    Timer finished!
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Navigation */}
                        <div className="flex gap-3">
                          {prepStep > 1 && (
                            <button
                              className="flex-1 py-3 rounded-xl bg-black/40 border border-white/20 text-white text-sm"
                              onClick={() => {
                                stopChef();
                                setTimerSeconds(0);
                                setIsTimerRunning(false);
                                setPrepStep((s) => s - 1);
                              }}
                            >
                              Previous
                            </button>
                          )}
                          <button
                            className="flex-1 py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm"
                            onClick={() => {
                              stopChef();
                              setTimerSeconds(0);
                              setIsTimerRunning(false);
                              setPrepStep((s) => s + 1);
                            }}
                          >
                            {isFinalStep ? "Finish Cooking" : "Next Step"}
                          </button>
                        </div>

                        {/* Exit Control */}
                        <button
                          className="w-full py-2 rounded-xl bg-black/40 border border-white/20 text-white/70 text-sm"
                          onClick={() => {
                            stopChef();
                            setMode("studio");
                          }}
                        >
                          Back to Meal Card
                        </button>
                      </div>
                    );
                  })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Extra padding when shopping bar is visible */}
        {generatedMeal && generatedMeal.ingredients?.length > 0 && (
          <div className="h-28" />
        )}
      </div>

      {/* Hands-free Voice Mode Overlay */}
      <VoiceModeOverlay
        isOpen={voiceStudio.isActive}
        onClose={voiceStudio.stopVoiceMode}
        voiceState={voiceStudio.voiceState}
        currentStep={voiceStudio.currentVoiceStep}
        totalSteps={6}
        lastTranscript={voiceStudio.lastTranscript}
        isPlaying={voiceStudio.isPlaying}
        onStart={voiceStudio.startVoiceMode}
      />

      {/* Talk to Chef floating button - show during studio steps (before generate) */}
      {mode === "studio" && studioStep < 6 && !isGeneratingMeal && (
        <TalkToChefButton
          voiceState={voiceStudio.voiceState}
          currentStep={voiceStudio.currentVoiceStep}
          totalSteps={6}
          lastTranscript={voiceStudio.lastTranscript}
          isPlaying={voiceStudio.isPlaying}
          onStart={voiceStudio.startVoiceMode}
          onStop={voiceStudio.stopVoiceMode}
        />
      )}

      {/* Shopping Aggregate Bar - appears after meal is generated */}
      {generatedMeal && generatedMeal.ingredients?.length > 0 && (
        <ShoppingAggregateBar
          ingredients={generatedMeal.ingredients.map((ing) => ({
            name: ing.name,
            qty: ing.amount ?? ing.quantity,
            unit: ing.unit || "",
          }))}
          source="Chef's Kitchen"
          sourceSlug="chefs-kitchen"
        />
      )}
    </motion.div>
  );
}
