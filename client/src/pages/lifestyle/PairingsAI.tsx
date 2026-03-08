import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles, Wine, Beer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassButton } from "@/components/glass";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import PhaseGate from "@/components/PhaseGate";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import PairingResultCard from "@/components/pairings/PairingResultCard";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";

type Mode = "pairing" | "discovery";
type Category = "wine" | "beer" | "both";

export default function PairingsAI() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  useCopilotPageExplanation();

  const [mode, setMode] = useState<Mode>("pairing");
  const [category, setCategory] = useState<Category>("both");
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);

  const {
    safetyEnabled,
    safetyAlert,
    safetyChecking,
    handleSafetyOverride,
    clearSafetyAlert,
    runPrecheck,
  } = useSafetyGuardPrecheck();

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
      const blocked = await runPrecheck(input.trim());
      if (blocked) return;
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
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
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
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 flex items-center gap-2">
            <button
              onClick={() => setLocation("/lifestyle/pairings-hub")}
              className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <h1 className="text-lg font-bold text-white truncate">Pairings AI</h1>
          </div>
        </div>

        <div
          className="max-w-2xl mx-auto px-4 pb-32"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          <Card className="shadow-2xl bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Sparkles className="h-5 w-5 text-orange-400" />
                What would you like to do?
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {modePills.map((pill) => (
                  <button
                    key={pill.value}
                    onClick={() => setMode(pill.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      mode === pill.value
                        ? "bg-orange-600 text-white border border-orange-400"
                        : "bg-white/10 text-white/70 border border-white/20 hover:bg-white/20"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categoryPills.map((pill) => (
                    <button
                      key={pill.value}
                      onClick={() => setCategory(pill.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                        category === pill.value
                          ? "bg-orange-600 text-white border border-orange-400"
                          : "bg-white/10 text-white/70 border border-white/20 hover:bg-white/20"
                      }`}
                    >
                      <pill.icon className="h-4 w-4" />
                      {pill.label}
                    </button>
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
                <div className="max-w-md mx-auto mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">
                      {safetyChecking ? "Checking Safety Profile" : "Finding Perfect Pairings"}
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
            </div>
          )}
        </div>
      </motion.div>
    </PhaseGate>
  );
}
