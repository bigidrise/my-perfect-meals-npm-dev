import { useState, useEffect, useRef } from "react";
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
import { MapPin, Sparkles, ArrowLeft, Star, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { getLocation } from "@/lib/capacitorLocation";

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

  useEffect(() => {
    if (hasRestoredRef.current) return;

    const cached = loadMealFinderCache();
    if (cached) {
      setResults(cached.results);
      setMealQuery(cached.mealQuery);
      setZipCode(cached.zipCode);
      toast({
        title: "🔄 Meal Finder Restored",
        description: `Your search results for "${cached.mealQuery}" will remain saved on this page until you search again.`,
      });
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
    findMealsMutation.mutate({ mealQuery, zipCode });
  };

  const handleUseLocation = async () => {
    setIsGettingLocation(true);
    
    try {
      const coords = await getLocation();
      
      const response = await apiRequest(
        "/api/restaurants/reverse-geocode",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: coords.latitude,
            lng: coords.longitude,
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
          <Card className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <MapPin className="h-5 w-5" />
                Search by Location
              </CardTitle>
              <CardDescription className="text-md text-white/80">
                Enter what you're craving and your Zip code to find nearby
                restaurant recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-md font-medium text-white/80 mb-2">
                    What are you craving?
                  </label>
                  <Input
                    placeholder="e.g., steak dinner, sushi, pasta, burger"
                    value={mealQuery}
                    onChange={(e) => setMealQuery(e.target.value)}
                    className="w-full bg-black/40 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50"
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="findmeals-search"
                  />
                </div>

                <div>
                  <label className="block text-md text-white/80 mb-2">
                    Zip Code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., 30303, 90210, 10001"
                      value={zipCode}
                      onChange={(e) =>
                        setZipCode(
                          e.target.value.replace(/\D/g, "").slice(0, 5),
                        )
                      }
                      className="flex-1 bg-black/40 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50"
                      maxLength={5}
                      onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                      data-testid="input-zip-code"
                    />
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
                  onClick={handleSearch}
                  disabled={findMealsMutation.isPending}
                  className="w-full bg-lime-900 hover:bg-lime-500 text-white text-md shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                  data-testid="button-find-meals"
                >
                  {findMealsMutation.isPending
                    ? "Finding Meals..."
                    : "Find Meals"}
                </Button>
              </div>

              {findMealsMutation.isPending && (
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
            </CardContent>
          </Card>

          {results.length > 0 && (
            <div className="space-y-6 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  🍽️ Found{" "}
                  {new Set(results.map((r: MealResult) => r.restaurantName)).size}{" "}
                  Restaurants with {results.length} Meals:
                </h2>
                <button
                  onClick={() => {
                    setResults([]);
                    clearMealFinderCache();
                    setMealQuery("");
                    setZipCode("");
                  }}
                  className="text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
                  data-testid="button-create-new"
                >
                  Create New
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
                                {result.cuisine} • {result.address}
                              </p>
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
                          <h4 className="text-xl font-bold text-white mb-1">
                            {result.meal.name}
                          </h4>
                          <p className="text-sm text-white/70">
                            {result.meal.description}
                          </p>
                        </div>

                        {result.medicalBadges &&
                          result.medicalBadges.length > 0 && (
                            <div className="mb-3">
                              <HealthBadgesPopover
                                badges={result.medicalBadges.map(
                                  (b) => b.condition,
                                )}
                              />
                            </div>
                          )}

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

                        <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3 backdrop-blur-sm">
                          <h5 className="font-medium text-orange-300 text-sm mb-1">
                            Ask For:
                          </h5>
                          <p className="text-orange-200 text-sm">
                            {result.meal.modifications}
                          </p>
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
        />
      </div>
    </>
  );
}
