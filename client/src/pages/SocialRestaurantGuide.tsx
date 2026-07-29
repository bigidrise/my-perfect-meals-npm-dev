// 🔒🔒🔒 RESTAURANT GUIDE - GOOGLE PLACES UPGRADE (DECEMBER 11, 2025) 🔒🔒🔒
// STATUS: Upgraded with Google Places API integration
// UPGRADE: Added ZIP code input + real restaurant data (name, address, rating) from Google Places
//
// ⚠️ ZERO-TOLERANCE LOCKDOWN POLICY ⚠️
// DO NOT MODIFY ANY CODE IN THIS FILE WITHOUT EXPLICIT USER APPROVAL
//
// 🔒 PROTECTED SYSTEMS:
// - Google Places API integration for real restaurant verification
// - ZIP code to coordinates conversion
// - Real restaurant name, address, and rating display
// - AI restaurant meal generation with GPT integration
// - Animated "power bar" progress system
// - Medical compatibility badge system
// - DALL-E image generation for meal visualization
// - Persistent caching system (survives navigation/refresh)
// - Real-time progress ticker (0-90% with visual feedback)
// - Medical personalization with user health data integration
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useChefFlowImages, chefFlowMealId } from "@/hooks/useChefFlowImages";
import { ChefFlowImage } from "@/components/ChefFlowImage";
import { useAuth } from "@/contexts/AuthContext";
import CometBar from "@/components/CometBar";
import { normalizeDiet, filterMealsByDiet, mealMatchesDiet } from "@/utils/dietaryFilter";
import DietBadge from "@/components/meal/DietBadge";
import { motion } from "framer-motion";
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
  Home,
  Clock,
  Users,
  ArrowLeft,
  MapPin,
  Loader2,
  Navigation,
  Copy,
} from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import PhaseGate from "@/components/PhaseGate";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { getLocation } from "@/lib/capacitorLocation";
import { openInMaps, copyAddressToClipboard } from "@/utils/mapUtils";
import { classifyMeal } from "@/utils/starchMealClassifier";
import { useChefVoice } from "@/lib/useChefVoice";
import {
  RESTAURANT_GUIDE_ENTRY,
  RESTAURANT_GUIDE_STEP1,
  RESTAURANT_GUIDE_STEP2,
  RESTAURANT_GUIDE_STEP3,
  RESTAURANT_GUIDE_GENERATING,
} from "@/components/copilot/scripts/socialDiningScripts";
import { ChefHat, Globe, Loader2 as TranslateLoader } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

// Guided flow step type - step-by-step wizard
// entry → step1 (craving) → step2 (restaurant) → step3 (location) → generating → results
type GuidedStep =
  | "entry"
  | "step1"
  | "step2"
  | "step3"
  | "generating"
  | "results";

const RESTAURANT_TOUR_STEPS: TourStep[] = [
  {
    title: "Describe What You Want",
    description:
      "Enter what you’re craving or the type of food you want to eat.",
  },
  {
    title: "Enter Restaurant & ZIP",
    description: "Add the restaurant name and a nearby zip code.",
  },
  {
    title: "Get Smart Options",
    description:
      "View three goal-friendly meal options with simple tips on how to order them healthier.",
  },
];

// ---- Persist the generated restaurant meal so it never "disappears" ----
const CACHE_KEY = "restaurantGuide.cache.v2";

type CachedRestaurantState = {
  restaurantData: any;
  restaurant: string;
  craving?: string;
  cuisine: string;
  generatedAtISO: string;
};

function stripMealImages(meals: any[]): any[] {
  return (meals || []).map((m: any) => {
    const clean = { ...m, imageUrl: undefined };
    if (clean.meal && typeof clean.meal === "object") {
      clean.meal = { ...clean.meal, imageUrl: undefined };
    }
    return clean;
  });
}

