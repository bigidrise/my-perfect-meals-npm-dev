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
  MapPin,
  Sparkles,
  ArrowLeft,
  Star,
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
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { getLocation } from "@/lib/capacitorLocation";
import { setQuickView } from "@/lib/macrosQuickView";
import { openInMaps, copyAddressToClipboard } from "@/utils/mapUtils";
import { classifyMeal } from "@/utils/starchMealClassifier";
import { useChefVoice } from "@/lib/useChefVoice";
import {
  FIND_MY_MEAL_ENTRY,
  FIND_MY_MEAL_STEP1,
  FIND_MY_MEAL_STEP2,
  FIND_MY_MEAL_GENERATING,
} from "@/components/copilot/scripts/socialDiningScripts";
import { ChefHat } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";

// Guided flow step type - step-by-step wizard
// entry → step1 (craving) → step2 (location) → generating → results
type GuidedStep = "entry" | "step1" | "step2" | "generating" | "results";

const FIND_MEALS_TOUR_STEPS: TourStep[] = [
  {
    title: "Enter Your Craving",
    description: "Tell us what you're in the mood for.",
  },
  {
    title: "Add Your ZIP Code",
    description: "Enter your location so we can find nearby restaurants.",
  },
  {
    title: "Get Recommendations",
    description:
      "See nearby restaurants with two healthy meal options from each, along with ordering tips.",
  },
];

const CACHE_KEY = "mealFinder.cache.v1";

type CachedMealFinderState = {
  results: MealResult[];
  mealQuery: string;
  zipCode: string;
  generatedAtISO: string;
};

function saveMealFinderCache(state: CachedMealFinderState) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {}
}

function loadMealFinderCache(): CachedMealFinderState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.results || !Array.isArray(parsed.results)) return null;
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
  photoUrl?: string;
  meal: {
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    reason: string;
    modifications: string;
    ingredients: string[];
    imageUrl?: string;
  };
  medicalBadges?: Array<{
    condition: string;
    compatible: boolean;
    reason: string;
    color: string;
  }>;
}

