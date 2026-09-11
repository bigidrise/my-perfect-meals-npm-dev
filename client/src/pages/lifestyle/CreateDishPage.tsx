import { useState, useEffect, useRef } from "react";
import { writeChefHandoffMeal } from "@/lib/safeChefHandoff";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { formatAmount } from "@/utils/formatAmount";
import { useMealImages, lookupHydratedImageUrl } from "@/hooks/useMealImages";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import ThinkingDots from "@/components/ThinkingDots";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassButton } from "@/components/glass";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Brain, Sparkles, ArrowLeft, ChefHat, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import {
  generateMedicalBadges,
  getUserMedicalProfile,
} from "@/utils/medicalPersonalization";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeDiet, mealMatchesDiet } from "@/utils/dietaryFilter";
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { FlavorToggle } from "@/components/FlavorToggle";
import { KeepItSimpleToggle } from "@/components/KeepItSimpleToggle";
import { useStarchGuardPrecheck } from "@/hooks/useStarchGuardPrecheck";
import {
  StarchGuardIntercept,
  StarchSubstitutionNotice,
} from "@/components/StarchGuardIntercept";
import {
  DietGuardIntercept,
  DietAdaptedNotice,
} from "@/components/DietGuardIntercept";
import { useDietGuardPrecheck } from "@/hooks/useDietGuardPrecheck";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import type { AllergyConflictPayload } from "@/hooks/useSafetyGuardPrecheck";
import { AllergyConflictModal } from "@/components/AllergyConflictModal";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import { setQuickView } from "@/lib/macrosQuickView";
import TrashButton from "@/components/ui/TrashButton";
import FavoriteButton from "@/components/FavoriteButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
import CultureBadge from "@/components/CultureBadge";
import { DietCuisineControlRow } from "@/components/ui/DietCuisineControlRow";
import ServingInstructionsBlock from "@/components/ServingInstructionsBlock";
import PhaseGate from "@/components/PhaseGate";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import DietStyleBadge from "@/components/DietStyleBadge";
import MealClassificationPill from "@/components/MealClassificationPill";
import KosherProTip from "@/components/KosherProTip";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import { deriveSplitCarbs } from "@/utils/ingredientClassifier";
import { PillButton } from "@/components/ui/pill-button";
import { IconPillOption } from "@/components/ui/icon-pill-option";
import { getCreateDishServerErrorMessage } from "@/lib/createDishError";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { captureAuthoritativeTextValue, commitTextInputValue } from "@/lib/authoritativeTextInput";
import {
  canRenderCreateDishPreparation,
  normalizeCreateDishRecognitionText,
  resolveCreateDishRecognitionSource,
  shouldApplyCreateDishRecognitionResult,
} from "@/lib/createDishLiveRecognition";
import type {
  CreateDishIntent,
  ExpandIngredientResponse,
  ExpansionDimension,
  ValidatedCookingMethodId,
} from "../../../../shared/createDishIngredientExpansion";
import { ExpandIngredientResponseSchema } from "../../../../shared/createDishIngredientExpansion";

interface StructuredIngredient {
  name: string;
  quantity?: string | number;
  unit?: string;
  category?: string;
}

interface MealData {
  id: string;
  name: string;
  description: string;
  ingredients: StructuredIngredient[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    starchyCarbs?: number;
    fibrousCarbs?: number;
  };
  instructions: string;
  cookingInstructions?: string[];
  reasoning: string;
  servingSize: string;
  medicalBadges: Array<{
    condition: string;
    compatible: boolean;
    reason: string;
    color: string;
  }>;
  imageUrl?: string;
  dietaryComplianceVerified?: boolean;
  dietClassification?: import("@/components/MealClassificationPill").DietClassification | null;
}

// ============================================================
// CACHE KEY: v2 — intentionally bumped from v1 to invalidate
// all stale localStorage data that caused the black overlay bug.
// Do NOT downgrade this key — stale v1 data resurrects the bug.
// ============================================================
const CACHE_KEY = "createDish.cache.v2";
const CACHE_KEY_LEGACY = "createDish.cache.v1";

// Only the final meal card is persisted — NOT dishInput, cookMethod,
// or notes. Restoring dishInput triggers the starch-guard useEffect
// on mount, which causes overlay intercepts before user interaction.
type CachedDishState = {
  generatedMeal: MealData | null;
  servings: number;
  generatedAtISO: string;
};

function saveDishCache(state: CachedDishState) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {}
}

function loadDishCache(): CachedDishState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.generatedMeal?.id) return null;
    return parsed as CachedDishState;
  } catch {
    return null;
  }
}

function clearDishCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_KEY_LEGACY);
  } catch {}
}

// ---- Persist the three options so they survive navigation and selection ----
// dishInput is intentionally NOT restored here — restoring it triggers the
// starch-guard useEffect on mount (see GUARD comment above).
const OPTIONS_KEY = "createDish.options.v1";

function saveOptionsCache(options: any[]) {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {}
}

