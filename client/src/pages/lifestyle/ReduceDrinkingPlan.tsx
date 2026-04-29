import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, HeartPulse, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassButton } from "@/components/glass";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import PhaseGate from "@/components/PhaseGate";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";

type Pace = "gentle" | "standard" | "custom";

export default function ReduceDrinkingPlan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isDesktop = useIsDesktop();
  useCopilotPageExplanation();

  const [baselineIntake, setBaselineIntake] = useState(3);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [pace, setPace] = useState<Pace>("standard");
  const [customReductionPct, setCustomReductionPct] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    document.title = "Reduce Drinking Plan | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? prev : prev + Math.random() * 10));
      }, 400);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  async function handleGenerate() {
    setIsGenerating(true);
    setPlan(null);

    try {
      const res = await fetch(apiUrl("/api/ai/reduce-drinking-plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          baselineIntake,
          daysPerWeek,
          pace,
          ...(pace === "custom" ? { customReductionPct } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();
      setProgress(100);
      setPlan(data);
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }

  const pacePills: { value: Pace; label: string }[] = [
    { value: "gentle", label: "Gentle" },
    { value: "standard", label: "Standard" },
    { value: "custom", label: "Custom" },
  ];

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
              <h1 className="text-lg font-bold text-white truncate">Reduce Drinking Plan</h1>
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
                  <HeartPulse className="h-5 w-5 text-orange-400" />
                  Build Your Plan
                  <div className="flex-grow" />
                  <HowThisWorksLink
                    videoUrl="https://youtube.com/shorts/REDUCE_DRINKING_VIDEO"
                    label="How It Works"
                  />
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <label className="block text-md font-medium text-white mb-1">
                    Drinks per day (on drinking days) <span className="text-orange-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={baselineIntake}
                    onChange={(e) => setBaselineIntake(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="w-full bg-black text-white border border-white/30 px-3 py-2 rounded-lg text-sm"
                    min={1}
                    max={100}
                  />
                </div>

                <div>
                  <label className="block text-md font-medium text-white mb-1">
                    Drinking days per week <span className="text-orange-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={daysPerWeek}
                    onChange={(e) => setDaysPerWeek(Math.max(1, Math.min(7, parseInt(e.target.value) || 1)))}
                    className="w-full bg-black text-white border border-white/30 px-3 py-2 rounded-lg text-sm"
                    min={1}
                    max={7}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Reduction Pace</label>
                  <div className="flex flex-wrap gap-2">
                    {pacePills.map((pill) => (
                      <button
                        key={pill.value}
                        onClick={() => setPace(pill.value)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          pace === pill.value
                            ? "bg-orange-600 text-white border border-orange-400"
                            : "bg-white/10 text-white/70 border border-white/20 hover:bg-white/20"
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                {pace === "custom" && (
                  <div>
                    <label className="block text-md font-medium text-white mb-1">
                      Weekly reduction % <span className="text-orange-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={customReductionPct}
                      onChange={(e) => setCustomReductionPct(Math.max(5, Math.min(50, parseInt(e.target.value) || 5)))}
                      className="w-full bg-black text-white border border-white/30 px-3 py-2 rounded-lg text-sm"
                      min={5}
                      max={50}
                    />
                  </div>
                )}

                <div className="text-sm text-white/60 bg-black/20 rounded-lg p-3 border border-white/10">
                  Current weekly total: <span className="text-white font-medium">{baselineIntake * daysPerWeek} drinks/week</span>
                </div>

                {isGenerating ? (
                  <div className="max-w-md mx-auto mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">Creating Your Plan</span>
                      <span className="text-sm text-white/80">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-3 bg-black/30 border border-white/20" />
                  </div>
                ) : (
                  <GlassButton
                    onClick={handleGenerate}
                    className="w-full bg-orange-600 flex items-center justify-center"
                  >
                    Generate Plan
                  </GlassButton>
                )}
              </CardContent>
            </Card>

            {plan && (
              <div className="space-y-4">
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          plan.summary.riskTier === "low"
                            ? "bg-green-600/20 text-green-400 border border-green-500/20"
                            : plan.summary.riskTier === "moderate"
                              ? "bg-yellow-600/20 text-yellow-400 border border-yellow-500/20"
                              : "bg-red-600/20 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {plan.summary.riskTier} risk
                      </span>
                      <span className="text-sm text-white/60">
                        {plan.summary.projectedWeeks} week plan
                      </span>
                    </div>
                    <p className="text-sm text-white/80">{plan.summary.overviewMessage}</p>
                  </CardContent>
                </Card>

                <h3 className="text-lg font-semibold text-white">Weekly Targets</h3>
                {plan.weeklyTargets.map((target: any) => (
                  <Card
                    key={target.week}
                    className="bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-orange-400">Week {target.week}</span>
                        <span className="text-sm text-white/70">
                          Max {target.maxDrinksPerDay}/day ({target.maxDrinksPerWeek}/week)
                        </span>
                      </div>
                      <p className="text-xs text-white/60">{target.notes}</p>
                    </CardContent>
                  </Card>
                ))}

                {plan.harmReductionTips && plan.harmReductionTips.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                      Harm Reduction Tips
                    </h3>
                    <Card className="bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto">
                      <CardContent className="p-4 space-y-2">
                        {plan.harmReductionTips.map((tip: string, i: number) => (
                          <p key={i} className="text-sm text-white/80 flex items-start gap-2">
                            <span className="text-orange-400 mt-0.5">-</span>
                            {tip}
                          </p>
                        ))}
                      </CardContent>
                    </Card>
                  </>
                )}

                {plan.medicalFlags && plan.medicalFlags.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                      Medical Flags
                    </h3>
                    <Card className="bg-yellow-600/10 backdrop-blur-lg border border-yellow-500/20 w-full max-w-xl mx-auto">
                      <CardContent className="p-4 space-y-2">
                        {plan.medicalFlags.map((flag: string, i: number) => (
                          <p key={i} className="text-sm text-yellow-200/80">{flag}</p>
                        ))}
                      </CardContent>
                    </Card>
                  </>
                )}

                {plan.disclaimer && (
                  <p className="text-xs text-white/40 text-center max-w-xl mx-auto px-4">
                    {plan.disclaimer}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </PhaseGate>
  );
}
