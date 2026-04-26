import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useMealImages } from "@/hooks/useMealImages";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import ThinkingDots from "@/components/ThinkingDots";
import { useLocation } from "wouter";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
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
import { Brain, Sparkles, ArrowLeft, ChefHat, Users, Star, Minus, Plus, Check, X, Mic, MicOff, ChevronDown, ChevronUp } from "lucide-react";
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
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import { setQuickView } from "@/lib/macrosQuickView";
import TrashButton from "@/components/ui/TrashButton";
import FavoriteButton from "@/components/FavoriteButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { PillButton } from "@/components/ui/pill-button";
import ServingInstructionsBlock from "@/components/ServingInstructionsBlock";
import PhaseGate from "@/components/PhaseGate";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import DietStyleBadge from "@/components/DietStyleBadge";
import MealClassificationPill from "@/components/MealClassificationPill";
import KosherProTip from "@/components/KosherProTip";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import {
  type DishCategory,
  type TraditionalDish,
  getHolidayDishes,
  getPopularDishes,
  getAllDishes,
} from "@/data/holidayTraditionalDishes";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface StructuredIngredient {
  name: string;
  quantity?: string | number;
  unit?: string;
  category?: string;
}

interface CourseMeal {
  id: string;
  name: string;
  imageUrl?: string;
  description: string;
  ingredients: StructuredIngredient[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
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
  courseType: "appetizer" | "main" | "side" | "dessert";
  courseLabel: string;
  assignedDish: string | null;
  isFamilySpecialty: boolean;
  servings: number;
  _fallback?: boolean;
}

type Situation = "holiday" | "camping" | "tailgating";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const SITUATIONS: Array<{ id: Situation; label: string; emoji: string }> = [
  { id: "holiday", label: "Holiday", emoji: "🎉" },
  { id: "camping", label: "Camping", emoji: "🏕️" },
  { id: "tailgating", label: "Tailgating", emoji: "🏈" },
];

const HOLIDAY_EVENTS = [
  { id: "thanksgiving", label: "Thanksgiving", emoji: "🦃" },
  { id: "christmas", label: "Christmas", emoji: "🎄" },
  { id: "kwanzaa", label: "Kwanzaa", emoji: "🕯" },
  { id: "hanukkah", label: "Hanukkah", emoji: "🕎" },
  { id: "eid", label: "Eid", emoji: "🌙" },
  { id: "passover", label: "Passover", emoji: "✡️" },
  { id: "new-years", label: "New Year's", emoji: "🎆" },
  { id: "fourth-of-july", label: "Fourth of July", emoji: "🎇" },
];

const COURSE_COUNTS = [3, 4, 5] as const;

const COURSE_EMOJI: Record<string, string> = {
  appetizer: "🥗",
  main: "🍽",
  side: "🌿",
  dessert: "🍰",
};

// ─────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────
const CACHE_KEY = "ultimateExperience.cache.v1";

type CachedExperienceState = {
  courses: CourseMeal[];
  servings: number;
  situation: Situation;
  eventType: string | null;
  generatedAtISO: string;
};

function saveExperienceCache(state: CachedExperienceState) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {}
}

function loadExperienceCache(): CachedExperienceState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.courses?.length) return null;
    return parsed as CachedExperienceState;
  } catch {
    return null;
  }
}

function clearExperienceCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
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

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function UltimateExperiencesPage() {
  useCopilotPageExplanation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // ── Experience state (new) ───────────────────
  const [situation, setSituation] = useState<Situation | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedDishes, setSelectedDishes] = useState<TraditionalDish[]>([]);
  const [familySpecialty, setFamilySpecialty] = useState("");
  const [customDishOpen, setCustomDishOpen] = useState<Record<string, boolean>>({});
  const [customDishText, setCustomDishText] = useState<Record<string, string>>({});
  const [familyRecipes, setFamilyRecipes] = useState("");
  const [dishAccordionOpen, setDishAccordionOpen] = useState(false);
  const [dishTabFilter, setDishTabFilter] = useState<"all" | "appetizer" | "main" | "side" | "dessert">("all");
  const [isListening, setIsListening] = useState(false);
  const [totalCourses, setTotalCourses] = useState<3 | 4 | 5>(4);
  const [servings, setServings] = useState<number>(6);

  // ── Shared state (from CreateDishPage) ───────
  const [chefNotes, setChefNotes] = useState("");
  const [generatedCourses, setGeneratedCourses] = useState<CourseMeal[]>([]);
  const [generatedInSession, setGeneratedInSession] = useState(false);
  const { loadingImages, hydrateImages } = useMealImages(setGeneratedCourses, { mealType: "dinner" });
  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState<Record<string, boolean>>({});
  const [activeSteps, setActiveSteps] = useState<Record<string, number | null>>({});
  const [flavorPersonal, setFlavorPersonal] = useState(true);
  const [keepItSimple, setKeepItSimple] = useState(false);
  const [dietAdaptedNotice, setDietAdaptedNotice] = useState<string | null>(null);
  const [substitutedStarchTerms, setSubstitutedStarchTerms] = useState<string[]>([]);
  const [pendingGeneration, setPendingGeneration] = useState(false);

  const { user } = useAuth();
  const sweetenerPreferences = user?.sweetenerPreferences || [];
  const userId = user?.id || "";

  // ── Guard hooks (same as CreateDishPage) ─────
  const {
    alert: dietAlert,
    decision: dietDecision,
    checkDiet,
    clearAlert: clearDietAlert,
    setDecision: setDietDecision,
    triggerAlert: triggerDietAlert,
    activeDiet,
  } = useDietGuardPrecheck();

  const {
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride,
  } = useSafetyGuardPrecheck();

  const {
    alert: starchAlert,
    decision: starchDecision,
    checkStarch,
    clearAlert: clearStarchAlert,
    setDecision: setStarchDecision,
    isBlocked: starchBlocked,
  } = useStarchGuardPrecheck();

  // ── Effects ──────────────────────────────────

  useEffect(() => {
    document.title = "My Perfect Gatherings | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    setDishAccordionOpen(false);
    setDishTabFilter("all");
    setFamilyRecipes("");
  }, [selectedEvent]);

  // Safe cache restore — generatedInSession stays false (no ShoppingBar cold-mount)
  useEffect(() => {
    const cached = loadExperienceCache();
    if (cached?.courses?.length) {
      setGeneratedCourses(cached.courses);
      setServings(cached.servings || 6);
      if (cached.situation) setSituation(cached.situation);
      if (cached.eventType) setSelectedEvent(cached.eventType);
    }
  }, []);

  useEffect(() => {
    if (generatedCourses.length > 0) {
      saveExperienceCache({
        courses: generatedCourses,
        servings,
        situation: situation || "holiday",
        eventType: selectedEvent,
        generatedAtISO: new Date().toISOString(),
      });
    }
  }, [generatedCourses, servings]);

  // Starch guard runs on combined input
  useEffect(() => {
    const combinedInput = [
      selectedEvent,
      selectedDishes.map((d) => d.name).join(" "),
      familySpecialty,
      chefNotes,
    ]
      .filter(Boolean)
      .join(" ");
    if (combinedInput.trim().length >= 3 && starchDecision === "pending") {
      checkStarch(combinedInput);
    }
  }, [selectedDishes, familySpecialty, chefNotes, starchDecision, checkStarch]);

  // When event changes, pre-select popular dishes
  useEffect(() => {
    if (selectedEvent) {
      const popular = getPopularDishes(selectedEvent);
      setSelectedDishes(popular);
    } else {
      setSelectedDishes([]);
    }
  }, [selectedEvent]);

  // Safety override flow
  const handleSafetyOverride = (_enabled: boolean, token?: string) => {
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert();
      setPendingGeneration(true);
    }
  };

  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGenerating) {
      setPendingGeneration(false);
      handleGenerateExperience(true);
    }
  }, [pendingGeneration, overrideToken, isGenerating]);

  // ── Progress ticker ───────────────────────────
  const startProgressTicker = () => {
    if (tickerRef.current) return;
    setProgress(0);
    tickerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 90) {
          const next = p + Math.max(1, Math.floor((90 - p) * 0.04));
          return Math.min(next, 90);
        }
        return p;
      });
    }, 200);
  };

  const stopProgressTicker = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setProgress(100);
  };

  // ── Dish picker helpers ───────────────────────
  const toggleDish = (dish: TraditionalDish) => {
    setSelectedDishes((prev) => {
      const exists = prev.some((d) => d.name === dish.name);
      if (exists) return prev.filter((d) => d.name !== dish.name);
      return [...prev, dish];
    });
  };

  const isDishSelected = (dish: TraditionalDish) =>
    selectedDishes.some((d) => d.name === dish.name);

  // ── Build preflight prompt ────────────────────
  const buildPreflightPrompt = () =>
    [
      selectedEvent ? `${selectedEvent} dinner` : situation,
      selectedDishes.map((d) => d.name).join(", "),
      familySpecialty,
      chefNotes,
    ]
      .filter(Boolean)
      .join(", ");

  // ── Main generation handler ───────────────────
  const handleGenerateExperience = async (
    skipPreflight = false,
    dietAdaptOverride = false,
  ) => {
    setDietAdaptedNotice(null);

    if (!situation) {
      toast({
        title: "Choose a situation",
        description: "Pick Holiday, Camping, or Tailgating to get started.",
        variant: "destructive",
      });
      return;
    }

    if (situation === "holiday" && !selectedEvent) {
      toast({
        title: "Choose a holiday",
        description: "Select the holiday you're celebrating.",
        variant: "destructive",
      });
      return;
    }

    const preflightPrompt = buildPreflightPrompt();

    // DietGuard preflight
    if (!skipPreflight && activeDiet && dietDecision !== "let_chef_adapt") {
      const dietOk = checkDiet(preflightPrompt);
      if (!dietOk) return;
    }

    // SafetyGuard preflight
    if (!skipPreflight && !hasActiveOverride) {
      const isSafe = await checkSafety(preflightPrompt, "ultimate-experience");
      if (!isSafe) return;
    }

    // StarchGuard preflight
    if (!skipPreflight && starchDecision !== "let_chef_pick") {
      const starchOk = checkStarch(preflightPrompt);
      if (!starchOk) return;
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
      const response = await fetch(apiUrl("/api/gatherings/generate"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          situation,
          eventType: selectedEvent || undefined,
          selectedDishes: selectedDishes.map((d) => ({
            name: d.name,
            category: d.category,
          })),
          familySpecialty: familySpecialty.trim() || undefined,
          notes: chefNotes.trim() || undefined,
          totalCourses,
          servingSize: servings,
          userId,
          dietaryRestrictions: Array.isArray(user?.dietaryRestrictions)
            ? user.dietaryRestrictions
            : [],
          sweetenerPreferences,
          dietAdaptOverride,
          flavorPersonal,
          keepItSimple,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate experience");
      }

      const userDiet = normalizeDiet(user?.dietaryRestrictions);
      if (data.dietAdapted) {
        setDietAdaptedNotice(
          data.dietNotice || `Adapted for your ${userDiet} diet.`,
        );
        clearDietAlert();
      }

      stopProgressTicker();
      setIsGenerating(false);
      const courses: CourseMeal[] = data.courses || [];
      setGeneratedCourses(courses);
      setGeneratedInSession(true);

      saveExperienceCache({
        courses,
        servings,
        situation,
        eventType: selectedEvent,
        generatedAtISO: new Date().toISOString(),
      });

      // Fire image generation for all courses in parallel — non-blocking
      if (courses.length > 0) {
        hydrateImages(courses);
      }

      toast({
        title: "Your experience is ready!",
        description: `${totalCourses}-course ${selectedEvent || situation} meal crafted for ${servings} people.`,
      });
    } catch (error: any) {
      stopProgressTicker();
      const errorMsg = error.message || "";
      if (isAllergyRelatedError(errorMsg)) {
        toast({
          title: "Allergy Alert",
          description: formatAllergyAlertDescription(errorMsg),
          variant: "warning",
        });
      } else {
        toast({
          title: "Something went wrong",
          description: "Unable to generate the experience. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Aggregate all ingredients across courses for shopping bar ──
  const allIngredients = generatedCourses.flatMap((course) =>
    (course.ingredients || []).map((ing: StructuredIngredient) => ({
      name: ing.name,
      qty:
        typeof ing.quantity === "string"
          ? parseFloat(ing.quantity) || undefined
          : ing.quantity,
      unit: ing.unit,
    })),
  );

  // ── JSX ───────────────────────────────────────
  return (
    <PhaseGate phase="PHASE_1_CORE" feature="create-dish">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
      >
        <MobileHeaderGuard>
          <div
            className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-lg border-b border-orange-400/20"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
              <button
                onClick={() => setLocation("/lifestyle")}
                className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <Star className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <h1 className="text-lg font-bold text-white truncate">
                  My Perfect Gatherings
                </h1>
              </div>
              <div className="flex-grow" />
            </div>
          </div>
        </MobileHeaderGuard>

        <div
          className={`max-w-2xl mx-auto px-4 pt-28 ${generatedCourses.length > 0 ? "pb-32" : "pb-8"}`}
        >
          <div className="w-full max-w-4xl mx-auto">
            <div>
              <Card className="shadow-2xl bg-black/40 backdrop-blur-lg border border-orange-400/20 w-full max-w-xl mx-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl text-white">
                    <Star className="h-5 w-5 text-amber-400" />
                    Plan Your Gathering
                  </CardTitle>
                  <p className="text-sm text-white/60 mt-1">
                    Full multi-course meals for holidays, camping, tailgates &amp; group events
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">

                  {/* ── LAYER 1: Situation ── */}
                  <div>
                    <label className="block text-sm font-medium mb-3 text-white">
                      What's the occasion?
                    </label>
                    <div className="flex gap-6">
                      {SITUATIONS.map((s) => (
                        <div key={s.id} className="flex flex-col items-center gap-1.5">
                          <PillButton
                            active={situation === s.id}
                            variant="amber"
                            onClick={() => {
                              setSituation(s.id);
                              setSelectedEvent(null);
                              setSelectedDishes([]);
                            }}
                            disabled={isGenerating}
                            className="w-16 text-lg leading-none py-2"
                          >
                            {s.emoji}
                          </PillButton>
                          <span className="text-xs text-white/80 font-medium">{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── LAYER 2: Holiday Event ── */}
                  {situation === "holiday" && (
                    <div>
                      <label className="block text-sm font-medium mb-3 text-white">
                        Which holiday?
                      </label>
                      <div className="flex flex-wrap gap-x-4 gap-y-3">
                        {HOLIDAY_EVENTS.map((h) => (
                          <div key={h.id} className="flex flex-col items-center gap-1.5">
                            <PillButton
                              active={selectedEvent === h.id}
                              variant="amber"
                              onClick={() =>
                                setSelectedEvent(selectedEvent === h.id ? null : h.id)
                              }
                              disabled={isGenerating}
                              className="w-16 text-lg leading-none py-2"
                            >
                              {h.emoji}
                            </PillButton>
                            <span className="text-xs text-white/80 font-medium text-center leading-tight">{h.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── LAYER 3a: Family Recipes (NEW — above dish picker) ── */}
                  {situation === "holiday" && selectedEvent && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-white">
                          Family Recipes
                          <span className="ml-1.5 text-white/40 font-normal text-xs">(optional)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                            if (!SR) {
                              toast({ title: "Voice not supported", description: "Try typing instead.", duration: 3000 });
                              return;
                            }
                            if (isListening) { setIsListening(false); return; }
                            const rec = new SR();
                            rec.lang = "en-US";
                            rec.interimResults = false;
                            rec.onstart = () => setIsListening(true);
                            rec.onend = () => setIsListening(false);
                            rec.onerror = () => setIsListening(false);
                            rec.onresult = (e: any) => {
                              const transcript = e.results[0][0].transcript;
                              setFamilyRecipes((prev) => (prev ? prev + " " + transcript : transcript));
                            };
                            rec.start();
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            isListening
                              ? "bg-orange-500/30 border-orange-400 text-orange-300 animate-pulse"
                              : "bg-black/40 border-white/20 text-white/60 hover:border-orange-400/50 hover:text-white"
                          }`}
                        >
                          {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                          {isListening ? "Listening…" : "Voice"}
                        </button>
                      </div>
                      <textarea
                        value={familyRecipes}
                        onChange={(e) => setFamilyRecipes(e.target.value)}
                        placeholder={`Paste or describe a recipe:\n"Grandma's mac and cheese — sharp cheddar, evaporated milk, baked crust"\n"Aunt Carol's collard greens with smoked turkey neck"`}
                        className="w-full px-3 py-2.5 bg-black text-white placeholder:text-white/30 border border-orange-400/20 rounded-lg h-28 resize-none text-sm leading-relaxed focus:outline-none focus:border-orange-400/50"
                        maxLength={1000}
                        disabled={isGenerating}
                      />
                      <p className="text-xs text-white/30 mt-1 text-right">{familyRecipes.length}/1000</p>
                      {familyRecipes.trim() && (
                        <p className="text-xs text-orange-400/80 mt-0.5">
                          Your family recipes will be preserved and adapted to your dietary needs
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── LAYER 3b: Traditional Dish Picker (collapsible + tabbed) ── */}
                  {situation === "holiday" && selectedEvent && (() => {
                    const holidayData = getHolidayDishes(selectedEvent);
                    if (!holidayData) return null;

                    const allSections: Array<{ label: string; category: DishCategory; dishes: TraditionalDish[] }> = [
                      { label: "Starters", category: "appetizer", dishes: holidayData.appetizers },
                      { label: "Mains",    category: "main",      dishes: holidayData.mains },
                      { label: "Sides",    category: "side",      dishes: holidayData.sides },
                      { label: "Desserts", category: "dessert",   dishes: holidayData.desserts },
                    ];

                    const TABS: Array<{ id: "all" | DishCategory; label: string }> = [
                      { id: "all",       label: "✨ All" },
                      { id: "appetizer", label: "🥗 Starters" },
                      { id: "main",      label: "🍽 Mains" },
                      { id: "side",      label: "🌿 Sides" },
                      { id: "dessert",   label: "🍰 Desserts" },
                    ];

                    const visibleSections = dishTabFilter === "all"
                      ? allSections
                      : allSections.filter((s) => s.category === dishTabFilter);

                    return (
                      <div>
                        {/* Accordion toggle */}
                        <button
                          onClick={() => setDishAccordionOpen((o) => !o)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/40 border border-white/10 hover:border-orange-400/30 transition-all"
                          disabled={isGenerating}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium text-white">Traditional Dishes</span>
                            <span className="text-xs text-white/50 mt-0.5">
                              {selectedDishes.length > 0
                                ? `${selectedDishes.length} selected · tap to customize`
                                : "Tap to choose dishes (optional)"}
                            </span>
                          </div>
                          {dishAccordionOpen
                            ? <ChevronUp className="h-4 w-4 text-white/40" />
                            : <ChevronDown className="h-4 w-4 text-white/40" />}
                        </button>

                        {/* Expanded content */}
                        {dishAccordionOpen && (
                          <div className="mt-3 space-y-3">
                            {/* Category tabs */}
                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                              {TABS.map((tab) => (
                                <PillButton
                                  key={tab.id}
                                  active={dishTabFilter === tab.id}
                                  variant="amber"
                                  onClick={() => setDishTabFilter(tab.id as any)}
                                  disabled={isGenerating}
                                  className="whitespace-nowrap shrink-0 px-4 py-1.5 text-xs"
                                >
                                  {tab.label}
                                </PillButton>
                              ))}
                            </div>

                            {/* Dish pills for active tab */}
                            {visibleSections.map((section) => {
                              const isOpen = !!customDishOpen[section.label];
                              const inputVal = customDishText[section.label] || "";
                              const confirmCustom = () => {
                                const trimmed = inputVal.trim();
                                if (!trimmed) return;
                                const customDish: TraditionalDish = { name: trimmed, category: section.category };
                                if (!isDishSelected(customDish)) setSelectedDishes((prev) => [...prev, customDish]);
                                setCustomDishText((prev) => ({ ...prev, [section.label]: "" }));
                                setCustomDishOpen((prev) => ({ ...prev, [section.label]: false }));
                              };

                              return (
                                <div key={section.label}>
                                  {dishTabFilter === "all" && (
                                    <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-1.5">
                                      {section.label}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-1.5">
                                    {section.dishes.map((dish) => {
                                      const selected = isDishSelected(dish);
                                      return (
                                        <PillButton
                                          key={dish.name}
                                          active={selected}
                                          variant="amber"
                                          onClick={() => toggleDish(dish)}
                                          disabled={isGenerating}
                                          className="text-xs px-3 py-1"
                                        >
                                          {selected && <Check className="h-3 w-3 mr-1" />}
                                          {dish.name}
                                        </PillButton>
                                      );
                                    })}

                                    {/* Custom dishes already added in this category */}
                                    {selectedDishes
                                      .filter((d) => d.category === section.category && !section.dishes.some((sd) => sd.name === d.name))
                                      .map((d) => (
                                        <PillButton
                                          key={d.name}
                                          active={true}
                                          variant="amber"
                                          onClick={() => toggleDish(d)}
                                          disabled={isGenerating}
                                          className="text-xs px-3 py-1"
                                        >
                                          <Check className="h-3 w-3 mr-1" />
                                          {d.name}
                                        </PillButton>
                                      ))}

                                    {/* + Custom */}
                                    {!isOpen && (
                                      <button
                                        onClick={() => setCustomDishOpen((prev) => ({ ...prev, [section.label]: true }))}
                                        className="px-3 py-1 rounded-full text-xs font-medium border border-dashed border-white/30 text-white/50 bg-transparent hover:border-orange-400/50 hover:text-orange-300 transition-all"
                                      >
                                        + Add yours
                                      </button>
                                    )}
                                  </div>

                                  {isOpen && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                      <input
                                        autoFocus
                                        type="text"
                                        value={inputVal}
                                        onChange={(e) => setCustomDishText((prev) => ({ ...prev, [section.label]: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") confirmCustom();
                                          if (e.key === "Escape") setCustomDishOpen((prev) => ({ ...prev, [section.label]: false }));
                                        }}
                                        placeholder={`Your ${section.label.toLowerCase().replace(/s$/, "")}…`}
                                        className="flex-1 px-3 py-1.5 bg-black text-white placeholder:text-white/30 border border-orange-400/40 rounded-full text-xs focus:outline-none focus:border-orange-400"
                                        maxLength={100}
                                      />
                                      <button onClick={confirmCustom} disabled={!inputVal.trim()} className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center disabled:opacity-40 transition-all active:scale-95">
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button onClick={() => setCustomDishOpen((prev) => ({ ...prev, [section.label]: false }))} className="w-7 h-7 rounded-full bg-white/10 text-white/60 flex items-center justify-center transition-all active:scale-95">
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Camping / Tailgating context input ── */}
                  {situation && situation !== "holiday" && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white">
                        Any specifics? (optional)
                      </label>
                      <textarea
                        value={chefNotes}
                        onChange={(e) => setChefNotes(e.target.value)}
                        placeholder={
                          situation === "camping"
                            ? "e.g., we have a campfire and a portable grill, no cooler, 3-day trip..."
                            : "e.g., tailgate before a football game, need finger foods for 20 people..."
                        }
                        className="w-full px-3 py-2 bg-black text-white placeholder:text-white/40 border border-orange-400/20 rounded-lg h-16 resize-none text-sm"
                        maxLength={300}
                      />
                    </div>
                  )}

                  {/* ── LAYER 4: Course Count ── */}
                  {situation && (
                    <div>
                      <label className="block text-sm font-medium mb-3 text-white">
                        How many courses?
                      </label>
                      <div className="flex w-full gap-3">
                        {COURSE_COUNTS.map((n) => (
                          <div key={n} className="flex flex-col items-center gap-1.5 flex-1">
                            <PillButton
                              active={totalCourses === n}
                              variant="amber"
                              onClick={() => setTotalCourses(n)}
                              disabled={isGenerating}
                              className="w-full py-3 text-base font-semibold"
                            >
                              {n}
                            </PillButton>
                            <span className="text-xs text-white/70">courses</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        {totalCourses === 3
                          ? "Appetizer · Main · Dessert"
                          : totalCourses === 4
                            ? "Appetizer · Main · Side · Dessert"
                            : "Appetizer · Main · 2 Sides · Dessert"}
                      </p>
                    </div>
                  )}

                  {/* ── Servings Stepper ── */}
                  {situation && (
                    <div>
                      <label className="block text-sm font-medium mb-3 text-white">
                        Serving size
                      </label>
                      <div className="flex items-center justify-center gap-6">
                        <PillButton
                          onClick={() => setServings((s) => Math.max(1, s - 1))}
                          disabled={isGenerating || servings <= 1}
                          className="w-16 py-3"
                        >
                          <Minus className="h-5 w-5" />
                        </PillButton>
                        <div className="flex flex-col items-center">
                          <span className="text-white font-bold text-3xl w-14 text-center tabular-nums">
                            {servings}
                          </span>
                          <span className="text-white/50 text-xs mt-0.5">
                            {servings === 1 ? "person" : "people"}
                          </span>
                        </div>
                        <PillButton
                          onClick={() => setServings((s) => Math.min(50, s + 1))}
                          disabled={isGenerating || servings >= 50}
                          className="w-16 py-3"
                        >
                          <Plus className="h-5 w-5" />
                        </PillButton>
                      </div>
                    </div>
                  )}

                  {/* ── Chef Notes (Holiday + always visible) ── */}
                  {situation && situation === "holiday" && selectedEvent && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white">
                        Add anything you'd like the chef to include or adjust
                      </label>
                      <textarea
                        value={chefNotes}
                        onChange={(e) => setChefNotes(e.target.value)}
                        placeholder="e.g., no nuts, extra spicy, low sodium, someone is lactose intolerant..."
                        className="w-full px-3 py-2 bg-black text-white placeholder:text-white/40 border border-orange-400/20 rounded-lg h-16 resize-none text-sm"
                        maxLength={300}
                      />
                      <p className="text-xs text-white/50 mt-1 text-right">
                        {chefNotes.length}/300
                      </p>
                    </div>
                  )}

                  {/* ── Safety Guards (same as CreateDishPage) ── */}
                  {situation && (
                    <>
                      <SafetyGuardBanner
                        alert={safetyAlert}
                        mealRequest={buildPreflightPrompt()}
                        onDismiss={clearSafetyAlert}
                        onOverrideSuccess={(token) =>
                          handleSafetyOverride(false, token)
                        }
                        className="mt-3"
                      />

                      <StarchGuardIntercept
                        alert={starchAlert}
                        onDecision={(decision) => {
                          if (decision === "order_something_else") {
                            clearStarchAlert();
                            setSelectedDishes([]);
                            setFamilySpecialty("");
                            setChefNotes("");
                            toast({
                              title: "Try different dishes",
                              description:
                                "Choose dishes without starches or let the chef substitute.",
                              duration: 4000,
                            });
                          } else if (decision === "let_chef_pick") {
                            setStarchDecision(decision);
                            handleGenerateExperience(true);
                          }
                        }}
                        className="mt-3"
                      />

                      <DietGuardIntercept
                        alert={dietAlert}
                        onDecision={(decision) => {
                          if (decision === "pick_something_else") {
                            clearDietAlert();
                            setGeneratedCourses([]);
                            setSelectedDishes([]);
                          } else if (decision === "let_chef_adapt") {
                            setDietDecision("let_chef_adapt");
                            handleGenerateExperience(true, true);
                          }
                        }}
                        className="mt-3"
                      />

                      <div className="mt-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                        <span className="text-xs text-white/60 block mb-2">
                          Meal Safety
                        </span>
                        <GlucoseGuardToggle disabled={isGenerating} />
                      </div>

                      <div className="mt-2 flex w-full gap-3">
                        <div className="flex flex-col items-center gap-1.5 flex-1">
                          <PillButton
                            active={flavorPersonal}
                            variant="amber"
                            onClick={() => !isGenerating && setFlavorPersonal(!flavorPersonal)}
                            disabled={isGenerating}
                            className="w-full py-3 text-base font-semibold"
                          >
                            {flavorPersonal ? "Personal" : "Neutral"}
                          </PillButton>
                          <span className="text-xs text-white/70">Flavor</span>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 flex-1">
                          <PillButton
                            active={keepItSimple}
                            onClick={() => !isGenerating && setKeepItSimple(!keepItSimple)}
                            disabled={isGenerating}
                            className="w-full py-3 text-base font-semibold"
                          >
                            {keepItSimple ? "Simple" : "Full"}
                          </PillButton>
                          <span className="text-xs text-white/70">Ingredients</span>
                        </div>
                      </div>
                    </>
                  )}

                  {isGenerating && (
                    <div className="flex flex-col items-center gap-3 mt-2">
                      <ThinkingDots
                        label={`Chef is crafting your ${totalCourses}-course experience…`}
                      />
                      <p className="text-xs text-white/40">
                        This takes a moment — each course is crafted individually
                      </p>
                    </div>
                  )}

                  {!isGenerating && situation && (
                    <GlassButton
                      onClick={() => handleGenerateExperience()}
                      disabled={
                        isGenerating ||
                        starchBlocked ||
                        !situation ||
                        (situation === "holiday" && !selectedEvent)
                      }
                      className="w-full bg-lime-600 hover:bg-lime-500 overflow-hidden text-ellipsis whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      <Star className="h-4 w-4" />
                      {generatedCourses.length > 0
                        ? "Generate New Experience"
                        : "Create My Experience"}
                    </GlassButton>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Results ── */}
          {generatedCourses.length > 0 && (
            <div className="mt-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">
                  Your {totalCourses}-Course{" "}
                  {selectedEvent
                    ? HOLIDAY_EVENTS.find((h) => h.id === selectedEvent)?.label
                    : situation === "camping"
                      ? "Camping"
                      : "Tailgating"}{" "}
                  Experience
                </h3>
              </div>

              {substitutedStarchTerms.length > 0 && (
                <StarchSubstitutionNotice
                  originalTerms={substitutedStarchTerms}
                  className="mb-4"
                />
              )}

              {generatedCourses.map((course, index) => (
                <div key={index}>
                  {/* Course label badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300 border border-amber-400/40 bg-amber-400/10 px-3 py-1 rounded-full">
                      {COURSE_EMOJI[course.courseType] || "🍽"}{" "}
                      {course.courseLabel}
                      {course.assignedDish && (
                        <span className="normal-case tracking-normal font-normal ml-1 text-amber-200/70">
                          — {course.assignedDish}
                        </span>
                      )}
                      {course.isFamilySpecialty && (
                        <span className="ml-1 text-amber-400">★ Family</span>
                      )}
                    </span>
                    {course._fallback && (
                      <span className="text-xs text-red-400 border border-red-400/30 bg-red-400/10 px-2 py-0.5 rounded-full">
                        Needs retry
                      </span>
                    )}
                  </div>

                  <Card className="bg-black/40 backdrop-blur-lg border border-orange-400/20 shadow-xl rounded-2xl">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <ChefHat className="h-6 w-6 text-orange-400" />
                          <h3 className="text-xl font-bold text-white">
                            {course.name}
                          </h3>
                          <FavoriteButton
                            title={course.name}
                            sourceType="create-dish"
                            mealData={course}
                          />
                        </div>
                        <button
                          onClick={() => {
                            setGeneratedCourses([]);
                            setGeneratedInSession(false);
                            clearExperienceCache();
                            setSubstitutedStarchTerms([]);
                            clearStarchAlert();
                          }}
                          className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-lg transition-colors active:scale-[0.98]"
                        >
                          Start Over
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <DietStyleBadge />
                        <MealClassificationPill
                          dietClassification={course.dietClassification ?? null}
                        />
                        {dietAdaptedNotice && (
                          <DietAdaptedNotice
                            diet={normalizeDiet(user?.dietaryRestrictions)}
                          />
                        )}
                        <KosherProTip
                          dietClassification={course.dietClassification ?? null}
                          isAdapted={!!dietAdaptedNotice}
                        />
                      </div>

                      <p className="text-white/90 mb-4">{course.description}</p>

                      <MealImageSlot
                        imageUrl={course.imageUrl}
                        mealName={course.name}
                        isLoading={!!loadingImages[course.id]}
                      />

                      <div className="mb-4 p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">Serving Size:</span>{" "}
                          {course.servingSize || `${servings} servings`}
                        </div>
                      </div>

                      <ServingInstructionsBlock
                        servings={servings}
                        mealName={course.name}
                        description={course.description}
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
                              (course.nutrition?.calories ||
                                course.calories ||
                                0) / servings,
                            )}{" "}
                            cal |{" "}
                            {Math.round(
                              (course.nutrition?.protein ||
                                course.protein ||
                                0) / servings,
                            )}
                            g protein |{" "}
                            {Math.round(
                              (course.nutrition?.carbs || course.carbs || 0) /
                                servings,
                            )}
                            g carbs |{" "}
                            {Math.round(
                              (course.nutrition?.fat || course.fat || 0) /
                                servings,
                            )}
                            g fat
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {course.nutrition?.calories || course.calories || 0}
                          </div>
                          <div className="text-xs text-white">Calories</div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {course.nutrition?.protein || course.protein || 0}g
                          </div>
                          <div className="text-xs text-white">Protein</div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {course.nutrition?.carbs || course.carbs || 0}g
                          </div>
                          <div className="text-xs text-white">Carbs</div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {course.nutrition?.fat || course.fat || 0}g
                          </div>
                          <div className="text-xs text-white">Fat</div>
                        </div>
                      </div>

                      {(() => {
                        const profile = getUserMedicalProfile(1);
                        const mealForBadges = {
                          name: course.name,
                          calories:
                            course.nutrition?.calories ?? course.calories ?? 0,
                          protein:
                            course.nutrition?.protein ?? course.protein ?? 0,
                          carbs: course.nutrition?.carbs ?? course.carbs ?? 0,
                          fat: course.nutrition?.fat ?? course.fat ?? 0,
                          ingredients: (course.ingredients ?? []).map(
                            (ing: any) => ({
                              name: ing.name ?? ing.item,
                              amount:
                                typeof ing.quantity === "number"
                                  ? ing.quantity
                                  : parseFloat(
                                      String(ing.quantity ?? ing.amount ?? "1"),
                                    ) || 1,
                              unit: (ing.unit ?? "serving")
                                .toString()
                                .toLowerCase(),
                            }),
                          ),
                        };

                        const medicalBadges =
                          (course as any).medicalBadges &&
                          (course as any).medicalBadges.length
                            ? (course as any).medicalBadges
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
                                ariaLabel="Remove this course"
                                title="Remove this course"
                                confirm={true}
                                confirmMessage="Remove this course?"
                                onClick={() => {
                                  setGeneratedCourses((prev) =>
                                    prev.filter((_, i) => i !== index),
                                  );
                                }}
                              />
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {course.ingredients && course.ingredients.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2 text-white">
                            Ingredients:
                          </h4>
                          <ul className="text-sm text-white/80 space-y-1">
                            {course.ingredients.map(
                              (ingredient: any, i: number) => {
                                const name =
                                  ingredient.item || ingredient.name;
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
                                      {amount} {unit} {name}
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
                        const steps = normalizeInstructions(
                          course.instructions,
                        );
                        if (steps.length === 0) return null;
                        const expanded = !!stepsExpanded[course.id];
                        const visibleSteps = expanded
                          ? steps
                          : steps.slice(0, 3);
                        return (
                          <div className="mb-4">
                            <h4 className="font-semibold mb-2 text-white">
                              Instructions:
                            </h4>
                            <div className="space-y-2">
                              {visibleSteps.map((step, stepIdx) => (
                                <div
                                  key={stepIdx}
                                  className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors select-none ${
                                    activeSteps[course.id] === stepIdx
                                      ? "bg-orange-500/20 border border-orange-500/40"
                                      : "hover:bg-white/5"
                                  }`}
                                  onClick={() =>
                                    setActiveSteps((prev) => ({
                                      ...prev,
                                      [course.id]:
                                        prev[course.id] === stepIdx
                                          ? null
                                          : stepIdx,
                                    }))
                                  }
                                >
                                  <div className="min-w-[26px] h-[26px] w-[26px] rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                    {stepIdx + 1}
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
                                    [course.id]: !expanded,
                                  }));
                                  if (expanded)
                                    setActiveSteps((prev) => ({
                                      ...prev,
                                      [course.id]: null,
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

                      {course.reasoning && (
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                            <Brain className="h-4 w-4" />
                            Why This Works For You:
                          </h4>
                          <p className="text-sm text-white/80">
                            {course.reasoning}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2 mb-3">
                        <GlassButton
                          onClick={() => {
                            const macros = getMealNutrition(course);
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
                              "/biometrics?from=my-perfect-gatherings&view=macros",
                            );
                          }}
                          className="w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white flex items-center justify-center border border-white/30"
                        >
                          Add to Macros
                        </GlassButton>

                        <div className="grid grid-cols-2 gap-2">
                          <AddToMealPlanButton meal={course} />
                          <TranslateToggle
                            content={{
                              name: course.name,
                              description: course.description,
                              instructions: course.instructions,
                              ingredients: course.ingredients,
                            }}
                            onTranslate={(translated) => {
                              setGeneratedCourses((prev) =>
                                prev.map((c, i) =>
                                  i === index
                                    ? {
                                        ...c,
                                        name: translated.name,
                                        description:
                                          translated.description ||
                                          c.description,
                                        instructions:
                                          typeof translated.instructions ===
                                          "string"
                                            ? translated.instructions
                                            : c.instructions,
                                        ingredients:
                                          (translated.ingredients as StructuredIngredient[]) ||
                                          c.ingredients,
                                      }
                                    : c,
                                ),
                              );
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <GlassButton
                            onClick={() => {
                              const mealData = {
                                id: course.id || crypto.randomUUID(),
                                name: course.name,
                                description: course.description,
                                ingredients: course.ingredients || [],
                                instructions: course.instructions,
                                imageUrl: course.imageUrl,
                              };
                              localStorage.setItem(
                                "mpm_chefs_kitchen_meal",
                                JSON.stringify(mealData),
                              );
                              localStorage.setItem(
                                "mpm_chefs_kitchen_external_prepare",
                                "true",
                              );
                              setLocation("/lifestyle/chefs-kitchen");
                            }}
                            className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                          >
                            Prepare with Chef
                          </GlassButton>
                          <ShareRecipeButton
                            recipe={{
                              name: course.name,
                              description: course.description,
                              nutrition: course.nutrition,
                              ingredients: (course.ingredients ?? []).map(
                                (ing: any) => ({
                                  name: ing.item || ing.name,
                                  amount: ing.amount || ing.quantity,
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
            </div>
          )}
        </div>

        {generatedCourses.length > 0 && generatedInSession && (
          <ShoppingAggregateBar
            ingredients={allIngredients}
            source="My Perfect Gatherings"
            hideShareButton={true}
            aboveBottomNav={true}
          />
        )}
      </motion.div>
    </PhaseGate>
  );
}