function loadOptionsCache(): any[] {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clearOptionsCache() {
  try {
    localStorage.removeItem(OPTIONS_KEY);
  } catch {}
}

function getMealNutrition(meal: any) {
  const n = meal?.nutrition || {};
  return {
    calories: Number(n.calories ?? meal.calories ?? 0),
    protein_g: Number(n.protein ?? n.protein_g ?? meal.protein ?? 0),
    carbs_g: Number(n.carbs ?? n.carbs_g ?? meal.carbs ?? 0),
    fat_g: Number(n.fat ?? n.fat_g ?? meal.fat ?? 0),
    starchyCarbs: Number(n.starchyCarbs ?? meal.starchyCarbs ?? 0),
    fibrousCarbs: Number(n.fibrousCarbs ?? meal.fibrousCarbs ?? 0),
  };
}

const COOK_METHODS: { label: string; emoji: string }[] = [
  { label: "Stovetop", emoji: "🍳" },
  { label: "Oven",     emoji: "♨️" },
  { label: "Air Fryer", emoji: "💨" },
  { label: "Slow Cooker", emoji: "🥘" },
  { label: "Grill",    emoji: "🔥" },
  { label: "No-Bake",  emoji: "❄️" },
  { label: "Any",      emoji: "✨" },
];

const EXPANSION_DIMENSIONS: ExpansionDimension[] = ["form", "texture", "flavor"];
const EXPANSION_DIMENSION_LABELS: Record<ExpansionDimension, string> = {
  form: "Form / Cut",
  method: "Method",
  texture: "Texture",
  flavor: "Flavor",
  cuisine: "Cuisine",
};
const COOK_METHOD_TO_EXPANSION_ID: Record<string, ValidatedCookingMethodId | null> = {
  Stovetop: "pan-seared",
  Oven: "baked",
  "Air Fryer": "air-fried",
  "Slow Cooker": null,
  Grill: "grilled",
  "No-Bake": null,
  Any: null,
};
const SLOW_COOKER_TEXTURES = new Set(["tender", "fall-apart-tender", "juicy", "creamy"]);
const NO_BAKE_TEXTURES = new Set(["creamy", "silky", "delicate"]);
const expansionOptionKey: Record<ExpansionDimension, keyof ExpandIngredientResponse["options"]> = {
  form: "forms",
  method: "methods",
  texture: "textures",
  flavor: "flavors",
  cuisine: "cuisines",
};

export default function CreateDishPage() {
  useCopilotPageExplanation();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  const { toast } = useToast();
  const [dishInput, setDishInput] = useState("");
  const dishInputRef = useRef<HTMLTextAreaElement>(null);
  const updateDishInput = (value: string) => {
    const limitedValue = value.slice(0, 300);
    if (dishInputRef.current) dishInputRef.current.value = limitedValue;
    setDishInput(limitedValue);
  };
  const [servings, setServings] = useState<number>(2);
  const [cookMethod, setCookMethod] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [generatedMeals, setGeneratedMeals] = useState<MealData[]>([]);
  const { loadingImages, hydrateImages } = useMealImages(setGeneratedMeals, { mealType: "dinner", concurrency: 1 });
  // ============================================================
  // GUARD: generatedInSession controls ShoppingAggregateBar visibility.
  // It MUST start false and remain false during auto-restore on mount.
  // Only explicit user actions (generate / select a meal) may set it true.
  // This prevents the bar from cold-mounting as a black overlay on page load.
  //
  // RULE FOR FUTURE AGENTS: Do NOT set generatedInSession=true inside the
  // cache-restore useEffect. Doing so re-introduces the black overlay bug
  // (MPM-2026-CreateDish-Overlay). The fix was deliberately architected this way.
  // ============================================================
  const [generatedInSession, setGeneratedInSession] = useState(false);
  const [mealOptions, setMealOptions] = useState<any[]>([]);
  const [isPlatingMeal, setIsPlatingMeal] = useState(false);

  // Kitchen context — set when navigating from a /kitchen/:slug page
  const [activeKitchenSlug, setActiveKitchenSlug] = useState<string | null>(null);
  const [activeKitchenName, setActiveKitchenName] = useState<string | null>(null);

  // Read ?kitchen=slug and ?idea=<pre-filled meal idea> from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Pre-fill dish input from ?idea= (set by coach "Make it now" buttons)
    const ideaParam = params.get("idea");
    if (ideaParam) {
      updateDishInput(ideaParam);
    }

    const slug = params.get("kitchen");
    if (!slug) return;
    setActiveKitchenSlug(slug);
    fetch(apiUrl(`/api/kitchens/${slug}`), {
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.displayName) setActiveKitchenName(d.displayName); })
      .catch(() => {});
  }, []);

  const getRecentMeals = (): string[] => {
    try {
      return JSON.parse(sessionStorage.getItem("cd_recent_meals") || "[]");
    } catch {
      return [];
    }
  };
  const addRecentMeal = (mealName: string): void => {
    try {
      const recent = getRecentMeals();
      const updated = [
        mealName,
        ...recent.filter((m: string) => m !== mealName),
      ].slice(0, 3);
      sessionStorage.setItem("cd_recent_meals", JSON.stringify(updated));
    } catch {}
  };

  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);

  const {
    alert: dietAlert,
    decision: dietDecision,
    checkDiet,
    clearAlert: clearDietAlert,
    setDecision: setDietDecision,
    triggerAlert: triggerDietAlert,
    activeDiet,
  } = useDietGuardPrecheck();
  const [dietAdaptedNotice, setDietAdaptedNotice] = useState<string | null>(
    null,
  );

  // 🔐 SafetyGuard preflight system
  const {
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride,
    governanceOverrideToken,
    acknowledgeAdvisory,
    allergyConflictPayload,
    restoreBlockedAlert,
  } = useSafetyGuardPrecheck();
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  // Allergen conflict modal state — set when safety preflight returns conflict_adaptable/collapse
  const [allergyConflict, setAllergyConflict] = useState<AllergyConflictPayload | null>(null);
  const allergenSafeModeRef = useRef(false);
  // Captures the actual allergens from AllergyConflictModal so SafetyGuardToggle
  // can send the correct allergen name to the PIN endpoint (not the generic placeholder).
  const pendingOverrideAllergensRef = useRef<string[]>([]);
  const handleSafetyOverride = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert();
      setPendingGeneration(true);
    }
  };
  const [pendingGeneration, setPendingGeneration] = useState(false);
  const [acknowledgingAdvisory, setAcknowledgingAdvisory] = useState(false);

  const { user } = useAuth();
  const sweetenerPreferences = user?.sweetenerPreferences || [];
  const userId = user?.id || "";

  const mealOptionsRef = useRef<HTMLDivElement | null>(null);
  const continueAnywayRef = useRef(false);

  useEffect(() => {
    if (mealOptions.length > 0 && mealOptionsRef.current) {
      setTimeout(() => {
        mealOptionsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    }
  }, [mealOptions.length]);

  useEffect(() => {
    document.title = "Create a Dish | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // ============================================================
  // SAFE RESTORE: Only restores the final meal card display data.
  // generatedInSession intentionally stays FALSE here — this is not
  // a user-initiated generation, so ShoppingAggregateBar must NOT mount.
  // Do NOT add setGeneratedInSession(true) here. See GUARD comment above.
  // Do NOT restore dishInput — it triggers starch-guard on mount.
  // Do NOT show a restore toast — it fires on page exit and confuses users.
  // ============================================================
  useEffect(() => {
    // Clear stale v1 cache that caused the overlay bug before this fix.
    try {
      localStorage.removeItem("createDish.cache.v1");
    } catch {}

    const cached = loadDishCache();
    if (cached?.generatedMeal?.id) {
      // Enrich with mini-cache imageUrl before setting state — survives the race
      // where user navigated away before hydrateImages finished
      const mealWithImage = cached.generatedMeal.imageUrl
        ? cached.generatedMeal
        : { ...cached.generatedMeal, imageUrl: lookupHydratedImageUrl(cached.generatedMeal.id) ?? undefined };
      setGeneratedMeals([mealWithImage]);
      setServings(cached.servings || 2);
      // generatedInSession remains false — bar will not cold-mount
      // Only re-fetch if imageUrl is still missing after mini-cache lookup
      if (!mealWithImage.imageUrl) {
        hydrateImages([mealWithImage]);
      }
    }

    // Restore the three pending options so they survive navigation and selection.
    // dishInput is intentionally NOT restored here (starch-guard trigger risk).
    const savedOptions = loadOptionsCache();
    if (savedOptions.length > 0) {
      setMealOptions(savedOptions);
    }
  }, []);

  useEffect(() => {
    if (generatedMeals.length > 0 && generatedMeals[0]?.id) {
      saveDishCache({
        generatedMeal: generatedMeals[0],
        servings,
        generatedAtISO: new Date().toISOString(),
      });
    }
  }, [generatedMeals, servings]);

  // Persist the options list whenever it changes (non-empty → save; empty → clear).
  useEffect(() => {
    if (mealOptions.length > 0) {
      saveOptionsCache(mealOptions);
    } else {
      clearOptionsCache();
    }
  }, [mealOptions]);

  const handleSelectMeal = async (meal: any) => {
    // Do NOT clear mealOptions here — the other choices should stay visible
    // until the user explicitly taps "Start over" or "Create New".
    addRecentMeal(meal.name);
    setIsPlatingMeal(true);

    // Show card immediately — image hydrates in parallel
    setGeneratedMeals([meal]);
    setGeneratedInSession(true);
    setIsPlatingMeal(false);
    saveDishCache({
      generatedMeal: meal,
      servings,
      generatedAtISO: new Date().toISOString(),
    });
    hydrateImages([meal]);
  };

  const startProgressTicker = () => {
    if (tickerRef.current) return;
    setProgress(0);
    tickerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 90) {
          const next = p + Math.max(1, Math.floor((90 - p) * 0.07));
          return Math.min(next, 90);
        }
        return p;
      });
    }, 150);
  };

  const stopProgressTicker = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setProgress(100);
  };

  const [dietOverrideEnabled, setDietOverrideEnabled] = useState(false);
  const [dietOverrideValue, setDietOverrideValue] = useState("");
  const [cuisineOverrideEnabled, setCuisineOverrideEnabled] = useState(false);
  const [cuisineOverrideValue, setCuisineOverrideValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState<Record<string, boolean>>(
    {},
  );
  const [activeSteps, setActiveSteps] = useState<Record<string, number | null>>(
    {},
  );
  const [flavorPersonal, setFlavorPersonal] = useState(true);
  const [keepItSimple, setKeepItSimple] = useState(false);
  const [ingredientExpansion, setIngredientExpansion] = useState<ExpandIngredientResponse | null>(null);
  const [expansionSelections, setExpansionSelections] = useState<Partial<Record<ExpansionDimension, string | null>>>({});
  const [delegatedDimensions, setDelegatedDimensions] = useState<ExpansionDimension[]>([]);
  const [expansionBusy, setExpansionBusy] = useState(false);
  const [expansionFallback, setExpansionFallback] = useState(false);
  const lastExpandedTextRef = useRef("");
  const expansionRequestRef = useRef(0);
  const [acceptedExpansionSource, setAcceptedExpansionSource] = useState<string | null>(null);

  useEffect(() => {
    const element = dishInputRef.current;
    if (!element) return;
    const mirrorVisibleValue = () => {
      const visibleValue = element.value.slice(0, 300);
      setDishInput((current) => current === visibleValue ? current : visibleValue);
    };
    element.addEventListener("input", mirrorVisibleValue);
    element.addEventListener("change", mirrorVisibleValue);
    element.addEventListener("compositionend", mirrorVisibleValue);
    return () => {
      element.removeEventListener("input", mirrorVisibleValue);
      element.removeEventListener("change", mirrorVisibleValue);
      element.removeEventListener("compositionend", mirrorVisibleValue);
    };
  }, []);

  const expansionPolicy = () => {
    const mappedMethodId = COOK_METHOD_TO_EXPANSION_ID[cookMethod] ?? null;
    const methodId = mappedMethodId && ingredientExpansion?.options.methods.some(
      (option) => option.id === mappedMethodId,
    )
      ? mappedMethodId
      : null;
    return {
      delegatedDimensions: delegatedDimensions.filter((dimension) =>
        EXPANSION_DIMENSIONS.includes(dimension),
      ),
      selectedOptionIds: {
        form: expansionSelections.form ?? null,
        method: methodId,
        texture: expansionSelections.texture ?? null,
        flavor: expansionSelections.flavor ?? null,
        cuisine: null,
      },
    };
  };

  const isTextureCompatibleWithCookMethod = (
    texture: ExpandIngredientResponse["options"]["textures"][number] | undefined,
    methodLabel = cookMethod,
  ) => {
    if (!texture || !methodLabel || methodLabel === "Any") return true;
    if (methodLabel === "Slow Cooker") return SLOW_COOKER_TEXTURES.has(texture.id);
    if (methodLabel === "No-Bake") return NO_BAKE_TEXTURES.has(texture.id);
    const methodId = COOK_METHOD_TO_EXPANSION_ID[methodLabel];
    return !methodId ||
      !texture.compatibleMethodIds?.length ||
      texture.compatibleMethodIds.includes(methodId);
  };

  const requestIngredientExpansion = async (
    text: string,
    policy = expansionPolicy(),
  ): Promise<ExpandIngredientResponse | null> => {
    if (!text.trim()) return null;
    try {
      const response = await fetch(apiUrl("/api/create-a-dish/expand-ingredient"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientInput: text.trim(),
          creator: "create_a_dish",
          surprisePolicy: policy,
          // Phase 2 controls expose only catalog-backed IDs that generation can
          // deterministically revalidate.
          useAiForGaps: false,
        }),
      });
      if (!response.ok) throw new Error("expansion failed");
      const parsed = ExpandIngredientResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("invalid expansion");
      return parsed.data;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const visibleValue = dishInputRef.current?.value ?? dishInput;
    const { sourceText, shouldMirror } = resolveCreateDishRecognitionSource(
      visibleValue,
      dishInput,
    );
    if (shouldMirror) {
      setDishInput(visibleValue);
    }
    if (sourceText === lastExpandedTextRef.current) return;
    const requestId = ++expansionRequestRef.current;
    lastExpandedTextRef.current = sourceText;
    setIngredientExpansion(null);
    setAcceptedExpansionSource(null);
    setExpansionSelections({});
    setDelegatedDimensions([]);
    setExpansionFallback(false);
    setExpansionBusy(false);
    if (sourceText.length < 3) return;
    setExpansionBusy(true);
    const timer = window.setTimeout(async () => {
      const result = await requestIngredientExpansion(sourceText, {
        delegatedDimensions: [],
        selectedOptionIds: {
          form: null,
          method: null,
          texture: null,
          flavor: null,
          cuisine: null,
        },
      });
      if (requestId !== expansionRequestRef.current) return;
      const currentVisibleValue = dishInputRef.current?.value ?? dishInput;
      if (
        !result ||
        !shouldApplyCreateDishRecognitionResult({
          requestSource: sourceText,
          currentVisibleValue,
          responseSubmittedText: result.ingredient.submittedText,
        })
      ) {
        setExpansionBusy(false);
        setIngredientExpansion(null);
        setAcceptedExpansionSource(null);
        const currentSource = normalizeCreateDishRecognitionText(currentVisibleValue);
        if (currentSource !== sourceText) {
          lastExpandedTextRef.current = "";
          setDishInput(currentVisibleValue);
        } else if (!result) {
          setExpansionFallback(true);
        }
        return;
      }
      setExpansionBusy(false);
      setExpansionFallback(false);
      setIngredientExpansion(result);
      setAcceptedExpansionSource(sourceText);
      const inferredTextureId = result.inferredSelectionIds?.texture ?? null;
      const inferredTexture = result.options.textures.find(
        (option) => option.id === inferredTextureId,
      );
      setExpansionSelections({
        form: result.inferredSelectionIds?.form ?? null,
        texture: isTextureCompatibleWithCookMethod(inferredTexture) ? inferredTextureId : null,
        flavor: result.inferredSelectionIds?.flavor ?? null,
      });
    }, 420);
    return () => window.clearTimeout(timer);
  }, [dishInput]);

  const toggleExpansionSelection = (dimension: ExpansionDimension, id: string) => {
    if (dimension === "texture") {
      const selectedTexture = ingredientExpansion?.options.textures.find((option) => option.id === id);
      if (!isTextureCompatibleWithCookMethod(selectedTexture)) {
        toast({
          title: "That texture doesn't match your cooking method",
          description: `Choose a different texture or change the ${cookMethod} cooking method.`,
          variant: "warning",
        });
        return;
      }
    }
    setDelegatedDimensions((current: ExpansionDimension[]) => current.filter((item: ExpansionDimension) => item !== dimension));
    setExpansionSelections((current: Partial<Record<ExpansionDimension, string | null>>) => ({
      ...current,
      [dimension]: current[dimension] === id ? null : id,
    }));
  };

  const surpriseDimension = (dimension: ExpansionDimension) => {
    setExpansionSelections((current: Partial<Record<ExpansionDimension, string | null>>) => ({ ...current, [dimension]: null }));
    setDelegatedDimensions((current: ExpansionDimension[]) => current.includes(dimension) ? current : [...current, dimension]);
  };

  const surpriseAll = () => {
    setExpansionSelections({});
    setDelegatedDimensions(EXPANSION_DIMENSIONS);
  };

  const selectCookMethod = (nextMethod: string) => {
    const updatedMethod = cookMethod === nextMethod ? "" : nextMethod;
    const selectedTextureId = expansionSelections.texture;
    const selectedTexture = ingredientExpansion?.options.textures.find(
      (option) => option.id === selectedTextureId,
    );
    if (
      selectedTexture &&
      !isTextureCompatibleWithCookMethod(selectedTexture, updatedMethod)
    ) {
      setExpansionSelections((current) => ({ ...current, texture: null }));
      toast({
        title: "Texture choice cleared",
        description: `${selectedTexture.label} doesn't match the ${nextMethod} cooking method.`,
        variant: "warning",
      });
    }
    setCookMethod(updatedMethod);
  };

  const rankExpansionOptions = (
    dimension: ExpansionDimension,
    options: ExpandIngredientResponse["options"][keyof ExpandIngredientResponse["options"]],
  ) => {
    if (dimension !== "flavor" || !cuisineOverrideEnabled || !cuisineOverrideValue.trim()) {
      return options;
    }
    const normalizedCuisine = cuisineOverrideValue.trim().toLowerCase().replace(/\s+/g, "-");
    return [...options].sort((left, right) =>
      Number(right.cuisineId === normalizedCuisine) - Number(left.cuisineId === normalizedCuisine)
    );
  };

  const chooseClarification = (choiceId: string, label: string) => {
    const originalDish = dishInput.trim().toLowerCase();
    if (choiceId === "other") {
      updateDishInput("");
      return;
    }
    if (choiceId === "surprise") {
      const firstConcreteChoice = ingredientExpansion?.ingredient.clarification?.choices.find(
        (choice: { id: string; label: string }) => choice.id !== "surprise" && choice.id !== "other",
      );
      if (firstConcreteChoice) {
        updateDishInput(
          originalDish === "steak"
            ? `${firstConcreteChoice.label} steak`
            : originalDish === "fish"
              ? `${firstConcreteChoice.label} fish`
              : firstConcreteChoice.label,
        );
      }
      return;
    }
    updateDishInput(
      originalDish === "steak"
        ? `${label} steak`
        : originalDish === "fish"
          ? `${label} fish`
          : label,
    );
  };

  const getAuthoritativeExpansion = async (submittedDishInput: string): Promise<CreateDishIntent | null> => {
    const result = await requestIngredientExpansion(submittedDishInput.trim(), expansionPolicy());
    if (!result) {
      setExpansionFallback(true);
      return null;
    }
    setIngredientExpansion(result);
    const ingredient = result.ingredient;
    const combination = result.resolvedCombination;
    const requestedStructuredIntent =
      delegatedDimensions.some((dimension) => EXPANSION_DIMENSIONS.includes(dimension)) ||
      EXPANSION_DIMENSIONS.some((dimension) => Boolean(expansionSelections[dimension]));
    if (!combination && ingredient.status === "recognized" && requestedStructuredIntent) {
      throw new Error("CREATE_DISH_CHOICES_INVALID");
    }
    if (!combination || ingredient.status === "unsupported" || !ingredient.canonicalId || !ingredient.canonicalName || !ingredient.category) {
      return null;
    }
    let resolvedTexture = combination.texture;
    let resolvedTextureSource = combination.selectionSource.texture;
    if (!isTextureCompatibleWithCookMethod(resolvedTexture ?? undefined)) {
      const compatibleTexture = delegatedDimensions.includes("texture")
        ? result.options.textures.find((option) =>
            isTextureCompatibleWithCookMethod(option)
          ) ?? null
        : null;
      resolvedTexture = compatibleTexture;
      resolvedTextureSource = compatibleTexture ? "system_selected" : "not_applicable";
      setExpansionSelections((current) => ({ ...current, texture: compatibleTexture?.id ?? null }));
      if (!compatibleTexture) {
        setDelegatedDimensions((current) =>
          current.filter((dimension) => dimension !== "texture")
        );
      }
      toast({
        title: compatibleTexture ? "Compatible texture selected" : "Texture choice cleared",
        description: compatibleTexture
          ? `${compatibleTexture.label} works with the ${cookMethod} cooking method.`
          : `The ${cookMethod} cooking method will stay in control without a conflicting texture.`,
        variant: "warning",
      });
    }
    return {
      creator: "create_a_dish",
      originalText: submittedDishInput.trim(),
      ingredient: {
        canonicalId: ingredient.canonicalId,
        canonicalName: ingredient.canonicalName,
        category: ingredient.category,
      },
      resolvedCombination: {
        form: combination.form,
        texture: resolvedTexture,
        flavor: combination.flavor,
        selectionSource: {
          form: combination.selectionSource.form,
          texture: resolvedTextureSource,
          flavor: combination.selectionSource.flavor,
        },
      },
    };
  };

  const {
    alert: starchAlert,
    decision: starchDecision,
    checkStarch,
    clearAlert: clearStarchAlert,
    setDecision: setStarchDecision,
    isBlocked: starchBlocked,
  } = useStarchGuardPrecheck();

  const [substitutedStarchTerms, setSubstitutedStarchTerms] = useState<
    string[]
  >([]);

  useEffect(() => {
    if (dishInput.trim().length >= 3 && starchDecision === "pending") {
      checkStarch(dishInput);
    }
  }, [dishInput, starchDecision, checkStarch]);

  const buildPrompt = (submittedDishInput = dishInput) => {
    const parts: string[] = [];
    if (submittedDishInput.trim()) parts.push(submittedDishInput.trim());
    if (cookMethod && cookMethod !== "Any")
      parts.push(`Cooking method: ${cookMethod}`);
    if (notes.trim()) parts.push(`Notes: ${notes.trim()}`);
    return parts.join(". ");
  };

  useEffect(() => {
    if (pendingGeneration && (overrideToken || governanceOverrideToken) && !isGenerating) {
      setPendingGeneration(false);
      handleGenerateDish(true);
    }
  }, [pendingGeneration, overrideToken, governanceOverrideToken, isGenerating]);

  const handleGenerateDish = async (skipPreflight = false, dietAdaptOverride = false, userDietOverride = false) => {
    const submittedDishInput = await captureAuthoritativeTextValue(dishInputRef.current, dishInput, 300);
    if (submittedDishInput !== dishInput) updateDishInput(submittedDishInput);
    const effectiveUserDietOverride = userDietOverride || continueAnywayRef.current;
    continueAnywayRef.current = false;
    userDietOverride = effectiveUserDietOverride;
    setDietAdaptedNotice(null);

    if (!submittedDishInput.trim()) {
      toast({
        title: t("createDish.errorMissing"),
        description: t("createDish.errorDescribe"),
        variant: "destructive",
      });
      return;
    }

    const prompt = buildPrompt(submittedDishInput);

    // 🔐 Server-authoritative food-governance preflight.
    if (!skipPreflight && !hasActiveOverride) {
      const isSafe = await checkSafety(prompt, "create-dish");
      if (!isSafe) {
        // When the block carries an allergyConflict, show AllergyConflictModal
        // instead of SafetyGuardBanner so the user can choose their path.
        if (allergyConflictPayload.current) {
          setAllergyConflict(allergyConflictPayload.current);
          allergyConflictPayload.current = null;
        }
        return;
      }
    }

    if (!skipPreflight && starchDecision !== "let_chef_pick") {
      const starchOk = checkStarch(prompt);
      if (!starchOk) {
        return;
      }
    }

    const chefSubstituting =
      starchDecision === "let_chef_pick" && starchAlert.matchedTerms.length > 0;
    if (chefSubstituting) {
      setSubstitutedStarchTerms(starchAlert.matchedTerms);
    } else {
      setSubstitutedStarchTerms([]);
    }

    setIsGenerating(true);
    startProgressTicker();

    try {
      // Expansion is advisory: a failed or unsupported expansion must never
      // interrupt the established generation path.
      const createDishIntent = await getAuthoritativeExpansion(submittedDishInput);
      const url = apiUrl("/api/meals/craving-creator");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMealType: "dinner",
          cravingInput: prompt,
          dietaryRestrictions: dietOverrideEnabled && dietOverrideValue
            ? dietOverrideValue
            : normalizeDiet(user?.dietaryRestrictions),
          servings,
          sweetenerPreferences,
          skipPalate: !flavorPersonal,
          excludeMeals: getRecentMeals(),
          strictMode: keepItSimple,
          dietAdaptOverride,
          userDietOverride: false,
          ...(dietAdaptOverride ? { governanceDecision: "accept_alternative" } : {}),
          safetyMode: allergenSafeModeRef.current ? "ALLERGEN_ADAPT" : (overrideToken ? "CUSTOM_AUTHENTICATED" : (safetyEnabled ? "STRICT" : "DISABLED")),
          ...(overrideToken ? { overrideToken } : {}),
          ...(governanceOverrideToken ? { governanceOverrideToken } : {}),
          ...(cuisineOverrideEnabled && cuisineOverrideValue ? { cultureOverride: cuisineOverrideValue } : {}),
          ...(activeKitchenSlug ? { kitchenSlug: activeKitchenSlug } : {}),
          humanFoodCreator: "create_a_dish",
           ...(createDishIntent ? { createDishIntent } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // ── Typed allergen adaptation failure ──────────────────────────────────
        // This response must NEVER reach the generic allergy error handler.
        // It has its own structured fields and requires a workflow-specific message.
        if (data.reasonCode === "allergen_adaptation_failed") {
          const dish = data.requestedDish ? `"${data.requestedDish}"` : "this dish";
          const allergenLabel = Array.isArray(data.allergens)
            ? data.allergens.join(" and ")
            : (data.allergens || "your allergen");
          const retried = data.retryAttempted ? " (we tried twice)" : "";
          stopProgressTicker();
          setIsGenerating(false);
          allergenSafeModeRef.current = false;
          toast({
            title: "Couldn't create a fully safe version",
            description: `We couldn't make a ${allergenLabel}-free version of ${dish} that passed your allergy protection${retried}. Your protection is still fully active. Try a different dish, or use your Safety PIN to make the original.`,
            variant: "warning",
            duration: 12000,
          });
          return;
        }
        if (data.reasonCode === "constraint_conflict") {
          stopProgressTicker();
          setIsGenerating(false);
          toast({
            title: "No options fit your current plan",
            description: data.message || "Your health protocol eliminated all generated options. Try a lower-carb dish, or adjust your glucose settings.",
            duration: 8000,
          });
          return;
        }
        const safeServerMessage = getCreateDishServerErrorMessage(data);
        if (safeServerMessage) {
          stopProgressTicker();
          setIsGenerating(false);
          toast({
            title: "Couldn't create this dish",
            description: safeServerMessage,
            variant: "warning",
            duration: 10000,
          });
          return;
        }
        throw new Error(data.message || "Failed to generate meal");
      }

      if (data.meals && Array.isArray(data.meals) && data.meals.length > 0) {
        stopProgressTicker();
        setIsGenerating(false);
        const userDiet = normalizeDiet(user?.dietaryRestrictions);
        if (data.dietAdapted) {
          setDietAdaptedNotice(
            data.dietNotice || `Adapted for your ${userDiet} diet.`,
          );
          clearDietAlert();
        }
        setMealOptions(data.meals);
        return;
      }

      const meal = data.meal || data;

      const userDiet = normalizeDiet(user?.dietaryRestrictions);
      if (data.dietAdapted) {
        setDietAdaptedNotice(
          data.dietNotice || `Adapted for your ${userDiet} diet.`,
        );
        clearDietAlert();
      } else if (
        !skipPreflight &&
        activeDiet &&
        !mealMatchesDiet(userDiet, meal)
      ) {
        stopProgressTicker();
        setIsGenerating(false);
        triggerDietAlert(
          [],
          `This meal may not fully match your ${userDiet} diet.`,
        );
        return;
      }

      stopProgressTicker();
      setGeneratedMeals([meal]);
      setGeneratedInSession(true);

      saveDishCache({
        generatedMeal: meal,
        servings,
        generatedAtISO: new Date().toISOString(),
      });

      toast({
        title: t("createDish.successTitle"),
        description: `${meal.name} is ready for you.`,
      });
    } catch (error: any) {
      stopProgressTicker();
      const errorMsg = error.message || "";
      if (errorMsg === "CREATE_DISH_CHOICES_INVALID") {
        toast({
          title: "Review your preparation choices",
          description: "Those choices don't work together. Change one choice or use Surprise Me.",
          variant: "warning",
        });
      } else if (isAllergyRelatedError(errorMsg)) {
        toast({
          title: t("createDish.allergyAlert"),
          description: formatAllergyAlertDescription(errorMsg),
          variant: "warning",
          duration: 10000,
        });
      } else {
        toast({
          title: t("common.error"),
          description: t("createDish.errorFailed"),
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
      allergenSafeModeRef.current = false;
    }
  };

  return (
    <PhaseGate phase="PHASE_1_CORE" feature="create-dish">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen pb-safe-nav"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(10,4,0,0.82) 0%, rgba(10,4,0,0.55) 50%, rgba(10,4,0,0.35) 100%), url('/images/chef-copilot-cooking-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <MobileHeaderGuard>
          <div
            className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-lg border-b border-orange-400/20"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
              <h1 className="text-lg font-bold text-white truncate min-w-0">
                {activeKitchenName ? `${activeKitchenName}` : t("createDish.pageTitle")}
              </h1>

              <div className="flex-grow" />
            </div>
          </div>
        </MobileHeaderGuard>

        <div
          className={`max-w-2xl mx-auto px-4 pt-28 ${generatedMeals.length > 0 ? "pb-32" : "pb-8"}`}
        >
          {!isDesktop && (
            <button
              onClick={() => setLocation("/lifestyle")}
              className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back</span>
            </button>
          )}

          {/* Hub Intro — matches Pairings Hub pattern */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Custom Cooking</h2>
            <p className="text-sm text-white/70">Describe what you want to eat and AI builds the perfect recipe for your health profile.</p>
          </div>

          {/* Kitchen context banner */}
          {activeKitchenSlug && (
            <div className="max-w-xl mx-auto mb-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center gap-2 min-w-0">
                <ChefHat className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                <span className="text-xs text-orange-200 truncate">
                  {activeKitchenName ? (
                    <><span className="font-semibold">{activeKitchenName}</span> style — your dietary rules always apply</>
                  ) : "Kitchen style active"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setActiveKitchenSlug(null); setActiveKitchenName(null); }}
                className="text-[10px] text-white/40 hover:text-white/60 flex-shrink-0 px-1"
              >
                Clear
              </button>
            </div>
          )}

          <div className="w-full max-w-4xl mx-auto">
            <div>
              <Card className="shadow-2xl bg-black/40 backdrop-blur-lg border border-orange-400/20 w-full max-w-xl mx-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl text-white">
                    {t("createDish.pageTitle")}
                    <div className="flex-grow" />
                    <HowThisWorksLink
                      videoUrl="https://youtube.com/shorts/OxdqoAYQpsA?feature=share"
                      label="How It Works"
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-md font-medium text-white">
                        {t("createDish.label")}
                      </label>
                    </div>
                    <div className="relative">
                      <textarea
                        ref={dishInputRef}
                        defaultValue=""
                        onChange={(e) => commitTextInputValue(e, setDishInput, 300)}
                        onInput={(e) => commitTextInputValue(e, setDishInput, 300)}
                        onCompositionEnd={(e) => commitTextInputValue(e, setDishInput, 300)}
                        placeholder={t("createDish.placeholder")}
                        className="w-full px-3 py-2 pr-10 bg-black text-white placeholder:text-white/40 border border-orange-400/20 rounded-lg h-20 resize-none text-sm"
                        maxLength={300}
                      />
                      {dishInput && (
                        <TrashButton
                          onClick={() => updateDishInput("")}
                          size="sm"
                          ariaLabel="Clear dish input"
                          title="Clear dish input"
                          className="absolute top-2 right-2"
                        />
                      )}
                    </div>
                    <VoiceInputButton
                      value={dishInput}
                      onChange={updateDishInput}
                      mode="append"
                      separator=" "
                      maxLength={300}
                      label="Add dish description by voice"
                      className="mt-2"
                    />
                    <p className="text-xs text-white/50 mt-1 text-right">
                      {dishInput.length}/300
                    </p>
                  </div>

                  {expansionFallback && (
                    <p className="rounded-lg border border-orange-300/20 bg-orange-950/30 px-3 py-2 text-xs leading-relaxed text-orange-100/80">
                      We couldn't load preparation ideas right now. You can still create your dish.
                    </p>
                  )}

                  {expansionBusy && (
                    <div className="h-12 animate-pulse rounded-lg border border-white/10 bg-white/5" aria-label="Understanding your dish" />
                  )}

                  {ingredientExpansion && canRenderCreateDishPreparation({
                    resultSource: acceptedExpansionSource,
                    currentVisibleValue: dishInputRef.current?.value ?? dishInput,
                    status: ingredientExpansion.ingredient.status,
                  }) && (
                    <div className="space-y-3 rounded-xl border border-orange-400/20 bg-black/25 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-white">A little more direction?</p>
                          <p className="text-xs text-white/55">We understood the idea. Tune it, or let the chef choose.</p>
                        </div>
                         <PillButton
                           type="button"
                           onClick={surpriseAll}
                           active={EXPANSION_DIMENSIONS.every((dimension) => delegatedDimensions.includes(dimension))}
                           variant="amber"
                           aria-pressed={EXPANSION_DIMENSIONS.every((dimension) => delegatedDimensions.includes(dimension))}
                           className="normal-case tracking-normal text-[11px]"
                         >
                          Surprise Me
                         </PillButton>
                      </div>

                      {ingredientExpansion.ingredient.clarification && (
                        <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                          <p className="mb-2 text-xs font-medium leading-relaxed text-white/85">
                            {ingredientExpansion.ingredient.clarification.question}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ingredientExpansion.ingredient.clarification.choices.map((choice) => (
                              <PillButton
                                type="button"
                                key={choice.id}
                                onClick={() => chooseClarification(choice.id, choice.label)}
                                variant="amber"
                                className="max-w-full normal-case tracking-normal text-[11px]"
                              >
                                <span className="break-words">{choice.label}</span>
                              </PillButton>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        {EXPANSION_DIMENSIONS.map((dimension) => {
                          const options = rankExpansionOptions(
                            dimension,
                            ingredientExpansion.options[expansionOptionKey[dimension]],
                          );
                          if (!options?.length) return null;
                          return (
                            <div key={dimension} className="min-w-0">
                              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-white/80">
                                  {EXPANSION_DIMENSION_LABELS[dimension]}
                                </span>
                                <PillButton
                                  type="button"
                                  onClick={() => surpriseDimension(dimension)}
                                  active={delegatedDimensions.includes(dimension)}
                                  variant="amber"
                                  aria-pressed={delegatedDimensions.includes(dimension)}
                                  className="normal-case tracking-normal text-[10px]"
                                >
                                  Surprise Me
                                </PillButton>
                              </div>
                              <div className="flex max-w-full flex-wrap gap-2">
                                {options.map((option) => {
                                  const incompatible =
                                    dimension === "texture" &&
                                    !isTextureCompatibleWithCookMethod(option);
                                  return (
                                    <PillButton
                                      type="button"
                                      key={option.id}
                                      disabled={incompatible}
                                      active={expansionSelections[dimension] === option.id}
                                      variant="amber"
                                      aria-pressed={expansionSelections[dimension] === option.id}
                                      title={incompatible ? `${option.label} is not compatible with ${cookMethod}` : undefined}
                                      onClick={() => toggleExpansionSelection(dimension, option.id)}
                                      className={`max-w-full normal-case tracking-normal text-[11px] leading-snug ${
                                        incompatible ? "cursor-not-allowed opacity-40 line-through" : ""
                                      }`}
                                    >
                                      <span className="break-words">{option.label}</span>
                                    </PillButton>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <DietCuisineControlRow
                    savedCuisine={user?.cuisinePreference}
                    dietOverrideEnabled={dietOverrideEnabled}
                    dietOverrideValue={dietOverrideValue}
                    onDietToggle={setDietOverrideEnabled}
                    onDietChange={setDietOverrideValue}
                    cuisineOverrideEnabled={cuisineOverrideEnabled}
                    cuisineOverrideValue={cuisineOverrideValue}
                    onCuisineToggle={setCuisineOverrideEnabled}
                    onCuisineChange={setCuisineOverrideValue}
                  />

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">
                      {t("createDish.servings")}
                    </label>
                    <Select
                      value={servings.toString()}
                      onValueChange={(v) => setServings(parseInt(v))}
                    >
                      <SelectTrigger className="w-full text-sm bg-black text-white border-orange-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (n) => (
                            <SelectItem key={n} value={n.toString()}>
                              {n === 1
                                ? "1 serving (just me)"
                                : `${n} servings`}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">
                      {t("createDish.cookMethod")}
                    </label>
                    <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
                      {COOK_METHODS.map((m) => (
                        <IconPillOption
                          key={m.label}
                          icon={m.emoji}
                          label={m.label}
                          active={cookMethod === m.label}
                          onClick={() => selectCookMethod(m.label)}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-white">
                      {t("createDish.notes")}
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("createDish.notesPlaceholder")}
                      className="w-full px-3 py-2 bg-black text-white placeholder:text-white/40 border border-orange-400/20 rounded-lg h-16 resize-none text-sm"
                      maxLength={250}
                    />
                    <VoiceInputButton
                      value={notes}
                      onChange={setNotes}
                      mode="append"
                      separator=" "
                      maxLength={250}
                      label="Add dish notes by voice"
                      className="mt-2"
                    />
                    <p className="text-xs text-white/50 mt-1 text-right">
                      {notes.length}/250
                    </p>
                  </div>

                  {/* SafetyGuard Preflight Banner */}
                  <SafetyGuardBanner
                    alert={safetyAlert}
                    mealRequest={dishInput}
                    onDismiss={clearSafetyAlert}
                    onOverrideSuccess={(token) =>
                      handleSafetyOverride(false, token)
                    }
                    continuingAnyway={acknowledgingAdvisory}
                    onAcceptAlternative={() => {
                      clearSafetyAlert();
                      handleGenerateDish(true, true, false);
                    }}
                    onContinueAnyway={async () => {
                      setAcknowledgingAdvisory(true);
                      const acknowledged = await acknowledgeAdvisory(buildPrompt(), "create-dish");
                      setAcknowledgingAdvisory(false);
                      if (acknowledged) {
                        setPendingGeneration(true);
                      } else {
                        toast({
                          title: "Could not continue",
                          description: "Please review the recommendation again and retry.",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="mt-3"
                  />

                  <StarchGuardIntercept
                    alert={starchAlert}
                    onDecision={(decision) => {
                      if (decision === "order_something_else") {
                        clearStarchAlert();
                        updateDishInput("");
                        toast({
                          title: "Try a different ingredient",
                          description:
                            "Choose something without starches like meat, fish, or veggies.",
                          duration: 4000,
                        });
                      } else if (decision === "let_chef_pick") {
                        setStarchDecision(decision);
                        handleGenerateDish(true);
                      }
                    }}
                    className="mt-3"
                  />

                  <DietGuardIntercept
                    alert={dietAlert}
                    onDecision={(decision) => {
                      if (decision === "pick_something_else") {
                        clearDietAlert();
                        setGeneratedMeals([]);
                        setMealOptions([]);
                        updateDishInput("");
                      } else if (decision === "let_chef_adapt") {
                        setDietDecision("let_chef_adapt");
                        clearDietAlert();
                        handleGenerateDish(true, true, false);
                      } else if (decision === "continue_anyway") {
                        continueAnywayRef.current = true;
                        clearDietAlert();
                        handleGenerateDish(true, false, true);
                      }
                    }}
                    className="mt-3"
                  />

                  <div className="mt-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                    <span className="text-xs text-white/60 block mb-2">
                      Meal Safety
                    </span>

                    <SafetyGuardToggle
                      safetyEnabled={safetyEnabled}
                      onSafetyChange={handleSafetyOverride}
                      disabled={isGenerating}
                      allergenContext={pendingOverrideAllergensRef.current.length > 0 ? pendingOverrideAllergensRef.current : undefined}
                    />
                    <GlucoseGuardToggle disabled={isGenerating} />
                  </div>

                  <div className="mt-2 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                    <span className="text-xs text-white/60 block mb-2">
                      Flavor Profile
                    </span>
                    <FlavorToggle
                      flavorPersonal={flavorPersonal}
                      onFlavorChange={setFlavorPersonal}
                      disabled={isGenerating}
                    />
                  </div>

                  {/* Keep It Simple Section */}
                  <div className="mt-2 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                    <span className="text-xs text-white/60 block mb-2">
                      Ingredient Control
                    </span>
                    <KeepItSimpleToggle
                      keepItSimple={keepItSimple}
                      onToggle={setKeepItSimple}
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-white/40 mt-1">
                      {keepItSimple
                        ? "AI will use only what you listed — nothing added"
                        : "AI may add complementary ingredients"}
                    </p>
                  </div>

                  {isGenerating && (
                    <div className="flex justify-center mt-2">
                      <ThinkingDots label="Chef is crafting your dish…" />
                    </div>
                  )}

                  {!isGenerating ? (
                    <GlassButton
                      onClick={() => handleGenerateDish()}
                      disabled={isGenerating || starchBlocked}
                      className="w-full bg-lime-600 overflow-hidden text-ellipsis whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      <ChefHat className="h-4 w-4" />
                      {"Create My Dish"}
                    </GlassButton>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>

          {isPlatingMeal && (
            <div className="mt-8 flex justify-center py-10">
              <ThinkingDots label="Chef is plating your dish…" />
            </div>
          )}

          {/* Initial picker — only shown before a meal has been selected */}
          {!isPlatingMeal && mealOptions.length > 0 && generatedMeals.length === 0 && (
            <div className="mt-8 space-y-4" ref={mealOptionsRef}>
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="h-5 w-5 text-orange-400" />
                <h3 className="text-lg font-bold text-white">
                  Pick your favorite
                </h3>
                <span className="text-sm text-white/60">
                  {mealOptions.length} options created for you
                </span>
              </div>
              {mealOptions.map((option, idx) => (
                <Card
                  key={idx}
                  className="bg-black/40 backdrop-blur-lg border border-orange-400/20 shadow-xl rounded-2xl"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-bold text-base mb-1 truncate">
                          {option.name}
                        </h4>
                        <p className="text-white/70 text-sm mb-2 line-clamp-2">
                          {option.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <MealClassificationPill dietClassification={option.dietClassification ?? null} />
                          <KosherProTip dietClassification={option.dietClassification ?? null} isAdapted={false} />
                        </div>
                        <div className="flex gap-4 text-xs text-white/60 flex-wrap">
                          <span>
                            {option.nutrition?.calories ??
                              option.calories ??
                              "—"}{" "}
                            cal
                          </span>
                          <span>
                            {option.nutrition?.protein ?? option.protein ?? "—"}
                            g protein
                          </span>
                          <span>
                            {option.nutrition?.fat ?? option.fat ?? "—"}g fat
                          </span>
                          {option.cookingTime && (
                            <span>{option.cookingTime}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelectMeal(option)}
                        className="shrink-0 bg-lime-600 active:scale-95 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                      >
                        Pick This
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <button
                onClick={() => {
                  setMealOptions([]);
                  clearOptionsCache();
                  updateDishInput("");
                }}
                className="w-full text-sm text-white/50 hover:text-white/80 py-2 transition-colors"
              >
                Start over with a different dish
              </button>
            </div>
          )}

          {generatedMeals.length > 0 && (
            <div className="mt-8 space-y-6">
              {generatedMeals.map((meal, index) => (
                <div key={index}>
                  <Card className="bg-black/40 backdrop-blur-lg border border-orange-400/20 shadow-xl rounded-2xl">
                    <CardContent className="p-6">
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <ChefHat className="h-5 w-5 text-orange-400 shrink-0" />
                          <h3 className="text-xl font-bold text-white truncate leading-tight">
                            {meal.name}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between">
                          <FavoriteButton
                            title={meal.name}
                            sourceType="create-dish"
                            mealData={meal}
                          />
                          <button
                            onClick={() => {
                              setGeneratedMeals([]);
                              setGeneratedInSession(false);
                              clearDishCache();
                              setMealOptions([]);
                              clearOptionsCache();
                              updateDishInput("");
                              setSubstitutedStarchTerms([]);
                              clearStarchAlert();
                            }}
                            className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-lg transition-colors active:scale-[0.98]"
                          >
                            Create New
                          </button>
                        </div>
                      </div>

                      {substitutedStarchTerms.length > 0 && (
                        <StarchSubstitutionNotice
                          originalTerms={substitutedStarchTerms}
                          className="mb-4"
                        />
                      )}

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <DietStyleBadge />
                        <MealClassificationPill dietClassification={meal.dietClassification} />
                        {dietAdaptedNotice && (
                          <DietAdaptedNotice
                            diet={normalizeDiet(user?.dietaryRestrictions)}
                          />
                        )}
                        <KosherProTip
                          dietClassification={meal.dietClassification}
                          isAdapted={!!dietAdaptedNotice}
                        />
                      </div>

                      <p className="text-white/90 mb-4">{meal.description}</p>

                      {(meal.imageUrl || loadingImages[meal.id]) ? (
                        <MealImageSlot
                          imageUrl={meal.imageUrl}
                          mealName={meal.name}
                          ingredients={meal.ingredients}
                          isLoading={!!loadingImages[meal.id]}
                        />
                      ) : (
                        <div className="mb-6 p-4 rounded-xl bg-black/40 border border-orange-400/30 text-center">
                          <p className="text-white/70 text-sm mb-3">
                            This result was saved in an older session before images were stored. Generate a fresh dish to get your image.
                          </p>
                          <button
                            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                            className="px-4 py-2 rounded-full bg-orange-600 text-white text-sm font-medium"
                          >
                            Scroll up to regenerate
                          </button>
                        </div>
                      )}

                      <div className="mb-4 p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">
                            Serving Size:
                          </span>{" "}
                          {meal.servingSize || "1 serving"}
                        </div>
                      </div>

                      <ServingInstructionsBlock
                        servings={servings}
                        mealName={meal.name}
                        description={meal.description}
                      />

                      {servings > 1 && (
                        <div className="mb-3 p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/20">
                          <div className="text-xs text-white text-center">
                            <strong>
                              Total nutrition below is for {servings} servings.
                            </strong>
                            <br />
                            Per serving:{" "}
                            {Math.round(
                              (meal.nutrition?.calories || meal.calories || 0) /
                                servings,
                            )}{" "}
                            cal |{" "}
                            {Math.round(
                              (meal.nutrition?.protein || meal.protein || 0) /
                                servings,
                            )}
                            g protein |{" "}
                            {Math.round(
                              (meal.nutrition?.carbs || meal.carbs || 0) /
                                servings,
                            )}
                            g carbs |{" "}
                            {Math.round(
                              (meal.nutrition?.fat || meal.fat || 0) / servings,
                            )}
                            g fat
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {meal.nutrition?.calories || meal.calories || 0}
                          </div>
                          <div className="text-xs text-white">Calories</div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {meal.nutrition?.protein || meal.protein || 0}g
                          </div>
                          <div className="text-xs text-white">Protein</div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {meal.nutrition?.carbs || meal.carbs || 0}g
                          </div>
                          <div className="text-xs text-white">Carbs</div>
                          {(() => {
                            const totalCarbs = meal.nutrition?.carbs || meal.carbs || 0;
                            const storedS = meal.nutrition?.starchyCarbs ?? meal.starchyCarbs;
                            const storedF = meal.nutrition?.fibrousCarbs ?? meal.fibrousCarbs;
                            const { starchyCarbs, fibrousCarbs } = (typeof storedS === "number" && typeof storedF === "number")
                              ? { starchyCarbs: storedS, fibrousCarbs: storedF }
                              : deriveSplitCarbs(meal.ingredients ?? [], totalCarbs);
                            if (!totalCarbs && !starchyCarbs && !fibrousCarbs) return null;
                            return (
                              <div className="text-xs text-white/80 mt-1 font-medium">
                                <span className="text-amber-300">{Math.round(starchyCarbs)}S</span>
                                {" / "}
                                <span className="text-green-300">{Math.round(fibrousCarbs)}F</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {meal.nutrition?.fat || meal.fat || 0}g
                          </div>
                          <div className="text-xs text-white">Fat</div>
                        </div>
                      </div>

                      {(() => {
                        const profile = getUserMedicalProfile(1);
                        const mealForBadges = {
                          name: meal.name,
                          calories:
                            meal.nutrition?.calories ?? meal.calories ?? 0,
                          protein: meal.nutrition?.protein ?? meal.protein ?? 0,
                          carbs: meal.nutrition?.carbs ?? meal.carbs ?? 0,
                          fat: meal.nutrition?.fat ?? meal.fat ?? 0,
                          ingredients: (meal.ingredients ?? []).map(
                            (ing: any) => ({
                              name: ing.name ?? ing.item,
                              amount:
                                typeof ing.quantity === "number"
                                  ? ing.quantity
                                  : typeof ing.amount === "number"
                                    ? ing.amount
                                    : parseFloat(
                                        String(
                                          ing.quantity ?? ing.amount ?? "1",
                                        ),
                                      ) || 1,
                              unit: (ing.unit ?? "serving")
                                .toString()
                                .toLowerCase(),
                            }),
                          ),
                        };

                        const medicalBadges =
                          (meal as any).medicalBadges &&
                          (meal as any).medicalBadges.length
                            ? (meal as any).medicalBadges
                            : generateMedicalBadges(
                                mealForBadges as any,
                                profile,
                              );

                        return medicalBadges && medicalBadges.length > 0 ? (
                          <div className="mb-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <HealthBadgesPopover
                                  badges={medicalBadges.map((b: any) =>
                                    typeof b === "string"
                                      ? b
                                      : b.badge ||
                                        b.id ||
                                        b.condition ||
                                        b.label,
                                  )}
                                />
                                <h3 className="font-semibold text-white">
                                  Medical Safety
                                </h3>
                              </div>
                              <TrashButton
                                size="sm"
                                ariaLabel="Remove meal"
                                title="Remove meal"
                                confirm={true}
                                confirmMessage="Remove this meal?"
                                onClick={() => {
                                  setGeneratedMeals([]);
                                  setGeneratedInSession(false);
                                }}
                              />
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {meal.ingredients && meal.ingredients.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2 text-white">
                            Ingredients:
                          </h4>
                          <ul className="text-sm text-white/80 space-y-1">
                            {meal.ingredients.map(
                              (ingredient: any, i: number) => {
                                const name = ingredient.item || ingredient.name;
                                const amount =
                                  ingredient.amount || ingredient.quantity;
                                const unit = ingredient.unit;

                                if (ingredient.displayText) {
                                  return (
                                    <li key={i}>{ingredient.displayText}</li>
                                  );
                                }

                                if (amount && unit) {
                                  return (
                                    <li key={i}>
                                      {formatAmount(amount)} {unit} {name}
                                    </li>
                                  );
                                }

                                return <li key={i}>{name}</li>;
                              },
                            )}
                          </ul>
                        </div>
                      )}

                      {(() => {
                        const steps = normalizeInstructions(meal.instructions);
                        if (steps.length === 0) return null;
                        const expanded = !!stepsExpanded[meal.id];
                        const visibleSteps = expanded
                          ? steps
                          : steps.slice(0, 3);
                        return (
                          <div className="mb-4">
                            <h4 className="font-semibold mb-2 text-white">
                              Instructions:
                            </h4>
                            <div className="space-y-2">
                              {visibleSteps.map((step, index) => (
                                <div
                                  key={index}
                                  className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors select-none ${activeSteps[meal.id] === index ? "bg-orange-500/20 border border-orange-500/40" : "hover:bg-white/5"}`}
                                  onClick={() =>
                                    setActiveSteps((prev) => ({
                                      ...prev,
                                      [meal.id]:
                                        prev[meal.id] === index ? null : index,
                                    }))
                                  }
                                >
                                  <div className="min-w-[26px] h-[26px] w-[26px] rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                    {index + 1}
                                  </div>
                                  <p className="text-sm leading-relaxed text-white/85">
                                    {step}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {steps.length > 3 && (
                              <button
                                className="mt-2 text-xs text-orange-400 font-medium cursor-pointer active:text-orange-300 select-none"
                                onClick={() => {
                                  setStepsExpanded((prev) => ({
                                    ...prev,
                                    [meal.id]: !expanded,
                                  }));
                                  if (expanded)
                                    setActiveSteps((prev) => ({
                                      ...prev,
                                      [meal.id]: null,
                                    }));
                                }}
                              >
                                {expanded
                                  ? "Show less"
                                  : `Show all ${steps.length} steps`}
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {meal.reasoning && (
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                            <Brain className="h-4 w-4" />
                            Why This Works For You:
                          </h4>
                          <p className="text-sm text-white/80">
                            {meal.reasoning}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2 mb-3">
                        <GlassButton
                          onClick={() => {
                            const macros = getMealNutrition(meal);
                            setQuickView({
                              protein: Math.round(macros.protein_g),
                              carbs: Math.round(macros.carbs_g),
                              starchyCarbs: Math.round(macros.starchyCarbs),
                              fibrousCarbs: Math.round(macros.fibrousCarbs),
                              fat: Math.round(macros.fat_g),
                              calories: Math.round(macros.calories),
                              dateISO: new Date().toISOString().slice(0, 10),
                              mealSlot: "dinner",
                            });
                            setLocation(
                              "/biometrics?from=create-dish&view=macros",
                            );
                          }}
                          className="w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white flex items-center justify-center border border-white/30"
                        >
                          Add to Macros
                        </GlassButton>

                        <div className="grid grid-cols-2 gap-2">
                          <AddToMealPlanButton meal={meal} />
                          <TranslateToggle
                            content={{
                              name: meal.name,
                              description: meal.description,
                              instructions: meal.instructions,
                              ingredients: meal.ingredients,
                            }}
                            onTranslate={(translated) => {
                              setGeneratedMeals((prev) =>
                                prev.map((m) =>
                                  m.id === meal.id
                                    ? {
                                        ...m,
                                        name: translated.name,
                                        description:
                                          translated.description ||
                                          m.description,
                                        instructions:
                                          typeof translated.instructions ===
                                          "string"
                                            ? translated.instructions
                                            : m.instructions,
                                        ingredients:
                                          (translated.ingredients as StructuredIngredient[]) ||
                                          m.ingredients,
                                      }
                                    : m,
                                ),
                              );
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <GlassButton
                            onClick={() => {
                              const safeImageUrl = (() => {
                                const url = meal.imageUrl;
                                if (!url) return null;
                                if (url.startsWith("data:")) return null;
                                if (url.includes("oaidalleapiprodscus")) return null;
                                return url;
                              })();
                              const mealData = {
                                id: meal.id || crypto.randomUUID(),
                                name: meal.name,
                                description: meal.description,
                                ingredients: meal.ingredients || [],
                                instructions: meal.instructions,
                                imageUrl: safeImageUrl,
                              };
                              writeChefHandoffMeal(mealData);
                              localStorage.setItem(
                                "mpm_chefs_kitchen_external_prepare",
                                "true",
                              );
                              localStorage.setItem("mpm_chefs_kitchen_origin", window.location.pathname);
                              setLocation("/lifestyle/chefs-kitchen");
                            }}
                            className="flex-1 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 hover:from-red-400 hover:via-orange-400 hover:to-yellow-300 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                          >
                            Guided Cooking
                          </GlassButton>
                          <ShareRecipeButton
                            recipe={{
                              name: meal.name,
                              description: meal.description,
                              nutrition: meal.nutrition,
                              instructions: meal.instructions,
                              ingredients: (meal.ingredients ?? []).map(
                                (ing: any) => ({
                                  name: ing.item || ing.name,
                                  amount: String(ing.amount ?? ing.quantity ?? ""),
                                  unit: ing.unit,
                                }),
                              ),
                            }}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}

              {/* Generated Alternatives — remaining unchosen options, shown below the selected meal */}
              {!isPlatingMeal && mealOptions.filter((o) => o.name !== generatedMeals[0]?.name).length > 0 && (
                <div className="mt-2 space-y-3">
                  <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                    <Sparkles className="h-4 w-4 text-orange-400/60" />
                    <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
                      Generated Alternatives
                    </h3>
                  </div>
                  {mealOptions
                    .filter((o) => o.name !== generatedMeals[0]?.name)
                    .map((option, idx) => (
                      <Card
                        key={idx}
                        className="bg-black/25 backdrop-blur-lg border border-orange-400/10 shadow-md rounded-2xl"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-semibold text-sm mb-1 break-words">
                                {option.name}
                              </h4>
                              <p className="text-white/60 text-xs mb-2 line-clamp-2">
                                {option.description}
                              </p>
                              <div className="flex gap-3 text-xs text-white/50 flex-wrap">
                                <span>
                                  {option.nutrition?.calories ?? option.calories ?? "—"} cal
                                </span>
                                <span>
                                  {option.nutrition?.protein ?? option.protein ?? "—"}g protein
                                </span>
                                {option.cookingTime && <span>{option.cookingTime}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleSelectMeal(option)}
                              className="shrink-0 bg-lime-700 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                            >
                              Pick This
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  <button
                    onClick={() => {
                      setMealOptions([]);
                      clearOptionsCache();
                      updateDishInput("");
                    }}
                    className="w-full text-xs text-white/40 hover:text-white/70 py-2 transition-colors"
                  >
                    Start over with a different dish
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {generatedMeals.length > 0 && generatedInSession && (
          <ShoppingAggregateBar
            ingredients={generatedMeals.flatMap((meal) =>
              meal.ingredients.map((ing: StructuredIngredient) => ({
                name: ing.name,
                qty:
                  typeof ing.quantity === "string"
                    ? parseFloat(ing.quantity) || undefined
                    : ing.quantity,
                unit: ing.unit,
              })),
            )}
            source="Create a Dish"
            hideShareButton={true}
            aboveBottomNav={true}
          />
        )}
      </motion.div>

      {/* Allergy Conflict Modal — shown instead of SafetyGuardBanner when an
          adaptable allergyConflict is detected. Offers three paths:
          "Make it safe for me" (DAL adapt, no PIN), "Make the original" (PIN),
          and "Cancel". */}
      <AllergyConflictModal
        conflict={allergyConflict}
        onMakeSafe={() => {
          setAllergyConflict(null);
          allergenSafeModeRef.current = true;
          handleGenerateDish(true /* skipPreflight */);
        }}
        onMakeOriginal={() => {
          // Snapshot allergens before clearing state — SafetyGuardToggle needs them
          // to issue the override token for the correct allergen (e.g. "shellfish").
          pendingOverrideAllergensRef.current = allergyConflict?.allergens ?? [];
          setAllergyConflict(null);
          restoreBlockedAlert(); // restores SafetyGuardBanner with PIN button
        }}
        onCancel={() => {
          setAllergyConflict(null);
        }}
      />
    </PhaseGate>
  );
}