function saveRestaurantCache(state: CachedRestaurantState) {
  // Strip imageUrl at every nesting level before saving.
  // base64 images are 1–2 MB each; 3 meals = ~5 MB which is the entire quota.
  // Images are re-fetched on mount via useChefFlowImages (hits server memCache fast).
  const stripped: CachedRestaurantState = {
    ...state,
    restaurantData: {
      ...state.restaurantData,
      meals: stripMealImages(state.restaurantData?.meals),
    },
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stripped));
  } catch (err: any) {
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      console.warn("[RestaurantGuide] localStorage quota exceeded — evicting stale cache keys and retrying");
      try {
        const keysToEvict: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k !== CACHE_KEY && (k.startsWith("restaurantGuide.") || k.startsWith("mpm."))) {
            keysToEvict.push(k);
          }
        }
        keysToEvict.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(CACHE_KEY, JSON.stringify(stripped));
      } catch (retryErr) {
        console.error("[RestaurantGuide] Could not persist session after eviction — cache lost:", retryErr);
      }
    } else {
      console.error("[RestaurantGuide] Unexpected localStorage error:", err);
    }
  }
}

function loadRestaurantCache(): CachedRestaurantState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Minimal sanity checks
    if (
      !parsed?.restaurantData?.meals ||
      !Array.isArray(parsed.restaurantData.meals) ||
      parsed.restaurantData.meals.length === 0
    )
      return null;
    // Shape corruption guard: if any meal has an object-typed imageUrl
    // (from the processMealImageForSave shape mismatch bug), discard the cache
    // so it gets replaced with a clean save on next generation.
    const hasCorruptImage = parsed.restaurantData.meals.some(
      (m: any) => m.imageUrl !== null && m.imageUrl !== undefined && typeof m.imageUrl !== "string"
    );
    if (hasCorruptImage) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed as CachedRestaurantState;
  } catch {
    return null;
  }
}

function clearRestaurantCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

function normalizeCachedMeals(meals: any[]): any[] {
  return meals.map((m) => {
    if (m && typeof m.meal === "object" && m.meal !== null) {
      return {
        id: m.id || String(Math.random()),
        name: m.meal.name || "",
        meal: m.meal.name || "",
        description: m.meal.description || "",
        calories: m.meal.calories || 0,
        protein: m.meal.protein || 0,
        carbs: m.meal.carbs || 0,
        fat: m.meal.fat || 0,
        imageUrl: m.meal.imageUrl || m.imageUrl || "",
        reason: m.meal.reason || m.meal.howToOrder || "",
        modifications: m.meal.howToOrder || (m.modificationNotes || []).join(". ") || "",
        askFor: m.meal.howToOrder || "",
        dietBadge: m.meal.dietBadge || "",
      };
    }
    return m;
  });
}