export default function MealFinder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const quickTour = useQuickTour("social-find-meals");
  const { speak, stop } = useChefVoice();

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

  // Auto-mark info as seen since Copilot provides guidance now
  useEffect(() => {
    if (!localStorage.getItem("hasSeenMealFinderInfo")) {
      localStorage.setItem("hasSeenMealFinderInfo", "true");
    }
  }, []);

  const [mealQuery, setMealQuery] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [results, setResults] = useState<MealResult[]>([]);
  const [progress, setProgress] = useState(0);
  const hasRestoredRef = useRef(false);
  const hasSpokenEntryRef = useRef(false);

  // Guided step state (matches Macro Calculator pattern)
  const hasCachedResults = loadMealFinderCache() !== null;
  const [guidedStep, setGuidedStep] = useState<GuidedStep>(
    hasCachedResults ? "results" : "entry",
  );

  // Speak entry script on mount (if starting fresh)
  useEffect(() => {
    if (guidedStep === "entry" && !hasSpokenEntryRef.current) {
      hasSpokenEntryRef.current = true;
      const timer = setTimeout(() => {
        speak(FIND_MY_MEAL_ENTRY);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [guidedStep, speak]);

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
        const response = await apiRequest("/api/meal-finder", {
          method: "POST",
          body: JSON.stringify(data),
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
      const newResults = data.results || [];
      setResults(newResults);
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
        title: "Meals Found!",
        description: `Found ${uniqueRestaurants} restaurants with ${newResults.length} meals`,
      });

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
        title: "Search Failed",
        description:
          error.message ||
          "Could not find meals. Please try a different search or ZIP code.",
        variant: "destructive",
      });
      setProgress(0);
    },
  });

  const handleSearch = () => {
    if (!mealQuery.trim()) {
      toast({
        title: "Missing Meal",
        description: "Please enter what you're craving",
        variant: "destructive",
      });
      return;
    }

    if (!zipCode.trim() || !/^\d{5}$/.test(zipCode)) {
      toast({
        title: "Invalid ZIP Code",
        description: "Please enter a valid 5-digit ZIP code",
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

  const handleGoBack = () => {
    setLocation("/social-hub");
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav">
        {/* Universal Safe-Area Header */}
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
              <span className="text-sm font-medium">Back</span>
            </button>

            {/* Title */}
            <h1 className="text-lg font-bold text-white truncate min-w-0">
              Meal Finder
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
          className="max-w-4xl mx-auto px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
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
                  Find My Meal
                </h2>
                <p className="text-white/70 mb-6">
                  Tell me what you're craving and I'll find nearby restaurants
                  with healthy options that fit your goals.
                </p>
                <Button
                  onClick={() => advanceGuided("step1")}
                  className="bg-lime-600 text-white px-8 py-3 text-lg font-semibold"
                >
                  Let's Find Meals
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
                    What are you in the mood to eat?
                  </p>
                  <div className="relative">
                    <Input
                      placeholder="e.g., steak dinner, sushi, pasta, burger"
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
                  <Button
                    onClick={() => advanceGuided("step2")}
                    disabled={!mealQuery.trim()}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 text-lg font-semibold"
                  >
                    Next
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
                    <h3 className="text-lg font-semibold text-white">Step 2</h3>
                  </div>
                  <p className="text-white text-base">
                    Enter your ZIP code so I can find nearby restaurants.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="e.g., 30303, 90210, 10001"
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
                      Back
                    </Button>
                    <Button
                      onClick={handleSearch}
                      disabled={zipCode.length !== 5}
                      className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold"
                      data-testid="button-find-meals"
                    >
                      Find Meals
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
                    Finding Nearby Restaurants...
                  </h3>
                  <p className="text-white/70 text-center">
                    Searching for {mealQuery} options near you
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

          {/* RESULTS SCREEN - Show results after generation */}
          {guidedStep === "results" && results.length > 0 && (
            <div className="space-y-6 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  🍽️ Found{" "}
                  {
                    new Set(results.map((r: MealResult) => r.restaurantName))
                      .size
                  }{" "}
                  Restaurants with {results.length} Meals:
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
              <div className="grid gap-4">
                {results.map((result, index) => (
                  <Card
                    key={index}
                    className="overflow-hidden shadow-lg hover:shadow-orange-500/50 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-black/40 backdrop-blur-lg border border-white/20"
                    data-testid={`card-result-${index}`}
                  >
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="relative h-48 md:h-auto">
                        {result.meal.imageUrl || result.photoUrl ? (
                          <img
                            src={result.meal.imageUrl || result.photoUrl}
                            alt={result.meal.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-orange-200 to-orange-300 flex items-center justify-center">
                            <div className="text-4xl">🍽️</div>
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-2 p-4">
                        <div className="mb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-white">
                                {result.restaurantName}
                              </h3>
                              <p className="text-sm text-white/60">
                                {result.cuisine}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  onClick={() => openInMaps(result.address)}
                                  className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                  aria-label="Open in Maps"
                                >
                                  <Navigation className="h-3 w-3" />
                                  <span className="underline">
                                    {result.address}
                                  </span>
                                </button>
                                <button
                                  onClick={async () => {
                                    const success =
                                      await copyAddressToClipboard(
                                        result.address,
                                      );
                                    toast({
                                      title: success
                                        ? "Address copied"
                                        : "Copy failed",
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
                              </div>
                            </div>
                            {result.rating && (
                              <div className="flex items-center gap-1 bg-orange-600 px-2 py-1 rounded">
                                <Star className="h-3 w-3 text-white fill-white" />
                                <span className="text-sm text-white font-medium">
                                  {result.rating}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-xl font-bold text-white">
                              {result.meal.name}
                            </h4>
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
                          <p className="text-sm text-white/70">
                            {result.meal.description}
                          </p>
                        </div>

                        {/* Medical Safety Badges - Generated Client-Side */}
                        {(() => {
                          const userProfile = getUserMedicalProfile(1);
                          const mealForBadges = {
                            name: result.meal.name,
                            calories: result.meal.calories,
                            protein: result.meal.protein,
                            carbs: result.meal.carbs,
                            fat: result.meal.fat,
                            ingredients:
                              result.meal.ingredients?.map((ing: string) => ({
                                name: ing,
                                amount: 1,
                                unit: "serving",
                              })) || [],
                          };
                          const medicalBadges = generateMedicalBadges(
                            mealForBadges as any,
                            userProfile,
                          );
                          const badgeStrings = medicalBadges.map(
                            (b: any) => b.badge || b.label || b.id,
                          );
                          return (
                            badgeStrings &&
                            badgeStrings.length > 0 && (
                              <div className="mb-3">
                                <div className="flex items-center gap-3">
                                  <HealthBadgesPopover badges={badgeStrings} />
                                  <h3 className="font-semibold text-white">
                                    Medical Safety
                                  </h3>
                                </div>
                              </div>
                            )
                          );
                        })()}

                        <div className="grid grid-cols-4 gap-2 mb-3">
                          <div className="text-center bg-white/10 rounded p-2">
                            <div className="text-lg font-bold text-white">
                              {result.meal.calories}
                            </div>
                            <div className="text-white/60 text-xs">Cal</div>
                          </div>
                          <div className="text-center bg-white/10 rounded p-2">
                            <div className="text-lg font-bold text-white">
                              {result.meal.protein}g
                            </div>
                            <div className="text-white/60 text-xs">Protein</div>
                          </div>
                          <div className="text-center bg-white/10 rounded p-2">
                            <div className="text-lg font-bold text-white">
                              {result.meal.carbs}g
                            </div>
                            <div className="text-white/60 text-xs">Carbs</div>
                          </div>
                          <div className="text-center bg-white/10 rounded p-2">
                            <div className="text-lg font-bold text-white">
                              {result.meal.fat}g
                            </div>
                            <div className="text-white/60 text-xs">Fat</div>
                          </div>
                        </div>

                        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 mb-3 backdrop-blur-sm">
                          <h5 className="font-medium text-green-300 text-sm mb-1">
                            Why This is Healthy:
                          </h5>
                          <p className="text-green-200 text-sm">
                            {result.meal.reason}
                          </p>
                        </div>

                        <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3 backdrop-blur-sm mb-3">
                          <h5 className="font-medium text-orange-300 text-sm mb-1">
                            Ask For:
                          </h5>
                          <p className="text-orange-200 text-sm">
                            {result.meal.modifications}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => {
                              setQuickView({
                                protein: Math.round(result.meal.protein || 0),
                                carbs: Math.round(result.meal.carbs || 0),
                                fat: Math.round(result.meal.fat || 0),
                                calories: Math.round(result.meal.calories || 0),
                                dateISO: new Date().toISOString().slice(0, 10),
                                mealSlot: "lunch",
                              });
                              setLocation(
                                "/biometrics?from=find-meals&view=macros",
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
                              id: `find-meals-${result.restaurantName}-${Date.now()}`,
                              title: result.meal.name,
                              name: result.meal.name,
                              description: result.meal.description,
                              imageUrl: result.meal.imageUrl,
                              ingredients:
                                result.meal.ingredients?.map((ing: string) => ({
                                  item: ing,
                                  amount: "1 serving",
                                })) || [],
                              instructions: result.meal.modifications
                                ? [result.meal.modifications]
                                : [],
                              calories: result.meal.calories,
                              protein: result.meal.protein,
                              carbs: result.meal.carbs,
                              fat: result.meal.fat,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!findMealsMutation.isPending && results.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🍴</div>
              <p className="text-white text-lg mb-2">
                Enter your craving and ZIP code to get started
              </p>
              <p className="text-sm text-white/60">
                We'll find the best restaurant meals near you
              </p>
            </div>
          )}
        </div>

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Find Meals Near Me"
          steps={FIND_MEALS_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />
      </div>
    </>
  );
}
