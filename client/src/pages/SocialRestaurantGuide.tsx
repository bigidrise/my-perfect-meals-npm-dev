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
import { useState, useEffect, useRef } from "react";
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
import { Home, Clock, Users, ArrowLeft, MapPin, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
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

const RESTAURANT_TOUR_STEPS: TourStep[] = [
  {
    title: "Describe What You Want",
    description: "Tell us what you're craving and the type of food you'd like.",
  },
  {
    title: "Enter Restaurant & ZIP",
    description: "Enter the restaurant name and a nearby zip code.",
  },
  {
    title: "Get Meal Options",
    description:
      "See meal options that match your goals and work where you're eating.",
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
      // Restore restaurant info if cached
      if (cached.restaurantData.restaurantInfo) {
        setRestaurantInfo(cached.restaurantData.restaurantInfo);
      }
      toast({
        title: "🔄 Restaurant Guide Restored",
        description:
          "Your generated restaurant meals will remain saved on this page until you search again.",
      });
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

    // Generate meals with craving, restaurant, and ZIP code
    generateMealsMutation.mutate({
      restaurantName: restaurantInput,
      craving: cravingInput,
      cuisine: match || "American",
      zipCode: zipCode,
    });
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location Not Supported",
        description: "Your browser doesn't support location services.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await apiRequest(
            "/api/restaurants/reverse-geocode",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              }),
            },
          );
          if (response.zipCode) {
            setZipCode(response.zipCode);
            toast({
              title: "Location Found",
              description: `ZIP Code: ${response.zipCode}`,
            });
          }
        } catch (error) {
          toast({
            title: "Location Error",
            description: "Could not get ZIP code for your location.",
            variant: "destructive",
          });
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: "Location Access Denied",
          description: "Please enable location access or enter ZIP manually.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
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
          className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-8 py-3 flex items-center gap-3 flex-nowrap">
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
          <Card className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="space-y-3 mb-6">
                <div>
                  <label
                    htmlFor="craving-input"
                    className="block text-lg font-semibold text-white mb-2"
                  >
                    What dish are you craving?
                  </label>
                  <div className="relative">
                    <Input
                      data-wt="rg-craving-input"
                      id="craving-input"
                      placeholder="e.g. chicken, salmon, pasta"
                      value={cravingInput}
                      onChange={(e) => setCravingInput(e.target.value)}
                      className="w-full pr-10 bg-black/40 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:bg-black/40 focus:text-white caret-white"
                      autoComplete="off"
                      onKeyPress={(e) => e.key === "Enter" && handleSearch()}
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
                </div>
                <div>
                  <label
                    htmlFor="restaurant-input"
                    className="block text-lg font-semibold text-white mb-2"
                  >
                    Where are you eating?{" "}
                    <span className="text-md text-white/60">
                      (Specific Restaurant)
                    </span>
                  </label>
                  <div className="relative">
                    <Input
                      data-testid="restaurantguide-search"
                      data-wt="rg-restaurant-input"
                      id="restaurant-input"
                      placeholder="e.g. Cheesecake Factory, P.F. Chang's, Chipotle"
                      value={restaurantInput}
                      onChange={(e) => setRestaurantInput(e.target.value)}
                      className="w-full pr-10 bg-black/40 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:bg-black/40 focus:text-white caret-white"
                      autoComplete="off"
                      onKeyPress={(e) => e.key === "Enter" && handleSearch()}
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
                </div>
                <div>
                  <label
                    htmlFor="zip-input"
                    className="block text-lg font-semibold text-white mb-2"
                  >
                    Your ZIP Code
                  </label>
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
                        className="w-full pr-10 bg-black/40 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50"
                        maxLength={5}
                        onKeyPress={(e) => e.key === "Enter" && handleSearch()}
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
                      aria-label={
                        isGettingLocation
                          ? "Finding your location"
                          : "Use my location"
                      }
                    >
                      <div className="flex items-center gap-2">
                        {isGettingLocation ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Finding location…</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="h-4 w-4" />
                            <span className="text-sm">Use my location</span>
                          </>
                        )}
                      </div>
                    </Button>
                  </div>
                </div>
                <Button
                  data-wt="rg-search-button"
                  onClick={handleSearch}
                  disabled={generateMealsMutation.isPending}
                  className="w-full bg-lime-900 hover:bg-lime-500 text-white text-md shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                >
                  {generateMealsMutation.isPending
                    ? "Finding Dishes..."
                    : "Find Dishes"}
                </Button>

                {generateMealsMutation.isPending && (
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
                    <p className="text-white/70 text-sm text-center mt-3"></p>
                  </div>
                )}
              </div>

              {/* Generated Meals Section */}
              {generatedMeals.length > 0 && (
                <div data-wt="rg-results-list" className="space-y-6 mb-6">
                  <div className="mb-4">
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
                    {restaurantInfo?.address && (
                      <p className="text-white/70 text-sm mt-1">
                        📍 {restaurantInfo.address}
                        {restaurantInfo.rating && (
                          <span className="ml-2">
                            ⭐ {restaurantInfo.rating}
                          </span>
                        )}
                      </p>
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
                              <h3 className="text-lg font-semibold text-white">
                                {meal.name || meal.meal}
                              </h3>
                              <span className="text-sm text-white/90 bg-orange-600 px-2 py-1 rounded font-medium">
                                {meal.calories} cal
                              </span>
                            </div>

                            <p className="text-white/80 mb-3">
                              {meal.description || meal.reason}
                            </p>

                            {/* Medical Badges */}
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
                                    <HealthBadgesPopover
                                      badges={badgeStrings}
                                      className="mt-2"
                                    />
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
                            <div className="bg-black/20 border border-white/10 rounded-lg p-3 backdrop-blur-sm">
                              <h4 className="font-medium text-orange-300 text-sm mb-1">
                                Ask For:
                              </h4>
                              <p className="text-orange-200 text-sm">
                                {meal.modifications || meal.orderInstructions}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {matchedCuisine &&
              !generateMealsMutation.isPending &&
              generatedMeals.length === 0 ? (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-orange-400">
                    {matchedCuisine} Cuisine Tips:
                  </h2>
                  <div className="bg-black/40 backdrop-blur-lg border border-white/20 rounded-lg p-4">
                    <ul className="space-y-2">
                      {cuisineTips[matchedCuisine].map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-orange-400 font-bold">•</span>
                          <span className="text-white/80">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 p-3 bg-black/20 border border-white/10 rounded-lg backdrop-blur-sm">
                    <p className="text-orange-200 text-sm">
                      💡 <strong>Pro Tip:</strong> These recommendations are
                      tailored to help you stay on track with your health goals
                      while still enjoying dining out!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🔍</div>
                  <p className="text-white mb-2"></p>
                  <p className="text-sm text-white"></p>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-white/20">
                <h3 className="font-semibold text-lg text-white mb-2">
                  Quick Cuisine Tips:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(cuisineTips).map((cuisine) => (
                    <button
                      key={cuisine}
                      onClick={() => {
                        setRestaurantInput(`${cuisine} restaurant`);
                        setMatchedCuisine(cuisine);
                      }}
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-full text-sm transition-colors font-medium"
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
                <p className="text-white/60 text-xs mt-2">
                  Tap a cuisine to fill in the restaurant field, then enter your
                  craving and ZIP to search.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Restaurant Guide"
          steps={RESTAURANT_TOUR_STEPS}
        />
      </motion.div>
    </PhaseGate>
  );
}
