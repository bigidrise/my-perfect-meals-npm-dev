import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { apiJSON } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassButton } from "@/components/glass";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Wine, Beer, Martini } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";
import PhaseGate from "@/components/PhaseGate";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { useAuth } from "@/contexts/AuthContext";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import FavoriteButton from "@/components/FavoriteButton";
import AlcoholRecommendationCard from "@/components/AlcoholRecommendationCard";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

const PAIRING_TOUR_STEPS: TourStep[] = [
  {
    title: "Enter Your Food",
    description:
      "Type what you're eating — steak, salmon, pizza, tacos, or anything else.",
  },
  {
    title: "Find Pairings",
    description:
      "Tap Find Pairings and the AI will recommend wine, beer, and spirits that go perfectly with your food.",
  },
  {
    title: "Browse Results",
    description:
      "Scroll through wine, beer, and spirits sections. Each recommendation includes pairing reasons and health notes.",
  },
  {
    title: "Save Favorites",
    description:
      "Tap the heart icon on any pairing to save it to your favorites for quick access later.",
  },
];

export default function ChefPairings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const quickTour = useQuickTour("chef-pairings");
  const { user } = useAuth();
  const userId = user?.id || "";

  const [foodItem, setFoodItem] = useState("");
  const [pairingsResult, setPairingsResult] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem("mpm_chef_pairings_result");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [pendingGeneration, setPendingGeneration] = useState(false);

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

  const handleSafetyOverride = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert();
      setPendingGeneration(true);
    }
  };

  useEffect(() => {
    if (
      pendingGeneration &&
      overrideToken &&
      !isGenerating &&
      !safetyChecking
    ) {
      setPendingGeneration(false);
      handleFindPairings(overrideToken);
    }
  }, [pendingGeneration, overrideToken, isGenerating, safetyChecking]);

  useCopilotPageExplanation();

  useEffect(() => {
    document.title = "Chef Pairings | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (pairingsResult) {
      try {
        localStorage.setItem(
          "mpm_chef_pairings_result",
          JSON.stringify(pairingsResult),
        );
      } catch {}
    }
  }, [pairingsResult]);

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

  async function handleFindPairings(overrideTokenArg?: string) {
    if (!foodItem.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter what you're eating.",
        variant: "destructive",
      });
      return;
    }

    if (safetyEnabled && !hasActiveOverride && !overrideTokenArg) {
      const isSafe = await checkSafety(foodItem.trim(), "chef-pairings");
      if (!isSafe) {
        return;
      }
    }

    setIsGenerating(true);
    startProgressTicker();

    try {
      const data = await apiJSON("/api/ai/chef-pairings", {
        method: "POST",
        json: {
          foodItem: foodItem.trim(),
          userId,
          safetyMode:
            !safetyEnabled && (overrideTokenArg || overrideToken) ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: !safetyEnabled ? (overrideTokenArg || overrideToken) : undefined,
        },
      });

      if (data?.safetyBlocked || data?.safetyAmbiguous) {
        stopProgressTicker();
        setIsGenerating(false);
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

      setSafetyEnabled(true);
      clearSafetyAlert();

      stopProgressTicker();
      setPairingsResult(data);

      toast({
        title: "Pairings Found!",
        description: `Perfect pairings for ${foodItem} are ready.`,
      });
    } catch (err: any) {
      stopProgressTicker();
      const errorMsg = err?.message || String(err) || "";
      if (isAllergyRelatedError(errorMsg)) {
        toast({
          title: "ALLERGY ALERT",
          description: formatAllergyAlertDescription(errorMsg),
          variant: "warning",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  }

  const winePairings = pairingsResult?.pairings?.wine || [];
  const beerPairings = pairingsResult?.pairings?.beer || [];
  const spiritsPairings = pairingsResult?.pairings?.spirits || [];
  const hasResults = winePairings.length > 0 || beerPairings.length > 0 || spiritsPairings.length > 0;

  return (
    <PhaseGate phase="PHASE_1_CORE" feature="chef-pairings">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
      >
        <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 flex items-center gap-2 flex-nowrap overflow-hidden">
            <button
              onClick={() => setLocation("/lifestyle")}
              className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            <h1 className="text-lg font-bold text-white truncate min-w-0">
              Chef Pairings
            </h1>

            <div className="flex-grow" />
            <QuickTourButton
              onClick={quickTour.openTour}
              className="flex-shrink-0"
            />
          </div>
        </div>
        </MobileHeaderGuard>

        <div
          className="max-w-2xl mx-auto px-4 pb-32"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          <Card className="shadow-2xl bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Wine className="h-5 w-5 text-orange-400" />
                Find Perfect Pairings
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <label className="block text-md font-medium text-white mb-1">
                  What are you eating? <span className="text-orange-400">*</span>
                </label>
                <input
                  value={foodItem}
                  onChange={(e) => setFoodItem(e.target.value)}
                  placeholder="e.g., steak, salmon, pizza, burger..."
                  className="w-full bg-black text-white border border-white/30 px-3 py-2 rounded-lg text-sm placeholder:text-white/50"
                  maxLength={150}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isGenerating && !safetyChecking) {
                      handleFindPairings();
                    }
                  }}
                />
                <p className="text-xs text-white/60 mt-1">
                  Enter a food item to get wine, beer, and spirits pairings
                </p>
              </div>

              <SafetyGuardBanner
                alert={safetyAlert}
                mealRequest={foodItem.trim()}
                onDismiss={clearSafetyAlert}
                onOverrideSuccess={(token) =>
                  handleSafetyOverride(false, token)
                }
              />

              <div className="mb-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                <span className="text-xs text-white/60 block mb-2">
                  Meal Safety
                </span>
                <SafetyGuardToggle
                  safetyEnabled={safetyEnabled}
                  onSafetyChange={handleSafetyOverride}
                  disabled={isGenerating || safetyChecking}
                />
                <GlucoseGuardToggle disabled={isGenerating || safetyChecking} />
              </div>

              {isGenerating || safetyChecking ? (
                <div className="max-w-md mx-auto mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">
                      {safetyChecking
                        ? "Checking Safety Profile"
                        : "Finding Perfect Pairings"}
                    </span>
                    <span className="text-sm text-white/80">
                      {safetyChecking ? "..." : `${Math.round(progress)}%`}
                    </span>
                  </div>
                  <Progress
                    value={safetyChecking ? 30 : progress}
                    className="h-3 bg-black/30 border border-white/20"
                  />
                </div>
              ) : (
                <GlassButton
                  onClick={() => handleFindPairings()}
                  className="w-full bg-orange-600 flex items-center justify-center"
                >
                  Find Pairings
                </GlassButton>
              )}
            </CardContent>
          </Card>

          {hasResults && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  Pairings for {pairingsResult?.query?.foodItem || foodItem}
                </h2>
                <button
                  onClick={() => {
                    setPairingsResult(null);
                    localStorage.removeItem("mpm_chef_pairings_result");
                  }}
                  className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-lg transition-colors active:scale-[0.98]"
                >
                  New Search
                </button>
              </div>

              {winePairings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Wine className="h-5 w-5 text-red-400" />
                    Wine Pairings
                  </h3>
                  {winePairings.map((item: any, i: number) => (
                    <div key={`wine-${i}`} className="relative">
                      <AlcoholRecommendationCard
                        recommendation={item}
                        className="bg-black/30 backdrop-blur-lg border-white/20 text-white"
                      />
                      <div className="absolute top-4 right-4">
                        <FavoriteButton
                          title={item.name}
                          sourceType="chef_pairings"
                          mealData={item}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {beerPairings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Beer className="h-5 w-5 text-amber-400" />
                    Beer Pairings
                  </h3>
                  {beerPairings.map((item: any, i: number) => (
                    <div key={`beer-${i}`} className="relative">
                      <AlcoholRecommendationCard
                        recommendation={item}
                        className="bg-black/30 backdrop-blur-lg border-white/20 text-white"
                      />
                      <div className="absolute top-4 right-4">
                        <FavoriteButton
                          title={item.name}
                          sourceType="chef_pairings"
                          mealData={item}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {spiritsPairings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Martini className="h-5 w-5 text-blue-400" />
                    Spirits Pairings
                  </h3>
                  {spiritsPairings.map((item: any, i: number) => (
                    <div key={`spirits-${i}`} className="relative">
                      <AlcoholRecommendationCard
                        recommendation={item}
                        className="bg-black/30 backdrop-blur-lg border-white/20 text-white"
                      />
                      <div className="absolute top-4 right-4">
                        <FavoriteButton
                          title={item.name}
                          sourceType="chef_pairings"
                          mealData={item}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Chef Pairings"
          steps={PAIRING_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />
      </motion.div>
    </PhaseGate>
  );
}