const DIET_PILL_CONFIG: Record<string, { label: string; color: string }> = {
  kosher:        { label: "Kosher (Verify Certification)", color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  halal:         { label: "Halal (Verify Certification)",  color: "bg-teal-500/20 border-teal-400/40 text-teal-300" },
  keto:          { label: "Keto (Verify Prep)",            color: "bg-purple-500/20 border-purple-400/40 text-purple-300" },
  vegan:         { label: "Vegan (Verify Prep)",           color: "bg-green-500/20 border-green-400/40 text-green-300" },
  vegetarian:    { label: "Vegetarian Friendly (Verify Prep)", color: "bg-emerald-500/20 border-emerald-400/40 text-emerald-300" },
  pescatarian:   { label: "Pescatarian (Verify Prep)",     color: "bg-blue-500/20 border-blue-400/40 text-blue-300" },
  mediterranean: { label: "Mediterranean (Verify Prep)",   color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  paleo:         { label: "Paleo (Verify Prep)",           color: "bg-orange-500/20 border-orange-400/40 text-orange-300" },
  custom:        { label: "Custom Diet (Verify Prep)",     color: "bg-pink-500/20 border-pink-400/40 text-pink-300" },
};

const DIET_QUALIFIER_MAP: Record<string, string> = {
  kosher:        "Confirm kosher certification with the restaurant",
  halal:         "Confirm halal certification with the restaurant",
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

const cuisineTips: Record<string, string[]> = {
  Mexican: [
    "Choose grilled meats over fried",
    "Ask for corn tortillas instead of flour",
    "Skip the chips or share them with the table",
    "Opt for beans and veggies as sides instead of rice",
  ],
  Italian: [
    "Choose red sauces over creamy ones",
    "Order grilled fish or chicken entrees",
    "Ask for dressing on the side with salads",
    "Limit the bread basket – or skip it",
  ],
  American: [
    "Look for grilled or baked options",
    "Ask to swap fries for a side salad",
    "Watch for added sauces and condiments",
    "Split large portions or take half to-go",
  ],
  Mediterranean: [
    "Opt for lean proteins like chicken, lamb, or fish",
    "Use olive oil sparingly",
    "Add hummus, tabbouleh, or grilled veggies",
    "Ask for half-rice or salad plates",
  ],
  Chinese: [
    "Choose steamed dishes over fried",
    "Ask for sauce on the side",
    "Opt for brown rice instead of white",
    "Load up on vegetables and lean proteins",
  ],
  Indian: [
    "Choose tandoori or grilled options",
    "Ask for less oil in curries",
    "Opt for dal (lentils) for protein",
    "Choose naan sparingly or skip it",
  ],
  Japanese: [
    "Go for sashimi or grilled fish over tempura",
    "Choose miso soup and edamame for starters",
    "Pick cucumber or avocado rolls over fried rolls",
    "Limit sauces like eel sauce or mayo-based toppings",
  ],
};

const cuisineKeywords: Record<string, string> = {
  // Fast Food American
  mcdonalds: "American",
  "mcdonald's": "American",
  "mc donald's": "American",
  burger: "American",
  king: "American",
  "burger king": "American",
  kfc: "American",
  popeyes: "American",
  "chick-fil-a": "American",
  chick: "American",
  fil: "American",
  wendys: "American",
  "wendy's": "American",
  subway: "American",
  grill: "American",
  bbq: "American",
  diner: "American",

  // Mexican
  taco: "Mexican",
  burrito: "Mexican",
  chipotle: "Mexican",
  "taco bell": "Mexican",
  bell: "Mexican",

  // Italian
  pizza: "Italian",
  pasta: "Italian",
  garden: "Italian",
  bistro: "Italian",
  olive: "Italian",
  "olive garden": "Italian",

  // Indian
  curry: "Indian",
  tandoori: "Indian",
  masala: "Indian",

  // Chinese
  panda: "Chinese",
  wok: "Chinese",
  express: "Chinese",
  "panda express": "Chinese",

  // Japanese
  sushi: "Japanese",
  hibachi: "Japanese",
  ramen: "Japanese",
  teriyaki: "Japanese",

  // Mediterranean
  pita: "Mediterranean",
  hummus: "Mediterranean",
  shawarma: "Mediterranean",
  gyro: "Mediterranean",
};

export default function RestaurantGuidePage() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const quickTour = useQuickTour("restaurant-guide");
  const { speak, stop } = useChefVoice();

  // Map of step to voice script - matches Macro Calculator pattern
  const stepScripts = useMemo<Record<GuidedStep, string>>(
    () => ({
      entry: RESTAURANT_GUIDE_ENTRY,
      step1: RESTAURANT_GUIDE_STEP1,
      step2: RESTAURANT_GUIDE_STEP2,
      step3: RESTAURANT_GUIDE_STEP3,
      generating: RESTAURANT_GUIDE_GENERATING,
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

  const [cravingInput, setCravingInput] = useState("");
  const [restaurantInput, setRestaurantInput] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [matchedCuisine, setMatchedCuisine] = useState<string | null>(null);
  const [generatedMeals, setGeneratedMeals] = useState<any[]>([]);
  const [restaurantInfo, setRestaurantInfo] = useState<{
    name: string;
    address: string;
    rating?: number;
    photoUrl?: string;
  } | null>(null);
  const [mealTranslations, setMealTranslations] = useState<Record<string, { lang: string; data: any }>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  const chefFlowMeals = useMemo(
    () => generatedMeals.map((m) => ({ id: m.id, name: m.name || m.meal, imageUrl: m.imageUrl })),
    [generatedMeals],
  );
  const { imageMap: chefFlowImages, failedSet: chefFlowFailed } = useChefFlowImages(chefFlowMeals, "restaurant");

  const { toast } = useToast();
  const { user } = useAuth();

  // 🔋 Progress bar state (real-time ticker like HolidayFeast)
  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const hasSpokenEntryRef = useRef(false);
  const serverRestoredRef = useRef(false);

  // Guided step state — start on results if localStorage has data (fast initial render)
  const hasCachedResults =
    loadRestaurantCache()?.restaurantData?.meals?.length > 0;
  const [guidedStep, setGuidedStep] = useState<GuidedStep>(
    hasCachedResults ? "results" : "entry",
  );

  // Server-first hydration: fetch the most recent session from DB
  const storedUserId = localStorage.getItem("userId") || "";
  const { data: serverSessionData } = useQuery<{ session: any }>({
    queryKey: ["/api/restaurants/latest-session", storedUserId],
    queryFn: () =>
      apiRequest(`/api/restaurants/latest-session?userId=${storedUserId}`),
    enabled: !!storedUserId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Auto-mark info as seen since Copilot provides guidance now
  useEffect(() => {
    if (!localStorage.getItem("hasSeenRestaurantInfo")) {
      localStorage.setItem("hasSeenRestaurantInfo", "true");
    }
  }, []);

  // Effect 1: Immediate localStorage restore (fast, no flash while server loads)
  useEffect(() => {
    const cached = loadRestaurantCache();
    if (cached?.restaurantData?.meals?.length) {
      setGeneratedMeals(normalizeCachedMeals(cached.restaurantData.meals));
      setRestaurantInput(cached.restaurant || "");
      setCravingInput(cached.craving || "");
      setMatchedCuisine(cached.cuisine || null);
      setGuidedStep("results");
      if (cached.restaurantData.restaurantInfo) {
        setRestaurantInfo(cached.restaurantData.restaurantInfo);
      }
    }
  }, []);

  // Effect 2: Server data overrides localStorage — permanent image URLs + authoritative source
  useEffect(() => {
    const session = serverSessionData?.session;
    if (!session?.meals?.length) return;
    serverRestoredRef.current = true;
    const userDiet = normalizeDiet(user?.dietaryRestrictions);
    const normalized = normalizeCachedMeals(session.meals as any[]);
    const meals = filterMealsByDiet(userDiet, normalized, (m) => m);
    setGeneratedMeals(meals.length > 0 ? meals : normalized);
    setRestaurantInput(session.restaurantName || "");
    setCravingInput(session.craving || "");
    setMatchedCuisine(session.cuisine || null);
    setGuidedStep("results");
    if (session.restaurantInfo) {
      setRestaurantInfo(session.restaurantInfo as any);
    }
    saveRestaurantCache({
      restaurantData: { meals: session.meals, restaurantInfo: session.restaurantInfo },
      restaurant: session.restaurantName || "",
      craving: session.craving || "",
      cuisine: session.cuisine || "",
      generatedAtISO: session.generatedAt || new Date().toISOString(),
    });
  }, [serverSessionData]);

  const startProgressTicker = () => {
    if (tickerRef.current) return;
    setProgress(0); // Reset progress
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
    setProgress(100); // Complete progress
  };

  // Restaurant meal generation mutation
  const generateMealsMutation = useMutation({
    mutationFn: async (params: {
      restaurantName: string;
      craving: string;
      cuisine: string;
      zipCode: string;
    }) => {
      return apiRequest("/api/restaurants/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantName: params.restaurantName,
          craving: params.craving,
          cuisine: params.cuisine,
          zipCode: params.zipCode,
          userId: localStorage.getItem("userId") || "1",
          dietaryRestrictions: normalizeDiet(user?.dietaryRestrictions),
        }),
      });
    },
    onMutate: () => {
      startProgressTicker();
    },
    onSuccess: (data) => {
      stopProgressTicker();
      const userDiet = normalizeDiet(user?.dietaryRestrictions);
      const rawRecs = data.recommendations || [];
      const compliantRecs = filterMealsByDiet(userDiet, rawRecs, (r) => r);
      if (compliantRecs.length === 0) {
        const identityDiets = new Set(["kosher", "halal", "vegan", "vegetarian", "pescatarian"]);
        const isIdentityDiet = identityDiets.has(userDiet);
        const emptyDesc = rawRecs.length > 0
          ? isIdentityDiet
            ? `No ${userDiet}-compliant options were found at this restaurant. Try a different location.`
            : `No recommendations matched your ${userDiet} diet. Try a different restaurant or craving.`
          : "No recommendations were generated. Please try again.";
        toast({ title: t("restaurant.errorNoMatch"), description: emptyDesc, variant: "destructive" });
        return;
      }
      setGeneratedMeals(compliantRecs);
      setGuidedStep("results");
      if (data.restaurantInfo) setRestaurantInfo(data.restaurantInfo);
      saveRestaurantCache({
        restaurantData: { meals: compliantRecs, restaurantInfo: data.restaurantInfo },
        restaurant: restaurantInput,
        craving: cravingInput,
        cuisine: matchedCuisine || "",
        generatedAtISO: new Date().toISOString(),
      });
      toast({
        title: t("restaurant.pageTitle"),
        description: `Found ${compliantRecs.length} healthy options at ${data.restaurantInfo?.name || restaurantInput}.`,
      });
      setTimeout(() => {
        const event = new CustomEvent("walkthrough:event", {
          detail: { testId: "restaurantguide-search-complete", event: "done" },
        });
        window.dispatchEvent(event);
      }, 500);
    },
    onError: (error: Error) => {
      stopProgressTicker();
      toast({
        title: t("restaurant.generationFailed"),
        description:
          error.name === "AbortError"
            ? "Request timed out. Please try again."
            : error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!cravingInput.trim() || !restaurantInput.trim()) {
      toast({
        title: t("restaurant.errorMissing"),
        description: t("restaurant.errorMissingDesc"),
        variant: "destructive",
      });
      return;
    }

    if (!zipCode.trim() || !/^\d{5}$/.test(zipCode)) {
      toast({
        title: t("restaurant.errorZip"),
        description: t("restaurant.errorZipDesc"),
        variant: "destructive",
      });
      return;
    }

    const lowerInput = restaurantInput.toLowerCase();

    const keywordMatch = Object.keys(cuisineKeywords).find((keyword) =>
      lowerInput.includes(keyword),
    );

    const match = keywordMatch
      ? cuisineKeywords[keywordMatch]
      : Object.keys(cuisineTips).find((cuisine) =>
          lowerInput.includes(cuisine.toLowerCase()),
        );

    setMatchedCuisine(match || null);
    setRestaurantInfo(null);
    advanceGuided("generating");

    // Generate meals with craving, restaurant, and ZIP code
    generateMealsMutation.mutate({
      restaurantName: restaurantInput,
      craving: cravingInput,
      cuisine: match || "American",
      zipCode: zipCode,
    });
  };

  const handleUseLocation = async () => {
    setIsGettingLocation(true);

    let coords: { latitude: number; longitude: number } | null = null;

    try {
      coords = await getLocation();
    } catch {
      toast({
        title: "Location Access Denied",
        description: "Please enable location access in your browser settings, or enter your ZIP manually.",
        variant: "destructive",
      });
      setIsGettingLocation(false);
      return;
    }

    try {
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
          title: "Location Found",
          description: `ZIP Code: ${response.zipCode}`,
        });
      }
    } catch {
      toast({
        title: "Could Not Detect ZIP Code",
        description: "Location was found but we couldn't determine your ZIP. Please enter it manually.",
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  return (
    <PhaseGate phase="PHASE_1_CORE" feature="restaurant-guide">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
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
              {t("restaurant.pageTitle")}
            </h1>

            <div className="flex-grow" />
          </div>
        </div>
        </MobileHeaderGuard>

        {/* Main Content */}
        <div
          className="max-w-4xl mx-auto px-4 sm:px-6 overflow-x-hidden pb-8"
          style={{ paddingTop: "6rem" }}
        >
          {/* ENTRY SCREEN - Guided Copilot Entry (matches Macro Calculator pattern) */}
          {guidedStep === "entry" && (
            <Card className="bg-black/40 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl mb-6">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-6">
                  <div className="bg-orange-500/20 p-4 rounded-full">
                    <ChefHat className="h-12 w-12 text-orange-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  {t("restaurant.entryTitle")}
                </h2>
                <p className="text-white/70 mb-6">
                  {t("restaurant.entryDesc")}
                </p>
                <Button
                  onClick={() => advanceGuided("step1")}
                  className="bg-lime-600 text-white px-8 py-3 text-lg font-semibold"
                >
                  {t("restaurant.letsFindDishes")}
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
                    <h3 className="text-lg font-semibold text-white">{t("restaurant.step1")}</h3>
                  </div>
                  <p className="text-white text-base">
                    {t("restaurant.step1Question")}
                  </p>
                  <div className="relative">
                    <Input
                      data-wt="rg-craving-input"
                      id="craving-input"
                      placeholder={t("restaurant.step1Placeholder")}
                      value={cravingInput}
                      onChange={(e) => setCravingInput(e.target.value)}
                      className="w-full pr-10 bg-black/40 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:bg-black/40 focus:text-white caret-white text-lg py-3"
                      autoComplete="off"
                      onKeyPress={(e) =>
                        e.key === "Enter" &&
                        cravingInput.trim() &&
                        advanceGuided("step2")
                      }
                    />
                    {cravingInput && (
                      <button
                        onClick={() => setCravingInput("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/80"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <Button
                    onClick={() => advanceGuided("step2")}
                    disabled={!cravingInput.trim()}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 text-lg font-semibold"
                  >
                    {t("common.next")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 2 - Where are you eating? */}
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
                    <h3 className="text-lg font-semibold text-white">{t("restaurant.step2")}</h3>
                  </div>
                  <p className="text-white text-base">
                    {t("restaurant.step2Question")}
                  </p>
                  <div className="relative">
                    <Input
                      data-testid="restaurantguide-search"
                      data-wt="rg-restaurant-input"
                      id="restaurant-input"
                      placeholder={t("restaurant.step2Placeholder")}
                      value={restaurantInput}
                      onChange={(e) => setRestaurantInput(e.target.value)}
                      className="w-full pr-10 bg-black/40 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:bg-black/40 focus:text-white caret-white text-lg py-3"
                      autoComplete="off"
                      onKeyPress={(e) =>
                        e.key === "Enter" &&
                        restaurantInput.trim() &&
                        advanceGuided("step3")
                      }
                    />
                    {restaurantInput && (
                      <button
                        onClick={() => setRestaurantInput("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/80"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => advanceGuided("step1")}
                      variant="outline"
                      className="
                        flex-1
                        bg-black/60
                        text-white
                        border
                        border-white/20
                        backdrop-blur-lg
                        font-medium
                        rounded-xl
                        transition-none"
                    >
                      {t("common.back")}
                    </Button>
                    <Button
                      onClick={() => advanceGuided("step3")}
                      disabled={!restaurantInput.trim()}
                      className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-semibold"
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 3 - Your location */}
          {guidedStep === "step3" && (
            <motion.div
              key="guided-step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-zinc-900/80 border border-white/30 text-white">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold text-white">{t("restaurant.step3")}</h3>
                  </div>
                  <p className="text-white text-base">
                    {t("restaurant.step3Question")}
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        data-testid="restaurantguide-zip"
                        id="zip-input"
                        placeholder={t("restaurant.step3Placeholder")}
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
                      onClick={() => advanceGuided("step2")}
                      variant="outline"
                      className="
                        flex-1
                        bg-black/60
                        text-white
                        border
                        border-white/20
                        backdrop-blur-lg
                        font-medium
                        rounded-xl
                        transition-none"
                    >
                      {t("common.back")}
                    </Button>
                    <Button
                      onClick={handleSearch}
                      disabled={zipCode.length !== 5}
                      className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold"
                    >
                      {t("restaurant.findDishes")}
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
                    {t("restaurant.findingDishes")}
                  </h3>
                  <p className="text-white/70 text-center">
                    {t("restaurant.searchingFor", { restaurant: restaurantInput, craving: cravingInput })}
                  </p>
                  <div className="mt-6 flex justify-center">
                    <CometBar label={t("restaurant.scanningMenu")} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* RESULTS SCREEN - Generated Meals Section */}
          {guidedStep === "results" && generatedMeals.length > 0 && (
            <Card className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl">
              <CardContent className="p-6">
                <div data-wt="rg-results-list" className="space-y-6 mb-6">
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white">
                        🍽️ {t("restaurant.recommendedAt")}{" "}
                        {restaurantInfo?.name ||
                          restaurantInput
                            .split(" ")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase(),
                            )
                            .join(" ")}
                      </h2>
                      <button
                        onClick={() => {
                          setGeneratedMeals([]);
                          clearRestaurantCache();
                          setRestaurantInput("");
                          setCravingInput("");
                          setZipCode("");
                          setGuidedStep("entry");
                          hasSpokenEntryRef.current = false;
                        }}
                        className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-lg"
                        data-testid="button-create-new"
                      >
                        {t("restaurant.searchAgain")}
                      </button>
                    </div>
                    {restaurantInfo?.address && (
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => openInMaps(restaurantInfo.address)}
                          className="flex items-center gap-1 text-sm text-blue-400 transition-colors"
                          aria-label="Open in Maps"
                        >
                          <Navigation className="h-3 w-3" />
                          <span className="underline">
                            {restaurantInfo.address}
                          </span>
                        </button>
                        <button
                          onClick={async () => {
                            const success = await copyAddressToClipboard(
                              restaurantInfo.address,
                            );
                            toast({
                              title: success ? t("restaurant.addressCopied") : t("restaurant.copyFailed"),
                              description: success
                                ? t("restaurant.pasteHint")
                                : t("restaurant.copyManually"),
                            });
                          }}
                          className="p-1 text-white/50 transition-colors"
                          aria-label="Copy address"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {restaurantInfo.rating && (
                          <span className="text-sm text-white/70 ml-1">
                            ⭐ {restaurantInfo.rating}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4">
                    {generatedMeals.map((meal, index) => {
                      const mealKey = meal.id || `meal-${index}`;
                      const translation = mealTranslations[mealKey];
                      const displayMeal = translation ? translation.data : meal;
                      const imageKey = chefFlowMealId(meal, "restaurant");
                      const mealImage = chefFlowImages[imageKey] || meal.imageUrl;
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
                      return (
                        <Card
                          data-wt="rg-restaurant-card"
                          key={mealKey}
                          className="overflow-hidden shadow-lg hover:shadow-orange-500/50 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-black/40 backdrop-blur-lg border border-white/20"
                        >
                          <div className="md:grid md:grid-cols-3">
                            {mealImage && (
                              <div className="relative h-48 md:h-full">
                                <ChefFlowImage
                                  src={mealImage}
                                  alt={displayMeal.name || displayMeal.meal || "Meal"}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className={`p-4 ${mealImage ? "md:col-span-2" : "md:col-span-3"}`}>
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-lg font-semibold text-white">
                                  {displayMeal.name || displayMeal.meal}
                                </h3>
                                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                  <span className="text-sm text-white/90 bg-orange-600 px-2 py-1 rounded font-medium">
                                    {meal.calories} cal
                                  </span>
                                  <FavoriteButton
                                    title={meal.name || meal.meal || ""}
                                    sourceType="restaurant"
                                    mealData={{
                                      id: mealKey,
                                      name: meal.name || meal.meal,
                                      calories: meal.calories,
                                      protein: meal.protein,
                                      carbs: meal.carbs,
                                      fat: meal.fat,
                                      description: meal.description || meal.reason,
                                      ingredients: meal.ingredients || [],
                                    }}
                                  />
                                </div>
                              </div>

                              <p className="text-white/80 mb-3">
                                {displayMeal.description || displayMeal.reason}
                              </p>

                              {/* Nutrition Info */}
                              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                                <div className="text-center">
                                  <div className="font-semibold text-blue-400">
                                    {meal.protein}g
                                  </div>
                                  <div className="text-white/60">Protein</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-semibold text-green-400">
                                    {meal.carbs}g
                                  </div>
                                  <div className="text-white/60">Carbs</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-semibold text-yellow-400">
                                    {meal.fat}g
                                  </div>
                                  <div className="text-white/60">Fat</div>
                                </div>
                              </div>

                              {/* Why It's Healthy */}
                              <div className="bg-black/20 border border-white/10 rounded-lg p-3 mb-3 backdrop-blur-sm">
                                <h4 className="font-medium text-green-300 text-sm mb-1">
                                  {t("restaurant.whyHealthy")}
                                </h4>
                                <p className="text-green-200 text-sm">
                                  {displayMeal.reason}
                                </p>
                              </div>

                              {/* Ask For (Modifications) */}
                              <div className="bg-black/20 border border-white/10 rounded-lg p-3 mb-3 backdrop-blur-sm">
                                <h4 className="font-medium text-orange-300 text-sm mb-1">
                                  {t("restaurant.askFor")}
                                </h4>
                                <p className="text-orange-200 text-sm">
                                  {displayMeal.modifications || displayMeal.orderInstructions}
                                </p>
                              </div>

                              {/* Translate */}
                              <div className="mt-2">
                                <details className="group">
                                  <summary className="flex items-center gap-1.5 text-sm text-white/60 cursor-pointer list-none">
                                    <Globe className="h-3.5 w-3.5" />
                                    <span>
                                      {translation
                                        ? `Translated to ${TRANSLATE_LANGUAGES.find((l) => l.code === translation.lang)?.label || translation.lang}`
                                        : "Translate"}
                                    </span>
                                    {translation && (
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setMealTranslations((prev) => {
                                            const next = { ...prev };
                                            delete next[mealKey];
                                            return next;
                                          });
                                        }}
                                        className="ml-1 text-white/40 text-xs"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </summary>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {TRANSLATE_LANGUAGES.map((lang) => (
                                      <button
                                        key={lang.code}
                                        disabled={translatingId === mealKey}
                                        onClick={async () => {
                                          if (translation?.lang === lang.code) return;
                                          setTranslatingId(mealKey);
                                          try {
                                            const payload = {
                                              name: meal.name || meal.meal,
                                              description: meal.description || meal.reason,
                                              reason: meal.reason,
                                              modifications: meal.modifications || meal.orderInstructions,
                                            };
                                            const result = await apiRequest("/api/translate", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ content: payload, targetLanguage: lang.code }),
                                            });
                                            setMealTranslations((prev) => ({
                                              ...prev,
                                              [mealKey]: { lang: lang.code, data: { ...meal, ...result } },
                                            }));
                                          } catch {
                                            toast({ title: t("restaurant.translationFailed"), description: "Please try again.", variant: "destructive" });
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
                                        {translatingId === mealKey ? (
                                          <TranslateLoader className="h-3 w-3 animate-spin inline" />
                                        ) : (
                                          lang.label
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Restaurant Assistant"
          steps={RESTAURANT_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />
      </motion.div>
    </PhaseGate>
  );
}
