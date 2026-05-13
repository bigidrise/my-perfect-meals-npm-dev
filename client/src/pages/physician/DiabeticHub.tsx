import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  Target,
  TrendingUp,
  ChefHat,
  Home,
  Utensils,
  Leaf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSaveDiabetesProfile,
  useLogGlucose,
  useGlucoseLogs,
  useDiabetesProfile,
} from "@/hooks/useDiabetes";
import { useToast } from "@/hooks/use-toast";
import { GLUCOSE_THRESHOLDS } from "@/content/diabetesEducation";
import { DIABETIC_PRESETS } from "@/data/diabeticPresets";
import type { GlucoseContext } from "@/hooks/useDiabetes";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { PillButton } from "@/components/ui/pill-button";
import { GlucoseGuardExplainerModal } from "@/components/GlucoseGuardExplainerModal";
import { GlycemicSettingsModal } from "@/components/diabetic/GlycemicSettingsModal";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { GLP1CompanionModal } from "@/components/diabetic/GLP1CompanionModal";

const DIABETIC_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Set Your Guardrails",
    description: "Choose a clinical preset or customize your glucose targets, carb limits, and fiber goals."
  },
  {
    icon: "2",
    title: "Log Your Readings",
    description: "Track your glucose readings before and after meals to monitor your progress."
  },
  {
    icon: "3",
    title: "View Your Analytics",
    description: "See your 7-day trends and time-in-range percentage at a glance."
  },
  {
    icon: "4",
    title: "Get Smart Snacks",
    description: "Browse diabetic-friendly snacks designed to keep your blood sugar stable."
  }
];

