import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useChefFlowImages, chefFlowMealId } from "@/hooks/useChefFlowImages";
import { ChefFlowImage } from "@/components/ChefFlowImage";
import { motion } from "framer-motion";
import CometBar from "@/components/CometBar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  MapPin,
  Sparkles,
  ArrowLeft,
  Star,
  Loader2,
  Plus,
  Navigation,
  Copy,
  CalendarPlus,
  Globe,
} from "lucide-react";
import { useLocation } from "wouter";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeDiet, filterMealsByDiet } from "@/utils/dietaryFilter";
import DietBadge from "@/components/meal/DietBadge";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import {
  generateMedicalBadges,
  getUserMedicalProfile,
} from "@/utils/medicalPersonalization";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { getLocation } from "@/lib/capacitorLocation";
import { setQuickView } from "@/lib/macrosQuickView";
import { openInMaps, copyAddressToClipboard } from "@/utils/mapUtils";
import { classifyMeal } from "@/utils/starchMealClassifier";
import { getOrderInstructions } from "@/utils/restaurantOrderInstructions";
import { useChefVoice } from "@/lib/useChefVoice";
import {
  FIND_MY_MEAL_ENTRY,
  FIND_MY_MEAL_STEP1,
  FIND_MY_MEAL_STEP2,
  FIND_MY_MEAL_GENERATING,
} from "@/components/copilot/scripts/socialDiningScripts";
import { ChefHat } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { DietCuisineControlRow } from "@/components/ui/DietCuisineControlRow";

const DIET_PILL_CONFIG: Record<string, { label: string; color: string }> = {
  kosher:        { label: "Kosher Certified", color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  halal:         { label: "Halal Certified",  color: "bg-teal-500/20 border-teal-400/40 text-teal-300" },
  keto:          { label: "Keto (Verify Prep)",            color: "bg-purple-500/20 border-purple-400/40 text-purple-300" },
  vegan:         { label: "Vegan (Verify Prep)",           color: "bg-green-500/20 border-green-400/40 text-green-300" },
  vegetarian:    { label: "Vegetarian (Verify Prep)",      color: "bg-emerald-500/20 border-emerald-400/40 text-emerald-300" },
  pescatarian:   { label: "Pescatarian (Verify Prep)",     color: "bg-blue-500/20 border-blue-400/40 text-blue-300" },
  mediterranean: { label: "Mediterranean (Verify Prep)",   color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  paleo:         { label: "Paleo (Verify Prep)",           color: "bg-orange-500/20 border-orange-400/40 text-orange-300" },
  custom:        { label: "Custom Diet (Verify Prep)",     color: "bg-pink-500/20 border-pink-400/40 text-pink-300" },
};

const DIET_QUALIFIER_MAP: Record<string, string> = {
  kosher:        "Kosher-certified location",
  halal:         "Halal-certified location",
  keto:          "Low-carb, high-fat options available",
  vegan:         "Plant-forward options",
  vegetarian:    "Meat-free options available",
  pescatarian:   "Fish-based menu",
  mediterranean: "Olive oil, lean proteins & vegetables",
  paleo:         "Whole-food, grain-free options",
  "gluten-free": "Gluten-free friendly",
  custom:        "Filtered to your dietary preferences",
};

const DIET_SKIP = new Set(["no-restriction", "no_restriction", "none", ""]);

// Guided flow step type - step-by-step wizard
// entry → step1 (craving) → step2 (location) → step3 (budget) → generating → results
type GuidedStep = "entry" | "step1" | "step2" | "step3" | "generating" | "results";

// FIND_MEALS_TOUR_STEPS moved inside component as useMemo (i18n)

const CACHE_KEY = "mealFinder.cache.v5";

type CachedMealFinderState = {
  results: MealResult[];
  mealQuery: string;
  zipCode: string;
  generatedAtISO: string;
};

function saveMealFinderCache(state: CachedMealFinderState) {
  // Strip ONLY temporary/base64 imageUrls before saving to localStorage.
  // base64 data: URLs are ~1–2 MB each and blow the 5 MB localStorage quota.
  //
  // Permanent MPM-controlled URLs (/public-objects/, /images/, S3) are short
  // strings (~40–80 chars) and MUST be preserved so that Favorites can display
  // the image when the meal is saved after a page reload.
  //
  // Historical note: this function previously stripped ALL imageUrls because
  // the generator could return base64 data URLs. generateMealImageUnified()
  // now always ingests to permanent storage before returning, so the URL handed
  // to the client is always a short permanent path, never a base64 blob.
  const stripped: CachedMealFinderState = {
    ...state,
    results: state.results.map((r) => {
      const imageUrl = r.meal.imageUrl;
      // Keep permanent MPM URLs; drop base64 and temporary CDN URLs.
      const isTemporary = !imageUrl
        || imageUrl.startsWith('data:')
        || ['oaidalleapiprodscus', 'blob.core.windows.net', 'openai.com'].some(p => imageUrl.includes(p));
      return {
        ...r,
        meal: { ...r.meal, imageUrl: isTemporary ? undefined : imageUrl },
      };
    }),
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stripped));
  } catch (err: any) {
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      try {
        // Evict other mpm.* image cache keys and retry once
        const toEvict: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k !== CACHE_KEY && k.startsWith("mpm.")) toEvict.push(k);
        }
        toEvict.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(CACHE_KEY, JSON.stringify(stripped));
      } catch { /* quota still exceeded — cache lost for this session */ }
    }
  }
}

