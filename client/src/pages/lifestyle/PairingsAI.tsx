import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles, Wine, Beer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { CuisineOverrideControl } from "@/components/ui/CuisineOverrideControl";
import { DietOverrideControl } from "@/components/ui/DietOverrideControl";
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
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import PairingResultCard from "@/components/pairings/PairingResultCard";
import { PillButton } from "@/components/ui/pill-button";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";

type Mode = "pairing" | "discovery";
type Category = "wine" | "beer" | "both";

const STORAGE_KEY = "mpm_pairings_ai_results";

function loadPersistedResults(): { results: any; input: string; mode: Mode; category: Category } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistResults(results: any, input: string, mode: Mode, category: Category) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ results, input, mode, category }));
  } catch {}
}

function clearPersistedResults() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function PairingsAI() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  useCopilotPageExplanation();

  const persisted = loadPersistedResults();
  const [cuisineOverrideEnabled, setCuisineOverrideEnabled] = useState(false);
  const [cuisineOverrideValue, setCuisineOverrideValue] = useState("");
  const [dietOverrideEnabled, setDietOverrideEnabled] = useState(false);
  const [dietOverrideValue, setDietOverrideValue] = useState("");

  const [mode, setMode] = useState<Mode>(persisted?.mode ?? "pairing");
  const [category, setCategory] = useState<Category>(persisted?.category ?? "both");
  const [input, setInput] = useState(persisted?.input ?? "");
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
    document.title = "Drink Pairings | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGenerating && !safetyChecking) {
      setPendingGeneration(false);
      handleGenerate(true, overrideToken);
    }
  }, [pendingGeneration, overrideToken, isGenerating, safetyChecking]);

  useEffect(() => {
    if (mode === "discovery" && category === "both") {
      setCategory("wine");
    }
  }, [mode, category]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 8;
        });
      }, 400);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  async function handleGenerate(overrideSafety = false, overrideToken?: string) {
    if (!input.trim()) {
      toast({ title: "Please enter something", variant: "destructive" });
      return;
    }

    if (safetyEnabled && !overrideSafety) {
      const safe = await checkSafety(input.trim(), "pairings-ai");
      if (!safe) return;
    }

    setIsGenerating(true);
    setResults(null);

    try {
      const res = await fetch(apiUrl("/api/ai/pairings"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          mode,
          category,
          input: input.trim(),
          ...(overrideToken ? { safetyMode: "CUSTOM_AUTHENTICATED", overrideToken } : {}),
          ...(cuisineOverrideEnabled && cuisineOverrideValue ? { cultureOverride: cuisineOverrideValue } : {}),
          ...(dietOverrideEnabled && dietOverrideValue ? { dietaryRestrictions: [dietOverrideValue] } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.safety && (err.safety.result === "BLOCKED" || err.safety.result === "AMBIGUOUS")) {
          handleSafetyOverride(false);
          toast({
            title: isAllergyRelatedError(err)
              ? formatAllergyAlertDescription(err)
              : err.safety.message || "Safety check failed",
            variant: "destructive",
          });
          setIsGenerating(false);
          return;
        }
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();
      setProgress(100);
      setResults(data);
      persistResults(data, input.trim(), mode, category);
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }

  function handleStartOver() {
    setResults(null);
    setInput("");
    clearPersistedResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const modePills: { value: Mode; label: string }[] = [
    { value: "pairing", label: "Pair food with drinks" },
    { value: "discovery", label: "Find similar drinks" },
  ];

  const categoryPills: { value: Category; label: string; icon: any }[] =
    mode === "discovery"
      ? [
          { value: "wine", label: "Wine", icon: Wine },
          { value: "beer", label: "Beer", icon: Beer },
        ]
      : [
          { value: "wine", label: "Wine", icon: Wine },
          { value: "beer", label: "Beer", icon: Beer },
          { value: "both", label: "Both", icon: Sparkles },
        ];

  const inputLabel = mode === "pairing" ? "What are you eating?" : "Enter a drink you like";
  const inputPlaceholder =
    mode === "pairing"
      ? "e.g., ribeye steak, salmon, pizza, tacos..."
      : "e.g., Guinness, Pinot Noir, Bourbon...";

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
              <h1 className="text-lg font-bold text-white truncate">Drink Pairings</h1>
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
                  <Sparkles className="h-5 w-5 text-orange-400" />
                  What would you like to do?
                  <div className="flex-grow" />
                  <HowThisWorksLink
                    videoUrl="https://youtube.com/shorts/dF7jpiph7_E"
                    label="How It Works"
                  />
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {modePills.map((pill) => (
                    <PillButton
                      key={pill.value}
                      active={mode === pill.value}
                      variant="amber"
                      onClick={() => setMode(pill.value)}
                      className="text-[11px] px-5 py-1.5"
                    >
                      {pill.label}
                    </PillButton>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {categoryPills.map((pill) => (
                      <PillButton
                        key={pill.value}
                        active={category === pill.value}
                        variant="amber"
                        onClick={() => setCategory(pill.value)}
                        className="text-[11px] px-5 py-1.5"
                      >
                        <pill.icon className="h-3.5 w-3.5 mr-1" />
                        {pill.label}
                      </PillButton>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-md font-medium text-white mb-1">
                    {inputLabel} <span className="text-orange-400">*</span>
                  </label>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={inputPlaceholder}
                    className="w-full bg-black text-white border border-white/30 px-3 py-2 rounded-lg text-sm placeholder:text-white/50"
                    maxLength={300}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isGenerating && !safetyChecking) {
                        handleGenerate();
                      }
                    }}
                  />
                </div>

                <SafetyGuardBanner
                  alert={safetyAlert}
                  mealRequest={input.trim()}
                  onDismiss={clearSafetyAlert}
                  onOverrideSuccess={(token) => handleGenerate(true, token)}
                />

                <DietOverrideControl
                  overrideEnabled={dietOverrideEnabled}
                  overrideDiet={dietOverrideValue}
                  onToggle={setDietOverrideEnabled}
                  onDietChange={setDietOverrideValue}
                />
                <CuisineOverrideControl
                  savedCuisine={user?.cuisinePreference}
                  overrideEnabled={cuisineOverrideEnabled}
                  overrideCuisine={cuisineOverrideValue}
                  onToggle={setCuisineOverrideEnabled}
                  onCuisineChange={setCuisineOverrideValue}
                />

                <div className="py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                  <span className="text-xs text-white/60 block mb-2">Safety</span>
                  <SafetyGuardToggle
                    safetyEnabled={safetyEnabled}
                    onSafetyChange={handleSafetyOverride}
                    disabled={isGenerating || safetyChecking}
                  />
                  <GlucoseGuardToggle disabled={isGenerating || safetyChecking} />
                </div>

                {isGenerating || safetyChecking ? (
                  <div className="max-w-md mx-auto mb-4 flex justify-center">
                    <CometBar label={safetyChecking ? "Checking safety…" : "Scanning for pairings…"} />
                  </div>
                ) : (
                  <GlassButton
                    onClick={() => handleGenerate()}
                    className="w-full bg-orange-600 flex items-center justify-center"
                  >
                    Generate Pairings
                  </GlassButton>
                )}
              </CardContent>
            </Card>

            {results && results.pairings && results.pairings.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white">
                  {mode === "pairing"
                    ? `Pairings for ${input}`
                    : `Drinks similar to ${input}`}
                </h2>
                {results.pairings.map((pairing: any, idx: number) => (
                  <PairingResultCard
                    key={`${pairing.category}-${pairing.name}-${idx}`}
                    pairing={pairing}
                    foodContext={input}
                    sourceType="pairings-ai"
                  />
                ))}

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