function getDeviceId(): string {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

export default function DiabeticHub() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id?.toString() || getDeviceId();
  const quickTour = useQuickTour("diabetic-hub");

  // Hooks
  const saveMutation = useSaveDiabetesProfile();
  const logMutation = useLogGlucose();
  const { data: glucoseLogs } = useGlucoseLogs(userId, 50); // Fetch last 50 readings for 7-day analytics
  const { data: profile } = useDiabetesProfile(userId);

  // ── Phase 3: Context fields ───────────────────────────────────────────────
  const [diabetesType, setDiabetesType] = useState<"T1D" | "T2D" | "PRE_D" | "NONE">("NONE");
  const [a1cValue, setA1cValue] = useState("");
  const [hypoRisk, setHypoRisk] = useState(false);
  const [hasCustomizedGuardrails, setHasCustomizedGuardrails] = useState(false);

  // ── Guardrail state (hydrated from server) ────────────────────────────────
  const [glucoseReading, setGlucoseReading] = useState("");
  const [glucoseContext, setGlucoseContext] =
    useState<GlucoseContext>("PRE_MEAL");
  const [fastingMin, setFastingMin] = useState("80");
  const [fastingMax, setFastingMax] = useState("120");
  const [postMealMax, setPostMealMax] = useState("140");
  const [dailyCarbLimit, setDailyCarbLimit] = useState("120");
  const [fiberMin, setFiberMin] = useState("25");
  const [giCap, setGiCap] = useState("55");
  const [mealFrequency, setMealFrequency] = useState("4");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [showGlucoseExplainer, setShowGlucoseExplainer] = useState(false);
  const [showGlycemicModal, setShowGlycemicModal] = useState(false);
  const [showGlp1Companion, setShowGlp1Companion] = useState(false);

  const isGlp1Active = !!(
    (user?.medicalConditions as string[] | undefined)?.includes("glp1") ||
    (user?.healthConditions as string[] | undefined)?.includes("glp1") ||
    user?.selectedMealBuilder === "glp1" ||
    user?.preferredBuilder === "glp1"
  );

  // Auto-mark info as seen since Copilot provides guidance now
  useEffect(() => {
    if (!localStorage.getItem("diabetic-hub-info-seen")) {
      localStorage.setItem("diabetic-hub-info-seen", "true");
    }
  }, []);

  // Auto-hydrate all context + guardrails from server on mount
  useEffect(() => {
    if (!profile?.data) return;
    const p = profile.data;
    // Context fields
    if (p.type && p.type !== "NONE") setDiabetesType(p.type as "T1D" | "T2D" | "PRE_D");
    if (p.a1cPercent) setA1cValue(String(p.a1cPercent));
    if (p.hypoHistory) setHypoRisk(!!p.hypoHistory);
    // Guardrails
    if (p.guardrails) {
      const g = p.guardrails;
      if (g.fastingMin) setFastingMin(String(g.fastingMin));
      if (g.fastingMax) setFastingMax(String(g.fastingMax));
      if (g.postMealMax) setPostMealMax(String(g.postMealMax));
      if (g.carbLimit) setDailyCarbLimit(String(g.carbLimit));
      if (g.fiberMin) setFiberMin(String(g.fiberMin));
      if (g.giCap) setGiCap(String(g.giCap));
      if (g.mealFrequency) setMealFrequency(String(g.mealFrequency));
      // Mark as already customized so type switching won't overwrite
      setHasCustomizedGuardrails(true);
    }
  }, [profile?.data]);

  // Get latest reading for display
  const latestReading = glucoseLogs?.data?.[0];
  const lastValue = latestReading?.valueMgdl || 95;
  const targetMin = parseInt(fastingMin) || GLUCOSE_THRESHOLDS.PRE_MEAL_MIN;
  const targetMax = parseInt(fastingMax) || GLUCOSE_THRESHOLDS.PRE_MEAL_MAX;
  const inRange = lastValue >= targetMin && lastValue <= targetMax;

  // ── Phase 3: Type change — applies defaults ONCE unless already customized ──
  const handleTypeChange = (type: "T1D" | "T2D" | "PRE_D") => {
    setDiabetesType(type);
    if (!hasCustomizedGuardrails) {
      if (type === "T1D") {
        setFastingMin("80"); setFastingMax("110");
        setPostMealMax("130"); setDailyCarbLimit("90");
        setFiberMin("30"); setGiCap("50"); setMealFrequency("5");
      } else if (type === "T2D") {
        setFastingMin("80"); setFastingMax("120");
        setPostMealMax("140"); setDailyCarbLimit("120");
        setFiberMin("25"); setGiCap("55"); setMealFrequency("4");
      } else if (type === "PRE_D") {
        setFastingMin("80"); setFastingMax("125");
        setPostMealMax("150"); setDailyCarbLimit("150");
        setFiberMin("25"); setGiCap("60"); setMealFrequency("4");
      }
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveGuardrails = async () => {
    // Validation before save
    const carbNum = parseInt(dailyCarbLimit);
    const freqNum = parseInt(mealFrequency);
    const fastMinNum = parseInt(fastingMin);
    const fastMaxNum = parseInt(fastingMax);
    const postMaxNum = parseInt(postMealMax);

    if (!carbNum || carbNum < 30 || carbNum > 400) {
      toast({ title: "Daily carb limit must be between 30–400g", variant: "destructive" });
      return;
    }
    if (!freqNum || freqNum < 2 || freqNum > 8) {
      toast({ title: "Meal frequency must be 2–8 per day", variant: "destructive" });
      return;
    }
    if (!fastMinNum || !fastMaxNum || fastMinNum >= fastMaxNum) {
      toast({ title: "Fasting range: min must be less than max", variant: "destructive" });
      return;
    }
    if (!postMaxNum || postMaxNum < fastMaxNum) {
      toast({ title: "Post-meal max must be greater than fasting max", variant: "destructive" });
      return;
    }

    try {
      await saveMutation.mutateAsync({
        userId,
        type: diabetesType === "NONE" ? "T2D" : diabetesType,
        hypoHistory: hypoRisk,
        a1cPercent: a1cValue ? parseFloat(a1cValue) : undefined,
        guardrails: {
          fastingMin: fastMinNum,
          fastingMax: fastMaxNum,
          postMealMax: postMaxNum,
          carbLimit: carbNum,
          fiberMin: parseInt(fiberMin) || 25,
          giCap: parseInt(giCap) || 55,
          mealFrequency: freqNum,
        },
      });
      setSelectedPreset("");
      setHasCustomizedGuardrails(true);
      toast({ title: "Guardrails saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save guardrails", variant: "destructive" });
    }
  };

  const handleLogGlucose = async () => {
    if (!glucoseReading) {
      toast({ title: "Please enter a reading", variant: "destructive" });
      return;
    }

    try {
      console.log("[GlucoseLog] Attempting to log:", {
        userId,
        valueMgdl: parseInt(glucoseReading),
        context: glucoseContext,
      });
      
      await logMutation.mutateAsync({
        userId,
        valueMgdl: parseInt(glucoseReading),
        context: glucoseContext,
        recordedAt: new Date().toISOString(),
      });
      setGlucoseReading("");
      toast({ title: "Reading logged successfully" });
    } catch (error: any) {
      console.error("[GlucoseLog] Failed to log reading:", error);
      const errorMsg = error?.message || error?.body || "Unknown error";
      toast({ 
        title: "Failed to log reading", 
        description: errorMsg.slice(0, 100),
        variant: "destructive" 
      });
    }
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = DIABETIC_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setFastingMin(String(preset.guardrails.fastingMin));
    setFastingMax(String(preset.guardrails.fastingMax));
    setPostMealMax(String(preset.guardrails.postMealMax));
    setDailyCarbLimit(String(preset.guardrails.carbLimit));
    setFiberMin(String(preset.guardrails.fiberMin));
    setGiCap(String(preset.guardrails.giCap));
    setMealFrequency(String(preset.guardrails.mealFrequency));
    setSelectedPreset(presetId);

    toast({
      title: `Applied ${preset.name}`,
      description: preset.description,
    });
  };

        return (
          <>
            <div
              className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 relative"
              style={{ paddingBottom: "var(--safe-bottom)" }}
            >
        {/* Enhanced Glass Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/10 pointer-events-none" />

        {/* Universal Safe-Area Header */}
        <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 flex items-center gap-3">
            <Activity className="h-6 w-6 text-orange-500" />

            {/* Title */}
            <h1 className="text-lg font-bold text-white">Diabetic Hub</h1>

            <div className="flex-grow" />

            {/* Pill Buttons */}
            <div className="flex items-center gap-2">
              <MedicalSourcesInfo asPillButton />
              <QuickTourButton onClick={quickTour.openTour} />
            </div>
          </div>
        </div>
        </MobileHeaderGuard>

        {/* Main Content */}
        <div
          className="max-w-6xl mx-auto px-4 space-y-8 pb-24"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          {/* ── Copilot Banner — adapts to diabetes type ── */}
          <div className="rounded-xl border-l-[3px] border-teal-500/60 bg-teal-500/5 px-4 py-3 space-y-1.5">
            <p className="text-sm text-white/80 leading-relaxed">
              This hub makes sure every meal you get is safe for your goals — carb limits, glucose patterns, and safe ranges applied automatically.
            </p>
            <p className="text-sm text-white/50 leading-relaxed">
              {diabetesType === "T1D"
                ? "Focus on consistency above all. Even small carb swings can affect your range — your meals are built to minimize variability."
                : diabetesType === "T2D"
                ? "Your meals are built around controlled carb reduction. Steady patterns over time are what move the needle."
                : diabetesType === "PRE_D"
                ? "You're in prevention mode. Your meals are designed to keep blood sugar stable and reduce long-term risk."
                : "Stay consistent with your logs. The system adjusts your meals to keep your blood sugar stable."}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {["Carb Guardrails", "Glucose Trends", "Meal Decisions"].map(chip => (
                <span key={chip} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300">
                  {chip}
                </span>
              ))}
              {isGlp1Active && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300">
                  GLP-1 Active
                </span>
              )}
            </div>
            {isGlp1Active && (
              <div className="flex items-center gap-3 pt-1.5">
                <p className="text-[11px] text-orange-400/70 leading-relaxed">
                  GLP-1 guardrails (portion caps, protein floors, nausea-safe ingredients) are stacked with your diabetic protocol.
                </p>
                <div className="shrink-0">
                  <PillButton
                    onClick={() => setShowGlp1Companion(true)}
                    variant="default"
                  >
                    Manage GLP-1
                  </PillButton>
                </div>
              </div>
            )}
            <p className="text-[11px] text-white/30 pt-0.5">
              Your meal builders automatically use these settings.
            </p>
          </div>

          {/* Doctor / Coach Guardrail Card */}
          <section className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 mb-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Doctor / Coach Guardrails
                </h2>
                <p className="text-white/80 text-md">
                  Set your clinical targets and constraints
                </p>
              </div>
            </div>

            {/* ── Phase 3: Diabetes Type Selector ── */}
            <div className="mb-6 relative z-10">
              <label className="block text-sm font-semibold text-white/80 mb-3">
                Diabetes Type
              </label>
              <div className="flex gap-2 flex-wrap">
                {(["T1D", "T2D", "PRE_D"] as const).map((t) => {
                  const labels: Record<string, string> = { T1D: "Type 1", T2D: "Type 2", PRE_D: "Pre-Diabetes" };
                  const active = diabetesType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => handleTypeChange(t)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                        active
                          ? "bg-teal-500/25 border-teal-500/60 text-teal-300"
                          : "bg-white/8 border-white/20 text-white/50 hover:bg-white/15 hover:text-white/80"
                      }`}
                    >
                      {labels[t]}
                    </button>
                  );
                })}
              </div>
              {diabetesType !== "NONE" && !hasCustomizedGuardrails && (
                <p className="text-[11px] text-teal-400/60 mt-2">
                  Default guardrails for {diabetesType === "PRE_D" ? "Pre-Diabetes" : diabetesType} applied — customize below, then save.
                </p>
              )}
            </div>

            {/* ── Phase 3: A1C + Hypo Risk ── */}
            <div className="mb-6 relative z-10 grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-1.5">
                  A1C (optional)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="3"
                  max="15"
                  value={a1cValue}
                  onChange={(e) => setA1cValue(e.target.value)}
                  placeholder="e.g. 6.5"
                  className="w-full px-3 py-2 rounded-xl bg-white/20 border border-white/40 text-white placeholder-white/40 focus:outline-none focus:border-teal-400/60"
                />
                <p className="text-[11px] text-white/35 mt-1">
                  If you know your A1C, you can enter it here. This helps personalize your plan.
                </p>
              </div>
              <div className="flex flex-col justify-start pt-1">
                <label className="block text-sm font-semibold text-white/80 mb-3">
                  Low Blood Sugar Risk
                </label>
                <button
                  onClick={() => setHypoRisk(!hypoRisk)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium w-full ${
                    hypoRisk
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : "bg-white/8 border-white/20 text-white/50 hover:bg-white/12"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${
                    hypoRisk ? "bg-amber-500 border-amber-400" : "border-white/40"
                  }`}>
                    {hypoRisk && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  History of low blood sugar (hypoglycemia)
                </button>
                {hypoRisk && (
                  <p className="text-[11px] text-amber-400/60 mt-1.5 px-1">
                    Meals will include a minimum carb floor to reduce hypoglycemia risk.
                  </p>
                )}
              </div>
            </div>

            <div className="mb-6 relative z-10">
              <label className="block text-md text-white mb-2">
                Apply Clinical Preset
              </label>
              <Select value={selectedPreset} onValueChange={handleApplyPreset}>
                <SelectTrigger className="w-full bg-white/20 border-white/40 text-white [&>span]:text-white">
                  <SelectValue placeholder="Choose a preset or customize below..." />
                </SelectTrigger>
                <SelectContent>
                  {DIABETIC_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPreset && (
                <p className="text-white/70 text-xs mt-2">
                  {
                    DIABETIC_PRESETS.find((p) => p.id === selectedPreset)
                      ?.description
                  }
                </p>
              )}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10 mb-6">
              <div>
                <label className="block text-md text-white mb-2">
                  Fasting Range (mg/dL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={fastingMin}
                    onChange={(e) => setFastingMin(e.target.value)}
                    placeholder="Min"
                    className="w-full px-3 py-2 rounded-xl bg-white/20 border border-white/40 text-white placeholder-white/60 focus:outline-none focus:border-orange-300"
                  />
                  <input
                    type="number"
                    value={fastingMax}
                    onChange={(e) => setFastingMax(e.target.value)}
                    placeholder="Max"
                    className="w-full px-3 py-2 rounded-xl bg-white/20 border border-white/40 text-white placeholder-white/60 focus:outline-none focus:border-orange-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-md text-white mb-2">
                  Post-Meal Max (mg/dL)
                </label>
                <input
                  type="number"
                  value={postMealMax}
                  onChange={(e) => setPostMealMax(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/20 border border-white/40 text-white placeholder-white/60 focus:outline-none focus:border-orange-300"
                />
              </div>

              <div>
                <label className="block text-md text-white mb-2">
                  Daily Carb Limit (g)
                </label>
                <input
                  type="number"
                  value={dailyCarbLimit}
                  onChange={(e) => setDailyCarbLimit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/20 border border-white/40 text-white placeholder-white/60 focus:outline-none focus:border-orange-300"
                />
              </div>

              <div>
                <label className="block text-md text-white mb-2">
                  Fiber Minimum (g)
                </label>
                <input
                  type="number"
                  value={fiberMin}
                  onChange={(e) => setFiberMin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/20 border border-white/40 text-white placeholder-white/60 focus:outline-none focus:border-orange-300"
                />
              </div>

              <div>
                <label className="block text-md text-white mb-2">
                  GI Cap (Max)
                </label>
                <input
                  type="number"
                  value={giCap}
                  onChange={(e) => setGiCap(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/20 border border-white/40 text-white placeholder-white/60 focus:outline-none focus:border-orange-300"
                />
              </div>

              <div>
                <label className="block text-md text-white mb-2">
                  Meal Frequency (per day)
                </label>
                <input
                  type="number"
                  value={mealFrequency}
                  onChange={(e) => setMealFrequency(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/20 border border-white/40 text-white placeholder-white/60 focus:outline-none focus:border-orange-300"
                />
              </div>
            </div>

            <button
              onClick={handleSaveGuardrails}
              disabled={saveMutation.isPending}
              className="w-full px-6 py-3 rounded-xl bg-lime-900 backdrop-blur-sm hover:bg-lime-500 text-white font-medium transition-all shadow-xl relative overflow-hidden disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 pointer-events-none" />
              <span className="relative z-10">
                {saveMutation.isPending ? "Saving..." : "Save Guardrails"}
              </span>
            </button>

            <button
              onClick={() => setShowGlycemicModal(true)}
              className="w-full mt-3 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-medium transition-all border border-white/20 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-white/5 pointer-events-none" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Leaf className="h-4 w-4 text-green-400" />
                Manage Glycemic Preferences
              </span>
            </button>
          </section>

          {/* Blood Sugar Tracker */}
          <section className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 mb-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg">
                <Activity className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Blood Sugar Tracker
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6 relative z-10">
              <div className="space-y-4">
                <div>
                  <label className="block text-md text-white mb-2">
                    Glucose Reading (mg/dL)
                  </label>
                  <input
                    type="number"
                    value={glucoseReading}
                    onChange={(e) => setGlucoseReading(e.target.value)}
                    placeholder="Enter reading..."
                    className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/40 text-white placeholder-white/60 focus:outline-none focus:border-orange-300"
                  />
                </div>

                <div>
                  <label className="block text-md text-white mb-2">
                    Context
                  </label>
                  <Select
                    value={glucoseContext}
                    onValueChange={(val) =>
                      setGlucoseContext(val as GlucoseContext)
                    }
                  >
                    <SelectTrigger className="w-full bg-white/20 border-white/40 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FASTED">Fasting</SelectItem>
                      <SelectItem value="PRE_MEAL">Pre-Meal</SelectItem>
                      <SelectItem value="POST_MEAL_1H">Post-Meal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <button
                  onClick={handleLogGlucose}
                  disabled={logMutation.isPending}
                  className="w-full px-6 py-4 rounded-xl bg-lime-900 backdrop-blur-sm hover:bg-lime-500 text-md text-white font-semi-bold transition-all shadow-xl relative overflow-hidden disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 pointer-events-none" />
                  <span className="relative z-10">
                    {logMutation.isPending ? "Logging..." : "Log Reading"}
                  </span>
                </button>
              </div>

              <div className="bg-orange-500/20 backdrop-blur-sm rounded-xl p-6 border border-orange-400/30">
                <div className="text-white font-medium text-md mb-2">
                  Last Reading
                </div>
                <div className="text-xl font-medium text-white mb-2">
                  {latestReading ? `${lastValue} mg/dL` : "No readings yet"}
                </div>
                {latestReading && (
                  <>
                    <div
                      className={`text-md mb-3 ${inRange ? "text-green-200" : "text-yellow-200"}`}
                    >
                      {inRange ? "✅ In Target Range" : "⚠️ Outside Target"}
                    </div>
                    {glucoseLogs?.data && glucoseLogs.data.length > 1 && (
                      <div className="text-white/80 text-md mb-2">
                        7-Day Avg:{" "}
                        {Math.round(
                          glucoseLogs.data
                            .slice(0, 7)
                            .reduce(
                              (sum: number, log: any) => sum + log.valueMgdl,
                              0,
                            ) / Math.min(7, glucoseLogs.data.length),
                        )}{" "}
                        mg/dL
                      </div>
                    )}
                  </>
                )}
                <div className="text-white/80 text-base mt-2">
                  Target: {targetMin}-{targetMax} mg/dL
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-xs">
                      GlucoseGuard™ adjusts meals to this reading
                    </span>
                    <PillButton
                      onClick={() => setShowGlucoseExplainer(true)}
                      variant="amber"
                    >
                      How It Works
                    </PillButton>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Divider */}

          {/* 7-Day Glucose Trend */}
          <section className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 mb-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-white shadow-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white">
                7-Day Glucose Trend
              </h2>
            </div>

            {glucoseLogs?.data && glucoseLogs.data.length > 0 ? (
              <div className="space-y-4 relative z-10">
                {/* Visual Chart */}
                <div className="h-64 bg-yellow-500/10 backdrop-blur-sm rounded-xl border border-yellow-400/30 p-4 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-end justify-around px-4 pb-4">
                    {glucoseLogs.data
                      .slice(0, 7)
                      .reverse()
                      .map((log: any, index: number) => {
                        const maxHeight = 240;
                        const minValue = 50;
                        const maxValue = 250;
                        const normalizedHeight =
                          ((log.valueMgdl - minValue) / (maxValue - minValue)) *
                          maxHeight;
                        const height = Math.max(
                          20,
                          Math.min(normalizedHeight, maxHeight),
                        );
                        const isInRange =
                          log.valueMgdl >= targetMin &&
                          log.valueMgdl <= targetMax;

                        return (
                          <div
                            key={index}
                            className="flex flex-col items-center gap-2"
                            style={{ width: "12%" }}
                          >
                            <div className="text-white text-xs font-semibold">
                              {log.valueMgdl}
                            </div>
                            <div
                              className={`w-full rounded-t-lg transition-all ${
                                isInRange ? "bg-green-500" : "bg-orange-500"
                              }`}
                              style={{ height: `${height}px` }}
                            />
                            <div className="text-white/60 text-xs text-center">
                              {new Date(log.recordedAt).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-emerald-500/20 backdrop-blur-sm rounded-xl p-4 border border-emerald-400/30">
                    <div className="text-emerald-200 text-xs mb-1">
                      7-Day Average
                    </div>
                    <div className="text-white text-lg font-semi-bold">
                      {Math.round(
                        glucoseLogs.data
                          .slice(0, 7)
                          .reduce(
                            (sum: number, log: any) => sum + log.valueMgdl,
                            0,
                          ) / Math.min(7, glucoseLogs.data.length),
                      )}{" "}
                      mg/dL
                    </div>
                  </div>

                  <div className="bg-blue-500/20 backdrop-blur-sm rounded-xl p-4 border border-blue-400/30">
                    <div className="text-blue-200 text-xs mb-1">
                      Target Range
                    </div>
                    <div className="text-white text-lg font-semi-bold">
                      {targetMin}-{targetMax} mg/dL
                    </div>
                  </div>

                  <div className="bg-purple-500/20 backdrop-blur-sm rounded-xl p-4 border border-purple-400/30">
                    <div className="text-purple-200 text-xs mb-1">In Range</div>
                    <div className="text-white text-lg font-semi-bold">
                      {Math.round(
                        (glucoseLogs.data
                          .slice(0, 7)
                          .filter(
                            (log: any) =>
                              log.valueMgdl >= targetMin &&
                              log.valueMgdl <= targetMax,
                          ).length /
                          Math.min(7, glucoseLogs.data.length)) *
                          100,
                      )}
                      %
                    </div>
                  </div>
                </div>

                {/* Recent Readings Table */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
                  <div className="px-4 py-3 bg-white/10 border-b border-white/20">
                    <h3 className="text-white font-semi-bold">
                      Recent Readings
                    </h3>
                  </div>
                  <div className="divide-y divide-white/10">
                    {glucoseLogs.data
                      .slice(0, 7)
                      .map((log: any, index: number) => {
                        const isInRange =
                          log.valueMgdl >= targetMin &&
                          log.valueMgdl <= targetMax;
                        return (
                          <div
                            key={index}
                            className="px-4 py-3 flex justify-between items-center hover:bg-white/5"
                          >
                            <div>
                              <span
                                className={`text-lg font-semi-bold ${isInRange ? "text-green-400" : "text-orange-400"}`}
                              >
                                {log.valueMgdl} mg/dL
                              </span>
                              <span className="text-white/60 text-md ml-2">
                                ({log.context})
                              </span>
                            </div>
                            <div className="text-white/60 text-md">
                              {new Date(log.recordedAt).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 bg-yellow-500/10 backdrop-blur-sm rounded-xl border border-yellow-400/30 flex items-center justify-center relative z-10">
                <div className="text-center text-white/80">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No readings yet</p>
                  <p className="text-md">
                    Log your first glucose reading above to start tracking
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Divider */}

          {/* Divider */}

          {/* AI Meal Generator */}
          <section className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 mb-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <div className="mb-6 relative z-10">
              <h2 className="text-lg font-bold text-white">
                AI Diabetic Meal Generator
              </h2>
              <p className="text-white/80 text-md">
                Low-GI meals based on your guardrails
              </p>
            </div>

            <button
              onClick={() => setLocation("/diabetic-menu-builder")}
              className="w-full px-8 py-4 rounded-xl bg-gradient-to-r from-lime-600 to-lime-600 text-white font-semibold transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 pointer-events-none" />
              <span className="relative z-10"> Diabetic Meal Builder </span>
            </button>
          </section>
        </div>

        {/* Quick Tour Modal */}
        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Diabetic Hub"
          steps={DIABETIC_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />

        {/* GlucoseGuard Explainer Modal */}
        <GlucoseGuardExplainerModal
          isOpen={showGlucoseExplainer}
          onClose={() => setShowGlucoseExplainer(false)}
        />

        <GlycemicSettingsModal
          open={showGlycemicModal}
          onClose={() => setShowGlycemicModal(false)}
        />

        <GLP1CompanionModal
          isOpen={showGlp1Companion}
          onClose={() => setShowGlp1Companion(false)}
        />
      </div>
    </>
  );
}