function loadMealFinderCache(): CachedMealFinderState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.results || !Array.isArray(parsed.results) || parsed.results.length === 0) return null;
    return parsed as CachedMealFinderState;
  } catch {
    return null;
  }
}

function clearMealFinderCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

interface MealResult {
  restaurantName: string;
  cuisine: string;
  address: string;
  rating?: number;
  priceLevel?: number;
  matchLabel?: 'Exact match' | 'Matches your diet' | 'Limited match';
  photoUrl?: string;
  meal: {
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    starchyCarbs?: number;
    fibrousCarbs?: number;
    fat: number;
    reason: string;
    modifications: string;
    ingredients: string[];
    medicalWaiterScript?: string;
    imageUrl?: string;
  };
  medicalBadges?: Array<{
    condition: string;
    compatible: boolean;
    reason: string;
    color: string;
  }>;
}

type PriceFilter = 'any' | 'budget' | 'mid' | 'upscale';

// PRICE_FILTER_OPTIONS moved inside component as useMemo (i18n)

function priceLevelBadge(level?: number): string | null {
  if (level === undefined || level === null) return null;
  if (level <= 1) return '$';
  if (level === 2) return '$$';
  return '$$$';
}

const MATCH_LABEL_CONFIG: Record<string, { color: string }> = {
  'Exact match':     { color: 'bg-green-500/20 border-green-400/40 text-green-300' },
  'Matches your diet': { color: 'bg-blue-500/20 border-blue-400/40 text-blue-300' },
  'Limited match':   { color: 'bg-amber-500/20 border-amber-400/40 text-amber-300' },
};

