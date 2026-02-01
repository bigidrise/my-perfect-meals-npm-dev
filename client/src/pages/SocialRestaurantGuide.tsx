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
  Plus,
  Navigation,
  Copy,
  CalendarPlus,
} from "lucide-react";
import { useLocation } from "wouter";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import {
  generateMedicalBadges,
  getUserMedicalProfile,
} from "@/utils/medicalPersonalization";
import PhaseGate from "@/components/PhaseGate";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { getLocation } from "@/lib/capacitorLocation";
import { setQuickView } from "@/lib/macrosQuickView";
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
import { ChefHat } from "lucide-react";

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
const CACHE_KEY = "restaurantGuide.cache.v1";

type CachedRestaurantState = {
  restaurantData: any;
  restaurant: string;
  craving?: string;
  cuisine: string;
  generatedAtISO: string;
};

function saveRestaurantCache(state: CachedRestaurantState) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {}
}

function loadRestaurantCache(): CachedRestaurantState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Minimal sanity checks
    if (
      !parsed?.restaurantData?.meals ||
      !Array.isArray(parsed.restaurantData.meals)
    )
      return null;
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
      // Speak the script for this step (skip entry since it's handled by mount effect)
      if (nextStep !== "entry") {
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
  const { toast } = useToast();

  // 🔋 Progress bar state (real-time ticker like HolidayFeast)
  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const hasSpokenEntryRef = useRef(false);

  // Guided step state (matches Macro Calculator pattern)
  const hasCachedResults =
    loadRestaurantCache()?.restaurantData?.meals?.length > 0;
  const [guidedStep, setGuidedStep] = useState<GuidedStep>(
    hasCachedResults ? "results" : "entry",
  );

  // Speak entry script on mount (if starting fresh)
  useEffect(() => {
    if (guidedStep === "entry" && !hasSpokenEntryRef.current) {
      hasSpokenEntryRef.current = true;
      const timer = setTimeout(() => {
        speak(RESTAURANT_GUIDE_ENTRY);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [guidedStep, speak]);

  // Auto-mark info as seen since Copilot provides guidance now
  useEffect(() => {
    if (!localStorage.getItem("hasSeenRestaurantInfo")) {
      localStorage.setItem("hasSeenRestaurantInfo", "true");
    }
  }, []);

  // Restore cached restaurant meals on mount (so generated meals come back)
  useEffect(() => {
    const cached = loadRestaurantCache();
    if (cached?.restaurantData?.meals?.length) {
      setGeneratedMeals(cached.restaurantData.meals);
      setRestaurantInput(cached.restaurant || "");
      setCravingInput(cached.craving || "");
      setMatchedCuisine(cached.cuisine || null);
      setGuidedStep("results");
      // Restore restaurant info if cached
      if (cached.restaurantData.restaurantInfo) {
        setRestaurantInfo(cached.restaurantData.restaurantInfo);
      }
    }
  }, []); // Only run once on mount

  // Auto-save whenever relevant state changes (so it's always fresh)
  useEffect(() => {
    if (generatedMeals.length > 0) {
      saveRestaurantCache({
        restaurantData: {
          meals: generatedMeals,
          restaurantInfo: restaurantInfo || undefined,
        },
        restaurant: restaurantInput,
        craving: cravingInput,
        cuisine: matchedCuisine || "",
        generatedAtISO: new Date().toISOString(),
      });
    }
  }, [
    generatedMeals,
    restaurantInput,
    cravingInput,
    matchedCuisine,
    restaurantInfo,
  ]);

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
        }),
      });
    },
    onMutate: () => {
      startProgressTicker();
    },
    onSuccess: (data) => {
      stopProgressTicker();
      setGeneratedMeals(data.recommendations || []);
      setGuidedStep("results");

      // Store restaurant info from Google Places
      if (data.restaurantInfo) {
        setRestaurantInfo(data.restaurantInfo);
      }

      // Immediately cache the new restaurant meals so they survive navigation/refresh
      saveRestaurantCache({
        restaurantData: {
          meals: data.recommendations || [],
          restaurantInfo: data.restaurantInfo,
        },
        restaurant: restaurantInput,
        craving: cravingInput,
        cuisine: matchedCuisine || "",
        generatedAtISO: new Date().toISOString(),
      });

      toast({
        title: "🍽️ Restaurant Meals Generated!",
        description: `Found ${data.recommendations?.length || 0} healthy options at ${data.restaurantInfo?.name || restaurantInput}.`,
      });

      // Emit search-complete event after successful generation
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
        title: "Generation Failed",
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
        title: "Missing Information",
        description: "Please enter both a food craving and a restaurant name.",
        variant: "destructive",
      });
      return;
    }

    if (!zipCode.trim() || !/^\d{5}$/.test(zipCode)) {
      toast({
        title: "Invalid ZIP Code",
        description: "Please enter a valid 5-digit ZIP code.",
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
          title: "Location Found",
          description: `ZIP Code: ${response.zipCode}`,
        });
      }
    } catch (error) {
      toast({
        title: "Location Access Denied",
        description: "Please enable location access or enter ZIP manually.",
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
        {/* iOS Safe Area Background Cover - prevents content showing through notch */}
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black"
          style={{ height: "env(safe-area-inset-top, 0px)" }}
        />

        {/* Universal Safe-Area Header */}
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
            {/* Back Button */}
            <button
              onClick={() => setLocation("/social-hub")}
              className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            {/* Title */}
            <h1 className="text-lg font-bold text-white truncate min-w-0">
              Restaurant Guide
            </h1>

            <div className="flex-grow" />
            <QuickTourButton
              onClick={quickTour.openTour}
              className="flex-shrink-0"
            />
          </div>
        </div>

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
                  Restaurant Guide
                </h2>
                <p className="text-white/70 mb-6">
                  Tell me where you're eating and what you're in the mood for,
                  and I'll show you the best options from their menu.
                </p>
                <Button
                  onClick={() => advanceGuided("step1")}
                  className="bg-lime-600 text-white px-8 py-3 text-lg font-semibold"
                >
                  Let's Find Dishes
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
                    <h3 className="text-lg font-semibold text-white">Step 1</h3>
                  </div>
                  <p className="text-white text-base">
                    What dish or type of food are you craving?
                  </p>
                  <div className="relative">
                    <Input
                      data-wt="rg-craving-input"
                      id="craving-input"
                      placeholder="e.g. chicken, salmon, pasta, steak"
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
                    Next
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
                    <h3 className="text-lg font-semibold text-white">Step 2</h3>
                  </div>
                  <p className="text-white text-base">
                    Where are you eating? Enter the restaurant name.
                  </p>
                  <div className="relative">
                    <Input
                      data-testid="restaurantguide-search"
                      data-wt="rg-restaurant-input"
                      id="restaurant-input"
                      placeholder="e.g. Cheesecake Factory, P.F. Chang's, Chipotle"
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
                      Back
                    </Button>
                    <Button
                      onClick={() => advanceGuided("step3")}
                      disabled={!restaurantInput.trim()}
                      className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-semibold"
                    >
                      Next
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
                    <h3 className="text-lg font-semibold text-white">Step 3</h3>
                  </div>
                  <p className="text-white text-base">
                    Enter your ZIP code so I can find the nearest location.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        data-testid="restaurantguide-zip"
                        id="zip-input"
                        placeholder="e.g. 30303, 90210, 10001"
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
                      Back
                    </Button>
                    <Button
                      onClick={handleSearch}
                      disabled={zipCode.length !== 5}
                      className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold"
                    >
                      Find Dishes
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
                    Finding Your Perfect Dishes...
                  </h3>
                  <p className="text-white/70 text-center">
                    Searching {restaurantInput} for {cravingInput} options
                  </p>
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">
                        AI Analysis Progress
                      </span>
                      <span className="text-sm text-white/80">
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <Progress
                      value={progress}
                      className="h-3 bg-black/30 border border-white/20"
                    />
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
                        🍽️ Recommended Meals at{" "}
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
                        className="text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
                        data-testid="button-create-new"
                      >
                        Search Again
                      </button>
                    </div>
                    {restaurantInfo?.address && (
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => openInMaps(restaurantInfo.address)}
                          className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
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
                              title: success ? "Address copied" : "Copy failed",
                              description: success
                                ? "Paste into Maps or Waze."
                                : "Please copy manually.",
                            });
                          }}
                          className="p-1 text-white/50 hover:text-white/80 transition-colors"
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
                    {generatedMeals.map((meal, index) => (
                      <Card
                        data-wt="rg-restaurant-card"
                        key={meal.id || index}
                        className="overflow-hidden shadow-lg hover:shadow-orange-500/50 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-black/40 backdrop-blur-lg border border-white/20"
                      >
                        <div className="grid md:grid-cols-3 gap-4">
                          {/* Meal Image */}
                          <div className="relative h-48 md:h-auto">
                            {meal.imageUrl ? (
                              <img
                                src={meal.imageUrl}
                                alt={meal.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-black/20 backdrop-blur-lg flex items-center justify-center">
                                <div className="text-4xl">🍽️</div>
                              </div>
                            )}
                          </div>

                          {/* Meal Details */}
                          <div className="md:col-span-2 p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex flex-col gap-1">
                                <h3 className="text-lg font-semibold text-white">
                                  {meal.name || meal.meal}
                                </h3>
                                {/* Starch Classification Badge */}
                                {(() => {
                                  const starchClass = classifyMeal({
                                    name: meal.name || meal.meal,
                                    ingredients: meal.ingredients || [],
                                  });
                                  return (
                                    <span
                                      className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit ${
                                        starchClass.isStarchMeal
                                          ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                          : "bg-green-500/20 text-green-300 border border-green-500/30"
                                      }`}
                                    >
                                      {starchClass.emoji} {starchClass.label}
                                    </span>
                                  );
                                })()}
                              </div>
                              <span className="text-sm text-white/90 bg-orange-600 px-2 py-1 rounded font-medium">
                                {meal.calories} cal
                              </span>
                            </div>

                            <p className="text-white/80 mb-3">
                              {meal.description || meal.reason}
                            </p>

                            {/* Medical Safety Badges */}
                            {(() => {
                              // Generate medical badges client-side like weekly meal calendar
                              const userProfile = getUserMedicalProfile(1);
                              const mealForBadges = {
                                name: meal.name || meal.meal,
                                calories: meal.calories,
                                protein: meal.protein,
                                carbs: meal.carbs,
                                fat: meal.fat,
                                ingredients:
                                  meal.ingredients?.map((ing: any) => ({
                                    name: ing,
                                    amount: 1,
                                    unit: "serving",
                                  })) || [],
                              };
                              const medicalBadges = generateMedicalBadges(
                                mealForBadges as any,
                                userProfile,
                              );
                              // Convert complex badge objects to simple strings for HealthBadgesPopover
                              const badgeStrings = medicalBadges.map(
                                (b: any) => b.badge || b.label || b.id,
                              );
                              return (
                                badgeStrings &&
                                badgeStrings.length > 0 && (
                                  <div className="mb-3">
                                    <div className="flex items-center gap-3">
                                      <HealthBadgesPopover
                                        badges={badgeStrings}
                                      />
                                      <h3 className="font-semibold text-white">
                                        Medical Safety
                                      </h3>
                                    </div>
                                  </div>
                                )
                              );
                            })()}

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
                                Why This is Healthy:
                              </h4>
                              <p className="text-green-200 text-sm">
                                {meal.reason}
                              </p>
                            </div>

                            {/* Modifications */}
                            <div className="bg-black/20 border border-white/10 rounded-lg p-3 backdrop-blur-sm mb-3">
                              <h4 className="font-medium text-orange-300 text-sm mb-1">
                                Ask For:
                              </h4>
                              <p className="text-orange-200 text-sm">
                                {meal.modifications || meal.orderInstructions}
                              </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2">
                              <Button
                                onClick={() => {
                                  setQuickView({
                                    protein: Math.round(meal.protein || 0),
                                    carbs: Math.round(meal.carbs || 0),
                                    fat: Math.round(meal.fat || 0),
                                    calories: Math.round(meal.calories || 0),
                                    dateISO: new Date()
                                      .toISOString()
                                      .slice(0, 10),
                                    mealSlot: "lunch",
                                  });
                                  setLocation(
                                    "/biometrics?from=restaurant-guide&view=macros",
                                  );
                                }}
                                className="w-full bg-black text-white font-medium"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Your Macros
                              </Button>

                              {/* Add to Meal Plan Button */}
                              <AddToMealPlanButton
                                meal={{
                                  id:
                                    meal.id ||
                                    `restaurant-${index}-${Date.now()}`,
                                  title: meal.name || meal.meal,
                                  name: meal.name || meal.meal,
                                  description: meal.description || meal.reason,
                                  imageUrl: meal.imageUrl,
                                  ingredients:
                                    meal.ingredients?.map((ing: string) => ({
                                      item: ing,
                                      amount: "1 serving",
                                    })) || [],
                                  instructions: meal.modifications
                                    ? [meal.modifications]
                                    : [],
                                  calories: meal.calories,
                                  protein: meal.protein,
                                  carbs: meal.carbs,
                                  fat: meal.fat,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Restaurant Guide"
          steps={RESTAURANT_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />
      </motion.div>
    </PhaseGate>
  );
}
