import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassButton } from "@/components/glass";
import CometBar from "@/components/CometBar";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import PhaseGate from "@/components/PhaseGate";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
import PairingResultCard from "@/components/pairings/PairingResultCard";

const STORAGE_KEY = "mpm_wine_list_helper_results";

function loadPersistedResults(): { results: any; wineListText: string; mealContext: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistResults(results: any, wineListText: string, mealContext: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ results, wineListText, mealContext }));
  } catch {}
}

function clearPersistedResults() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function WineListHelper() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isDesktop = useIsDesktop();
  useCopilotPageExplanation();

  const persisted = loadPersistedResults();

  const [wineListText, setWineListText] = useState(persisted?.wineListText ?? "");
  const [mealContext, setMealContext] = useState(persisted?.mealContext ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(persisted?.results ?? null);

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
    document.title = "Wine List Translator | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGenerating && !safetyChecking) {
      setPendingGeneration(false);
      handleGenerate(true, overrideToken);
    }
  }, [pendingGeneration, overrideToken, isGenerating, safetyChecking]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? prev : prev + Math.random() * 6));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  async function handleGenerate(overrideSafety = false, overrideToken?: string) {
    if (!wineListText.trim()) {
      toast({ title: "Please paste a wine list", variant: "destructive" });
      return;
    }

    if (safetyEnabled && !overrideSafety) {
      const safe = await checkSafety(wineListText.trim(), "wine-list-helper");
      if (!safe) return;
    }

    setIsGenerating(true);
    setResults(null);

    try {
      const res = await fetch(apiUrl("/api/ai/wine-list-helper"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          wineListText: wineListText.trim(),
          ...(mealContext.trim() ? { mealContext: mealContext.trim() } : {}),
          ...(overrideToken ? { safetyMode: "CUSTOM_AUTHENTICATED", overrideToken } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.safety) {
          toast({ title: err.safety.message || "Safety check failed", variant: "destructive" });
          setIsGenerating(false);
          return;
        }
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();
      setProgress(100);
      setResults(data);
      persistResults(data, wineListText.trim(), mealContext.trim());
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }

  function handleStartOver() {
    setResults(null);
    setWineListText("");
    setMealContext("");
    clearPersistedResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <PhaseGate phase="PHASE_1_CORE" feature="pairings-hub">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
      >
        {!isDesktop && (
          <div
            className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="px-4 py-3 flex items-center gap-2">
              <button
                onClick={() => setLocation("/lifestyle/pairings-hub")}
                className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <h1 className="text-lg font-bold text-white truncate">Wine List Translator</h1>
            </div>
          </div>
        )}

        <div
          className="flex-1 px-4 py-8"
          style={{ paddingTop: isDesktop ? "0" : "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-2xl bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <BookOpen className="h-5 w-5 text-orange-400" />
                  Translate a Wine List
                  <div className="flex-grow" />
                  <HowThisWorksLink
                    videoUrl="https://youtube.com/shorts/WINE_LIST_HELPER_VIDEO"
                    label="How It Works"
                  />
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <label className="block text-md font-medium text-white mb-1">
                    Paste your wine list <span className="text-orange-400">*</span>
                  </label>
                  <textarea
                    value={wineListText}
                    onChange={(e) => setWineListText(e.target.value)}
                    placeholder={"e.g.,\nBarolo\nBrunello di Montalcino\nChianti Classico\nAmarone della Valpolicella"}
                    className="w-full bg-black text-white border border-white/30 px-3 py-2 rounded-lg text-sm placeholder:text-white/50 min-h-[120px] resize-y"
                    maxLength={8000}
                  />
                </div>

                <div>
                  <label className="block text-md font-medium text-white mb-1">
                    What are you eating? <span className="text-white/40">(optional)</span>
                  </label>
                  <input
                    value={mealContext}
                    onChange={(e) => setMealContext(e.target.value)}
                    placeholder="e.g., steak, pasta, seafood..."
                    className="w-full bg-black text-white border border-white/30 px-3 py-2 rounded-lg text-sm placeholder:text-white/50"
                    maxLength={200}
                  />
                </div>

                <SafetyGuardBanner
                  alert={safetyAlert}
                  mealRequest={wineListText.trim()}
                  onDismiss={clearSafetyAlert}
                  onOverrideSuccess={(token) => handleGenerate(true, token)}
                />

                <div className="py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                  <span className="text-xs text-white/60 block mb-2">Safety</span>
                  <SafetyGuardToggle
                    safetyEnabled={safetyEnabled}
                    onSafetyChange={handleSafetyOverride}
                    disabled={isGenerating || safetyChecking}
                  />
                </div>

                {isGenerating || safetyChecking ? (
                  <div className="max-w-md mx-auto mb-4 flex justify-center">
                    <CometBar label={safetyChecking ? "Checking safety…" : "Scanning the wine list…"} />
                  </div>
                ) : (
                  <GlassButton
                    onClick={() => handleGenerate()}
                    className="w-full bg-orange-600 flex items-center justify-center"
                  >
                    Translate Wine List
                  </GlassButton>
                )}
              </CardContent>
            </Card>

            {results && (
              <div className="space-y-6">
                {results.bestChoice && (
                  <Card className="bg-orange-600/20 backdrop-blur-lg border border-orange-500/30 w-full max-w-xl mx-auto">
                    <CardContent className="p-4 flex items-start gap-3">
                      <Award className="h-6 w-6 text-orange-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-base font-semibold text-white mb-1">
                          Best Choice: {results.bestChoice.name}
                        </h3>
                        <p className="text-sm text-white/80">{results.bestChoice.explanation}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {results.pairings && results.pairings.length > 0 && (
                  <>
                    <h2 className="text-xl font-bold text-white">Wine List Explained</h2>
                    {results.pairings.map((pairing: any, idx: number) => (
                      <PairingResultCard
                        key={`wine-${pairing.name}-${idx}`}
                        pairing={pairing}
                        foodContext={mealContext || "wine list"}
                        sourceType="wine-list-helper"
                      />
                    ))}
                  </>
                )}

                <div className="flex justify-center pt-4 pb-8">
                  <GlassButton
                    onClick={handleStartOver}
                    className="bg-white/10 border border-white/20"
                  >
                    Start Over
                  </GlassButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </PhaseGate>
  );
}