export default function MealFinder() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  usePageTitle(t("findMeals.pageTitle"));
  const { toast } = useToast();
  const { user } = useAuth();
  const quickTour = useQuickTour("social-find-meals");
  const { speak, stop } = useChefVoice();

  const FIND_MEALS_TOUR_STEPS = useMemo<TourStep[]>(() => [
    { title: t("findMeals.tourStep1Title"), description: t("findMeals.tourStep1Desc") },
    { title: t("findMeals.tourStep2Title"), description: t("findMeals.tourStep2Desc") },
    { title: t("findMeals.tourStep3Title"), description: t("findMeals.tourStep3Desc") },
  ], [t]);

  const PRICE_FILTER_OPTIONS = useMemo<{ key: PriceFilter; label: string; hint: string; range: number[] }[]>(() => [
    { key: 'any',     label: t("findMeals.priceAny"),     hint: t("findMeals.priceAnyHint"),    range: [] },
    { key: 'budget',  label: t("findMeals.priceBudget"),  hint: t("findMeals.priceBudgetHint"), range: [0, 1] },
    { key: 'mid',     label: t("findMeals.priceMid"),     hint: t("findMeals.priceMidHint"),    range: [2] },
    { key: 'upscale', label: t("findMeals.priceUpscale"), hint: t("findMeals.priceUpscaleHint"),range: [3, 4] },
  ], [t]);

  // Map of step to voice script - matches Macro Calculator pattern
  const stepScripts = useMemo<Record<GuidedStep, string>>(
    () => ({
      entry: FIND_MY_MEAL_ENTRY,
      step1: FIND_MY_MEAL_STEP1,
      step2: FIND_MY_MEAL_STEP2,
      generating: FIND_MY_MEAL_GENERATING,
      results: "",
    }),
    [],
  );

  // Helper to advance to next step with voice - matches Macro Calculator pattern
  const advanceGuided = useCallback(
    (nextStep: GuidedStep) => {
      stop(); // Stop any currently playing voice first
      setGuidedStep(nextStep);
      // Only speak during meal generation — all other steps are silent
      if (nextStep === "generating") {
        const script = stepScripts[nextStep];
        if (script) {
          speak(script);
        }
      }
      // Smooth scroll to top when advancing
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    },
    [speak, stop, stepScripts],
  );

  // Auto-mark info as seen since Copilot provides guidance now
  useEffect(() => {
    if (!localStorage.getItem("hasSeenMealFinderInfo")) {
      localStorage.setItem("hasSeenMealFinderInfo", "true");
    }
  }, []);

  const [mealQuery, setMealQuery] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('any');
  const [dietOverrideEnabled, setDietOverrideEnabled] = useState(false);
  const [dietOverrideValue, setDietOverrideValue] = useState("");
  const [cuisineOverrideEnabled, setCuisineOverrideEnabled] = useState(false);
  const [cuisineOverrideValue, setCuisineOverrideValue] = useState("");
  const [results, setResults] = useState<MealResult[]>([]);

  const chefFlowMeals = useMemo(
    () =>
      results.map((r) => ({
        // Prefix "fmr-" (find-meals-restaurant) isolates these IDs from the
        // beverage cache namespace (cfm-beverage-*) and other ChefFlow pages.
        id: `fmr-${r.restaurantName}-${r.meal.name}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 64),
        name: r.meal.name,
        imageUrl: r.meal.imageUrl,
      })),
    [results],
  );
  const { imageMap: chefFlowImages, failedSet: chefFlowFailed } = useChefFlowImages(chefFlowMeals, "restaurant");

  const [progress, setProgress] = useState(0);
  const [mealTranslations, setMealTranslations] = useState<Record<string, { lang: string; data: any }>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const hasRestoredRef = useRef(false);
  const hasSpokenEntryRef = useRef(false);

  // Guided step state (matches Macro Calculator pattern)
  const hasCachedResults = loadMealFinderCache() !== null;
  const [guidedStep, setGuidedStep] = useState<GuidedStep>(
    hasCachedResults ? "results" : "entry",
  );


  useEffect(() => {
    if (hasRestoredRef.current) return;

    const cached = loadMealFinderCache();
    if (cached) {
      setResults(cached.results);
      setMealQuery(cached.mealQuery);
      setZipCode(cached.zipCode);
      setGuidedStep("results");
      hasRestoredRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findMealsMutation = useMutation({
    mutationFn: async (data: { mealQuery: string; zipCode: string }) => {
      setProgress(60);
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + Math.random() * 10, 90));
      }, 800);

      try {
        const selectedPrice = PRICE_FILTER_OPTIONS.find((p) => p.key === priceFilter);
        const response = await apiRequest("/api/meal-finder", {
          method: "POST",
          body: JSON.stringify({
            ...data,
            dietaryRestrictions: dietOverrideEnabled && dietOverrideValue
              ? dietOverrideValue
              : normalizeDiet(user?.dietaryRestrictions),
            priceRange: selectedPrice && selectedPrice.range.length > 0 ? selectedPrice.range : undefined,
            ...(cuisineOverrideEnabled && cuisineOverrideValue ? { cuisineOverride: cuisineOverrideValue } : {}),
          }),
          headers: { "Content-Type": "application/json" },
        });

        clearInterval(progressInterval);
        setProgress(100);
        return response;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    },
    onSuccess: (data) => {
      const rawResults = data.results || [];
      // Dietary compliance: filter BEFORE render — never show non-compliant options
      const userDiet = normalizeDiet(user?.dietaryRestrictions);
      const newResults = filterMealsByDiet(userDiet, rawResults, (r) => r);
      setResults(newResults);

      if (newResults.length === 0) {
        // Return to search step so user can try again — don't strand them on a blank screen
        setGuidedStep("step2");
        const identityDiets = new Set(["kosher", "halal", "vegan", "vegetarian", "pescatarian"]);
        const isIdentityDiet = identityDiets.has(userDiet);
        const emptyDesc = rawResults.length > 0
          ? isIdentityDiet
            ? `No ${userDiet}-compliant meals were found nearby. Try searching for ${userDiet}-friendly cuisine or expanding your ZIP radius.`
            : `No results matched your ${userDiet} diet. Try a different craving.`
          : (data.message || "Nothing matched that search near your ZIP. Try a different craving or expand your search.");
        toast({
          title: t("findMeals.noMealsFound"),
          description: emptyDesc,
          variant: "destructive",
        });
      } else {
        setGuidedStep("results");

        saveMealFinderCache({
          results: newResults,
          mealQuery,
          zipCode,
          generatedAtISO: new Date().toISOString(),
        });

        const uniqueRestaurants = new Set(
          newResults.map((r: MealResult) => r.restaurantName),
        ).size;

        toast({
          title: t("findMeals.mealsFound"),
          description: t("findMeals.foundCount", { restaurants: uniqueRestaurants, meals: newResults.length }),
        });
      }

      // Emit search-complete event after successful search
      setTimeout(() => {
        const event = new CustomEvent("walkthrough:event", {
          detail: { testId: "findmeals-search-complete", event: "done" },
        });
        window.dispatchEvent(event);
      }, 500);

      setTimeout(() => setProgress(0), 500);
    },
    onError: (error: any) => {
      console.error("Meal finder error:", error);
      toast({
        title: t("findMeals.searchFailed"),
        description: error.message || t("findMeals.searchFailedDesc"),
        variant: "destructive",
      });
      setProgress(0);
    },
  });

  const handleSearch = () => {
    if (!mealQuery.trim()) {
      toast({
        title: t("findMeals.errorMissingMeal"),
        description: t("findMeals.errorMissingMealDesc"),
        variant: "destructive",
      });
      return;
    }

    if (!zipCode.trim() || !/^\d{5}$/.test(zipCode)) {
      toast({
        title: t("findMeals.errorInvalidZip"),
        description: t("findMeals.errorInvalidZipDesc"),
        variant: "destructive",
      });
      return;
    }

    setResults([]);
    clearMealFinderCache();
    advanceGuided("generating");
    findMealsMutation.mutate({ mealQuery, zipCode });
  };

  const handleUseLocation = async () => {
    setIsGettingLocation(true);

    try {
      const coords = await getLocation();

      const response = await apiRequest("/api/restaurants/reverse-geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: coords.latitude,
          lng: coords.longitude,
        }),
      });

      if (response.zipCode) {
        setZipCode(response.zipCode);
        toast({
          title: t("restaurant.locationFound"),
          description: t("findMeals.locationZip", { zip: response.zipCode }),
        });
      }
    } catch (error) {
      toast({
        title: t("restaurant.errorLocationDenied"),
        description: "Please enable location access or enter ZIP manually.",
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleGoBack = () => {
    setLocation("/social-hub");
  };

  return (
    <>
      <div className="min-h-screen pb-safe-nav" style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.44), rgba(0,0,0,0.40)), url('/images/find-meals-near-me-bg_2.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
        }}>
        {/* Universal Safe-Area Header */}
        <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 flex items-center gap-2 flex-nowrap overflow-hidden">
            {/* Back Button */}
            <button
              onClick={() => setLocation("/social-hub")}
              className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">{t("common.back")}</span>
            </button>

            {/* Title */}
            <h1 className="text-lg font-bold text-white truncate min-w-0">
              {t("findMeals.headerTitle")}
            </h1>

            <div className="flex-grow" />
          </div>
        </div>
        </MobileHeaderGuard>

        {/* Main Content */}
        <div
          className="max-w-4xl mx-auto px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          {isDesktop && (
            <button
              onClick={() => setLocation("/social-hub")}
              className="flex items-center gap-2 text-orange-400 hover:text-orange-300 mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">{t("findMeals.socialHub")}</span>
            </button>
          )}
          {/* ENTRY SCREEN - Guided Copilot Entry (matches Macro Calculator pattern) */}
          {guidedStep === "entry" && (
            <Card className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl mb-6">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-6">
                  <div className="bg-orange-500/20 p-4 rounded-full">
                    <ChefHat className="h-12 w-12 text-orange-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  {t("findMeals.entryTitle")}
                </h2>
                <p className="text-white/70 mb-6">
                  {t("findMeals.entryDesc")}
                </p>
                <Button
                  onClick={() => advanceGuided("step1")}
                  className="bg-lime-600 text-white px-8 py-3 text-lg font-semibold"
                >
                  {t("findMeals.letsFindMeals")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 1 - What are you craving? */}
          {guidedStep === "step1" && (
            <motion.div
              key="guided-step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-zinc-900/80 border border-white/30 text-white">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold text-white">{t("findMeals.step1")}</h3>
                  </div>
                  <p className="text-white text-base">
                    {t("findMeals.step1Question")}
                  </p>
                  <div className="relative">
                    <Input
                      placeholder={t("findMeals.step1Placeholder")}
                      value={mealQuery}
                      onChange={(e) => setMealQuery(e.target.value)}
                      className="w-full bg-black/40 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:bg-black/40 focus:text-white caret-white text-lg py-3"
                      autoComplete="off"
                      onKeyPress={(e) =>
                        e.key === "Enter" &&
                        mealQuery.trim() &&
                        advanceGuided("step2")
                      }
                      data-testid="findmeals-search"
                    />
                    {mealQuery && (
                      <button
                        onClick={() => setMealQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/80"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>
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
                  <Button
                    onClick={() => advanceGuided("step2")}
                    disabled={!mealQuery.trim()}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 text-lg font-semibold"
                  >
                    {t("common.next")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 2 - Your location */}
          {guidedStep === "step2" && (
            <motion.div
              key="guided-step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-zinc-900/80 border border-white/30 text-white">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold text-white">{t("findMeals.step2")}</h3>
                  </div>
                  <p className="text-white text-base">
                    {t("findMeals.step2Question")}
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder={t("findMeals.step2Placeholder")}
                        value={zipCode}
                        onChange={(e) =>
                          setZipCode(
                            e.target.value.replace(/\D/g, "").slice(0, 5),
                          )
                        }
                        className="w-full pr-10 bg-black/40 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 text-lg py-3"
                        maxLength={5}
                        onKeyPress={(e) =>
                          e.key === "Enter" &&
                          zipCode.length === 5 &&
                          handleSearch()
                        }
                        data-testid="input-zip-code"
                      />
                      {zipCode && (
                        <button
                          onClick={() => setZipCode("")}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/80"
                          type="button"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleUseLocation}
                      disabled={isGettingLocation}
                      className={`px-3 flex-shrink-0 text-white ${
                        isGettingLocation
                          ? "bg-blue-700 cursor-wait"
                          : "bg-blue-600 hover:bg-blue-500"
                      }`}
                    >
                      {isGettingLocation ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => advanceGuided("step1")}
                      className="
                        flex-1
                        bg-black/60
                        text-white
                        border
                        border-white/20
                        backdrop-blur-lg
                        font-medium
                        rounded-xl
                        transition-none
                      "
                    >
                      {t("common.back")}
                    </Button>
                    <Button
                      onClick={() => advanceGuided("step3")}
                      disabled={zipCode.length !== 5}
                      className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold"
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 3 - Budget / Price Range */}
          {guidedStep === "step3" && (
            <motion.div
              key="guided-step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-zinc-900/80 border border-white/30 text-white">
                <CardContent className="p-6 space-y-5">
                  <div>
                    <p className="text-white/60 text-sm uppercase tracking-wide font-medium mb-1">
                      {t("findMeals.step3")}
                    </p>
                    <h2 className="text-xl font-bold text-white">
                      {t("findMeals.step3Title")}
                    </h2>
                    <p className="text-white/60 text-sm mt-1">
                      {t("findMeals.step3Desc")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {PRICE_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setPriceFilter(opt.key)}
                        className={`
                          py-4 px-4 rounded-xl border text-sm font-semibold transition-all
                          ${
                            priceFilter === opt.key
                              ? "bg-lime-600/30 border-lime-400 text-lime-300"
                              : "bg-black/30 border-white/20 text-white/70 hover:border-white/40 hover:text-white"
                          }
                        `}
                      >
                        <span className="block font-bold">{opt.label}</span>
                        <span className="block text-xs font-normal opacity-70 mt-0.5">{opt.hint}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 pt-1">
                    <Button
                      onClick={() => advanceGuided("step2")}
                      className="
                        flex-1
                        bg-black/60
                        text-white
                        border
                        border-white/20
                        backdrop-blur-lg
                        font-medium
                        rounded-xl
                        transition-none
                      "
                    >
                      {t("common.back")}
                    </Button>
                    <Button
                      onClick={handleSearch}
                      className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold"
                      data-testid="button-find-meals"
                    >
                      {t("findMeals.findMealsBtn")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* GENERATING SCREEN - Shows during AI generation */}
          {guidedStep === "generating" && (
            <motion.div
              key="guided-generating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-zinc-900/80 border border-white/30 text-white">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-center mb-4">
                    <div className="bg-orange-500/20 p-4 rounded-full animate-pulse">
                      <ChefHat className="h-10 w-10 text-orange-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white text-center">
                    {t("findMeals.generatingTitle")}
                  </h3>
                  <p className="text-white/70 text-center">
                    {t("findMeals.generatingDesc", { query: mealQuery })}
                  </p>
                  <div className="mt-6 flex justify-center">
                    <CometBar label={t("findMeals.scanningNearby")} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* RESULTS SCREEN - Show results after generation */}
          {guidedStep === "results" && results.length > 0 && (
            <div className="space-y-6 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  🍽️ Found{" "}
                  {new Set(results.map((r: MealResult) => r.restaurantName)).size}{" "}
                  {new Set(results.map((r: MealResult) => r.restaurantName)).size === 1 ? "Restaurant" : "Restaurants"}
                </h2>
                <button
                  onClick={() => {
                    setResults([]);
                    clearMealFinderCache();
                    setMealQuery("");
                    setZipCode("");
                    setGuidedStep("entry");
                    hasSpokenEntryRef.current = false;
                  }}
                  className="text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
                  data-testid="button-create-new"
                >
                  Search Again
                </button>
              </div>

              {/* One card per meal — flat list, restaurant name on each card */}
              <div className="space-y-6">
                {results.map((result, index) => {
                  // Content-stable key — not index-based, so React doesn't
                  // reuse a mounted card when results shift positions.
                  const cardKey = `find-meals-${result.restaurantName}-${result.meal.name}`
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .slice(0, 80);
                          const translation = mealTranslations[cardKey];
                          const TRANSLATE_LANGUAGES = [
                            { code: "es", label: "Spanish" },
                            { code: "fr", label: "French" },
                            { code: "de", label: "German" },
                            { code: "it", label: "Italian" },
                            { code: "pt", label: "Portuguese" },
                            { code: "zh", label: "Chinese" },
                            { code: "ja", label: "Japanese" },
                            { code: "ko", label: "Korean" },
                            { code: "ar", label: "Arabic" },
                            { code: "hi", label: "Hindi" },
                            { code: "ru", label: "Russian" },
                            { code: "vi", label: "Vietnamese" },
                            { code: "tl", label: "Tagalog" },
                          ];
                  // Look up image by the result object itself — not by array
                  // index — so image assignment is stable across result shifts.
                  const mealImageKey = `fmr-${result.restaurantName}-${result.meal.name}`
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .slice(0, 64);
                  const mealImage = chefFlowImages[mealImageKey] || result.meal.imageUrl;

                  return (
                    <div key={cardKey} className="bg-black/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden shadow-lg" data-testid={`card-result-${index}`}>
                      {/* Restaurant info */}
                      <div className="px-4 pt-3 pb-2 border-b border-white/10 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            {result.matchLabel && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${MATCH_LABEL_CONFIG[result.matchLabel]?.color ?? 'bg-white/10 border-white/20 text-white/60'}`}>
                                {result.matchLabel}
                              </span>
                            )}
                            {priceLevelBadge(result.priceLevel) && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/70">
                                {priceLevelBadge(result.priceLevel)}
                              </span>
                            )}
                            <h3 className="font-bold text-white">{result.restaurantName}</h3>
                            <span className="text-xs text-white/50">{result.cuisine}</span>
                          </div>
                          <button
                            onClick={() => openInMaps(result.address)}
                            className="flex items-center gap-1 text-xs text-blue-400 underline"
                            aria-label="Open in Maps"
                          >
                            <Navigation className="h-3 w-3" />{result.address}
                          </button>
                        </div>
                        {result.rating && (
                          <div className="flex items-center gap-1 bg-orange-600 px-2 py-1 rounded flex-shrink-0">
                            <Star className="h-3 w-3 text-white fill-white" />
                            <span className="text-sm text-white font-medium">{result.rating}</span>
                          </div>
                        )}
                      </div>
                      {/* Meal content */}
                      <div className="grid md:grid-cols-3 gap-4">
                        {/* Meal Image */}
                              <div className="relative h-48 md:h-auto">
                                <ChefFlowImage
                                  src={mealImage}
                                  alt={result.meal.name}
                                />
                              </div>

                              <div className="md:col-span-2 p-4">
                                <div className="mb-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-xl font-bold text-white">{result.meal.name}</h4>
                                    <FavoriteButton
                                      title={result.meal.name}
                                      sourceType="find-meals"
                                      mealData={{
                                        name: result.meal.name,
                                        description: result.meal.description,
                                        calories: result.meal.calories,
                                        protein: result.meal.protein,
                                        carbs: result.meal.carbs,
                                        fat: result.meal.fat,
                                        ingredients: result.meal.ingredients,
                                        restaurantName: result.restaurantName,
                                        address: result.address,
                                        modifications: result.meal.modifications,
                                        imageUrl: result.meal.imageUrl,
                                      }}
                                      size={22}
                                    />
                                  </div>
                                  {/* Starch Classification Badge */}
                                  {(() => {
                                    const starchClass = classifyMeal({
                                      name: result.meal.name,
                                      ingredients: result.meal.ingredients || [],
                                    });
                                    return (
                                      <span
                                        className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit mb-2 ${
                                          starchClass.isStarchMeal
                                            ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                            : "bg-green-500/20 text-green-300 border border-green-500/30"
                                        }`}
                                      >
                                        {starchClass.emoji} {starchClass.label}
                                      </span>
                                    );
                                  })()}
                                  {/* Diet Style Pills */}
                                  {(() => {
                                    const restrictions: string[] = (user as any)?.dietaryRestrictions ?? [];
                                    const active = restrictions
                                      .map((r) => r.toLowerCase().trim())
                                      .filter((r) => !DIET_SKIP.has(r) && DIET_PILL_CONFIG[r]);
                                    if (active.length === 0) return null;
                                    const qualifierText = DIET_QUALIFIER_MAP[active[0]];
                                    return (
                                      <div className="flex flex-col gap-1 mb-2">
                                        <div className="flex flex-wrap gap-1">
                                          {active.map((key) => {
                                            const { label, color } = DIET_PILL_CONFIG[key];
                                            return (
                                              <span
                                                key={key}
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}
                                              >
                                                {label}
                                              </span>
                                            );
                                          })}
                                        </div>
                                        {qualifierText && (
                                          <p className="text-[11px] text-white/50 leading-tight">{qualifierText}</p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <p className="text-sm text-white/70">{result.meal.description}</p>
                                </div>

                                {/* Medical Safety Badges */}
                                {(() => {
                                  const userProfile = getUserMedicalProfile(1);
                                  const mealForBadges = {
                                    name: result.meal.name,
                                    calories: result.meal.calories,
                                    protein: result.meal.protein,
                                    carbs: result.meal.carbs,
                                    fat: result.meal.fat,
                                    ingredients: result.meal.ingredients?.map((ing: string) => ({
                                      name: ing,
                                      amount: 1,
                                      unit: "serving",
                                    })) || [],
                                  };
                                  const medicalBadges = generateMedicalBadges(mealForBadges as any, userProfile);
                                  const badgeStrings = medicalBadges.map((b: any) => b.badge || b.label || b.id);
                                  return badgeStrings && badgeStrings.length > 0 && (
                                    <div className="mb-3">
                                      <div className="flex items-center gap-3">
                                        <HealthBadgesPopover badges={badgeStrings} />
                                        <h3 className="font-semibold text-white">{t("findMeals.medicalSafety")}</h3>
                                      </div>
                                    </div>
                                  );
                                })()}

                                <div className="grid grid-cols-4 gap-2 mb-3">
                                  <div className="text-center bg-white/10 rounded p-2">
                                    <div className="text-lg font-bold text-blue-400">{result.meal.protein}g</div>
                                    <div className="text-white/60 text-xs">{t("findMeals.protein")}</div>
                                  </div>
                                  <div className="text-center bg-white/10 rounded p-2">
                                    <div className="text-lg font-bold text-orange-400">
                                      {result.meal.starchyCarbs != null ? `${result.meal.starchyCarbs}g` : "—"}
                                    </div>
                                    <div className="text-white/60 text-xs">{t("findMeals.starchy")}</div>
                                  </div>
                                  <div className="text-center bg-white/10 rounded p-2">
                                    <div className="text-lg font-bold text-green-400">
                                      {result.meal.fibrousCarbs != null ? `${result.meal.fibrousCarbs}g` : "—"}
                                    </div>
                                    <div className="text-white/60 text-xs">{t("findMeals.fibrous")}</div>
                                  </div>
                                  <div className="text-center bg-white/10 rounded p-2">
                                    <div className="text-lg font-bold text-yellow-400">{result.meal.fat}g</div>
                                    <div className="text-white/60 text-xs">{t("findMeals.fat")}</div>
                                  </div>
                                </div>

                                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 mb-3 backdrop-blur-sm">
                                  <h5 className="font-medium text-green-300 text-sm mb-1">{t("findMeals.whyHealthy")}</h5>
                                  <p className="text-green-200 text-sm">{result.meal.reason}</p>
                                </div>

                                <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3 backdrop-blur-sm mb-3">
                                  <h5 className="font-medium text-orange-300 text-sm mb-1">{t("findMeals.askFor")}</h5>
                                  <p className="text-orange-200 text-sm">{result.meal.modifications}</p>
                                </div>

                                {/* Order It Right */}
                                {(() => {
                                  const restrictions: string[] = (user as any)?.dietaryRestrictions ?? [];
                                  const primaryDiet = restrictions
                                    .map((r) => r.toLowerCase().trim())
                                    .find((r) => !DIET_SKIP.has(r));
                                  if (!primaryDiet) return null;
                                  const orderInstructions = getOrderInstructions(primaryDiet, result.meal.name || "");
                                  if (orderInstructions.length === 0) return null;
                                  return (
                                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 backdrop-blur-sm mb-3">
                                      <h5 className="font-medium text-blue-300 text-sm mb-1">Order It Right:</h5>
                                      <ul className="space-y-1">
                                        {orderInstructions.map((item, i) => (
                                          <li key={i} className="text-blue-200 text-sm flex items-start gap-1.5">
                                            <span className="mt-0.5 flex-shrink-0">•</span>
                                            <span>{item}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  );
                                })()}

                                {/* Tell Your Server */}
                                {result.meal.medicalWaiterScript && (
                                  <div className="bg-rose-500/20 border border-rose-500/30 rounded-lg p-3 backdrop-blur-sm mb-3">
                                    <h5 className="font-medium text-rose-300 text-sm mb-1.5 flex items-center gap-1.5">
                                      🏥 {t("findMeals.tellYourServer")}
                                    </h5>
                                    <p className="text-rose-200 text-sm italic">"{result.meal.medicalWaiterScript}"</p>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-2">
                                  <Button
                                    onClick={() => {
                                      setQuickView({
                                        protein: Math.round(result.meal.protein || 0),
                                        carbs: Math.round(result.meal.carbs || 0),
                                        starchyCarbs: result.meal.starchyCarbs != null ? Math.round(result.meal.starchyCarbs) : undefined,
                                        fibrousCarbs: result.meal.fibrousCarbs != null ? Math.round(result.meal.fibrousCarbs) : undefined,
                                        fat: Math.round(result.meal.fat || 0),
                                        calories: Math.round(result.meal.calories || 0),
                                        dateISO: new Date().toISOString().slice(0, 10),
                                        mealSlot: "lunch",
                                      });
                                      setLocation("/biometrics?from=find-meals&view=macros");
                                    }}
                                    className="w-full bg-black text-white font-medium"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t("findMeals.addMacros")}
                                  </Button>

                                  <AddToMealPlanButton
                                    meal={{
                                      id: `find-meals-${result.restaurantName}-${Date.now()}`,
                                      title: result.meal.name,
                                      name: result.meal.name,
                                      description: result.meal.description,
                                      imageUrl: result.meal.imageUrl,
                                      ingredients: result.meal.ingredients?.map((ing: string) => ({
                                        item: ing,
                                        amount: "1 serving",
                                      })) || [],
                                      instructions: result.meal.modifications ? [result.meal.modifications] : [],
                                      calories: result.meal.calories,
                                      protein: result.meal.protein,
                                      carbs: result.meal.carbs,
                                      fat: result.meal.fat,
                                    }}
                                  />

                                  {/* Translate */}
                                  <div className="mt-3 border-t border-white/10 pt-3">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <Globe className="h-3.5 w-3.5 text-white/50" />
                                      <span className="text-xs text-white/50 uppercase tracking-wide font-medium">Translate</span>
                                      {translation && (
                                        <button
                                          onClick={() => {
                                            setMealTranslations((prev) => {
                                              const next = { ...prev };
                                              delete next[cardKey];
                                              return next;
                                            });
                                          }}
                                          className="ml-auto text-white/40 text-xs"
                                        >
                                          {t("findMeals.clearTranslation")}
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {TRANSLATE_LANGUAGES.map((lang) => (
                                        <button
                                          key={lang.code}
                                          disabled={translatingId === cardKey}
                                          onClick={async () => {
                                            if (translation?.lang === lang.code) return;
                                            setTranslatingId(cardKey);
                                            try {
                                              const payload = {
                                                name: result.meal.name,
                                                description: result.meal.description,
                                                reason: result.meal.reason,
                                                modifications: result.meal.modifications,
                                                medicalWaiterScript: result.meal.medicalWaiterScript,
                                              };
                                              const translated = await apiRequest("/api/translate", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ content: payload, targetLanguage: lang.code }),
                                              });
                                              setMealTranslations((prev) => ({
                                                ...prev,
                                                [cardKey]: { lang: lang.code, data: translated },
                                              }));
                                            } catch {
                                              // silent — translate is non-critical
                                            } finally {
                                              setTranslatingId(null);
                                            }
                                          }}
                                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                            translation?.lang === lang.code
                                              ? "bg-orange-600 text-white"
                                              : "bg-white/10 text-white/80"
                                          }`}
                                        >
                                          {translatingId === cardKey ? (
                                            <Loader2 className="h-3 w-3 animate-spin inline" />
                                          ) : (
                                            lang.label
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                    {translation && (
                                      <div className="bg-black/30 border border-white/10 rounded-lg p-3 space-y-2">
                                        {translation.data.name && (
                                          <p className="text-white font-semibold text-sm">{translation.data.name}</p>
                                        )}
                                        {translation.data.description && (
                                          <p className="text-white/70 text-sm">{translation.data.description}</p>
                                        )}
                                        {translation.data.modifications && (
                                          <div>
                                            <span className="text-orange-300 text-xs font-medium">{t("findMeals.askFor")} </span>
                                            <span className="text-orange-200 text-sm">{translation.data.modifications}</span>
                                          </div>
                                        )}
                                        {translation.data.medicalWaiterScript && (
                                          <div>
                                            <span className="text-rose-300 text-xs font-medium">{t("findMeals.tellYourServer")}: </span>
                                            <span className="text-rose-200 text-sm italic">"{translation.data.medicalWaiterScript}"</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {guidedStep === "entry" && !findMealsMutation.isPending && results.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🍴</div>
              <p className="text-white text-lg mb-2">
                {t("findMeals.emptyTitle")}
              </p>
              <p className="text-sm text-white/60">
                {t("findMeals.emptyDesc")}
              </p>
            </div>
          )}
        </div>

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title={t("findMeals.tourTitle")}
          steps={FIND_MEALS_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />
      </div>
    </>
  );
}
