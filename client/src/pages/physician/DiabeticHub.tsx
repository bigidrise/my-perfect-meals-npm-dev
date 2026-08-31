import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  Activity,
  Target,
  TrendingUp,
  ChefHat,
  Home,
  Utensils,
  Leaf,
  ChevronRight,
  Dumbbell,
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
import { isClinicalOrAbove } from "@/lib/subscriptionCheck";

function getDeviceId(): string {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

export default function DiabeticHub() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const canAccessTrainingNutrition = isClinicalOrAbove(user);
  const { toast } = useToast();
  const userId = user?.id?.toString() || getDeviceId();
  const quickTour = useQuickTour("diabetic-hub");

  const DIABETIC_TOUR_STEPS = useMemo<TourStep[]>(() => [
    { icon: "1", title: t("diabeticHub.tour1Title"), description: t("diabeticHub.tour1Desc") },
    { icon: "2", title: t("diabeticHub.tour2Title"), description: t("diabeticHub.tour2Desc") },
    { icon: "3", title: t("diabeticHub.tour3Title"), description: t("diabeticHub.tour3Desc") },
    { icon: "4", title: t("diabeticHub.tour4Title"), description: t("diabeticHub.tour4Desc") },
  ], [t]);

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
      toast({ title: t("diabeticHub.validCarbLimit"), variant: "destructive" });
      return;
    }
    if (!freqNum || freqNum < 2 || freqNum > 8) {
      toast({ title: t("diabeticHub.validMealFreq"), variant: "destructive" });
      return;
    }
    if (!fastMinNum || !fastMaxNum || fastMinNum >= fastMaxNum) {
      toast({ title: t("diabeticHub.validFastingRange"), variant: "destructive" });
      return;
    }
    if (!postMaxNum || postMaxNum < fastMaxNum) {
      toast({ title: t("diabeticHub.validPostMeal"), variant: "destructive" });
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
      toast({ title: t("diabeticHub.guardrailsSaved") });
    } catch (error) {
      toast({ title: t("diabeticHub.guardrailsFailed"), variant: "destructive" });
    }
  };

  const handleLogGlucose = async () => {
    if (!glucoseReading) {
      toast({ title: t("diabeticHub.pleaseEnterReading"), variant: "destructive" });
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
      toast({ title: t("diabeticHub.readingLogged") });
    } catch (error: any) {
      console.error("[GlucoseLog] Failed to log reading:", error);
      const errorMsg = error?.message || error?.body || "Unknown error";
      toast({ 
        title: t("diabeticHub.readingLogFailed"), 
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
      title: t("diabeticHub.appliedPreset", { name: preset.name }),
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
            <h1 className="text-lg font-bold text-white break-words leading-tight min-w-0">{t("diabeticHub.pageTitle")}</h1>

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
          {/* ── Quick Launch ── */}
          <button
            onClick={() => setLocation("/diabetic-menu-builder")}
            className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-lime-600/20 border border-lime-500/30 text-white"
          >
            <div className="text-left">
              <p className="font-bold text-sm">{t("diabeticHub.launchBuilder")}</p>
              <p className="text-white/80 text-xs mt-0.5">{t("diabeticHub.launchBuilderSub")}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-lime-400 flex-shrink-0" />
          </button>

          {/* ── Training Nutrition Schedule ── */}
          <button
            hidden={!canAccessTrainingNutrition}
            onClick={() => setLocation("/diabetic/training")}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-orange-600/10 hover:border-orange-500/30 transition-colors text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Dumbbell className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-white leading-tight">{t("diabeticHub.trainingTitle")}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-300 bg-orange-600/20 border border-orange-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                  Clinical
                </span>
              </div>
              <p className="text-white/40 text-xs mt-0.5">{t("diabeticHub.trainingSub")}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-orange-400 transition-colors flex-shrink-0" />
          </button>

          {/* ── Copilot Banner — adapts to diabetes type ── */}
          <div className="rounded-xl border-l-[3px] border-teal-500/60 bg-teal-500/5 px-4 py-3 space-y-1.5">
            <p className="text-sm text-white/80 leading-relaxed">
              {t("diabeticHub.copilotText")}
            </p>
            <p className="text-sm text-white/50 leading-relaxed">
              {diabetesType === "T1D"
                ? t("diabeticHub.copilotT1D")
                : diabetesType === "T2D"
                ? t("diabeticHub.copilotT2D")
                : diabetesType === "PRE_D"
                ? t("diabeticHub.copilotPreD")
                : t("diabeticHub.copilotDefault")}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[t("diabeticHub.chip1"), t("diabeticHub.chip2"), t("diabeticHub.chip3")].map(chip => (
                <span key={chip} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300">
                  {chip}
                </span>
              ))}
              {isGlp1Active && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300">
                  {t("diabeticHub.metabolicMedActive")}
                </span>
              )}
            </div>
            {isGlp1Active && (
              <div className="flex items-center gap-3 pt-1.5">
                <p className="text-[11px] text-orange-400/70 leading-relaxed">
                  {t("diabeticHub.metabolicMedStacked")}
                </p>
                <div className="shrink-0">
                  <PillButton
                    onClick={() => setShowGlp1Companion(true)}
                    variant="default"
                  >
                    {t("diabeticHub.manageMetabolicMed")}
                  </PillButton>
                </div>
              </div>
            )}
            <p className="text-[11px] text-white/30 pt-0.5">
              {t("diabeticHub.autoSettings")}
            </p>
          </div>

          {/* GLP-1 onboarding nudge — shown only when diabetic but GLP-1 not yet activated */}
          {!isGlp1Active && (
            <div className="rounded-xl border border-orange-500/20 bg-orange-950/10 px-4 py-3 flex items-start gap-3">
              <span className="text-orange-400 text-base mt-0.5 shrink-0">💉</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-orange-300 mb-0.5">
                  {t("diabeticHub.glp1NudgeTitle")}
                </p>
                <p className="text-[11px] text-white/50 leading-relaxed mb-2">
                  {t("diabeticHub.glp1NudgeDesc")}
                </p>
                <PillButton
                  onClick={() => setLocation("/profile/edit")}
                  variant="default"
                >
                  {t("diabeticHub.enableMetabolicMed")}
                </PillButton>
              </div>
            </div>
          )}

          {/* Doctor / Coach Guardrail Card */}
          <section className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 mb-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t("diabeticHub.guardrailsTitle")}
                </h2>
                <p className="text-white/80 text-md">
                  {t("diabeticHub.guardrailsDesc")}
                </p>
              </div>
            </div>

            {/* ── Phase 3: Diabetes Type Selector ── */}
            <div className="mb-6 relative z-10">
              <label className="block text-sm font-semibold text-white/80 mb-3">
                {t("diabeticHub.diabetesType")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {(["T1D", "T2D", "PRE_D"] as const).map((typeCode) => {
                  const labels: Record<string, string> = { T1D: t("diabeticHub.typeT1D"), T2D: t("diabeticHub.typeT2D"), PRE_D: t("diabeticHub.typePreD") };
                  const active = diabetesType === typeCode;
                  return (
                    <button
                      key={typeCode}
                      onClick={() => handleTypeChange(typeCode)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                        active
                          ? "bg-teal-500/25 border-teal-500/60 text-teal-300"
                          : "bg-white/8 border-white/20 text-white/50 hover:bg-white/15 hover:text-white/80"
                      }`}
                    >
                      {labels[typeCode]}
                    </button>
                  );
                })}
              </div>
              {diabetesType !== "NONE" && !hasCustomizedGuardrails && (
                <p className="text-[11px] text-teal-400/60 mt-2">
                  {t("diabeticHub.defaultGuardrailsHint", { type: diabetesType === "PRE_D" ? t("diabeticHub.typePreD") : diabetesType })}
                </p>
              )}
            </div>

            {/* ── Phase 3: A1C + Hypo Risk ── */}
            <div className="mb-6 relative z-10 grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-1.5">
                  {t("diabeticHub.a1cLabel")}
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
                  {t("diabeticHub.a1cHint")}
                </p>
              </div>
              <div className="flex flex-col justify-start pt-1">
                <label className="block text-sm font-semibold text-white/80 mb-3">
                  {t("diabeticHub.hypoRiskLabel")}
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
                  {t("diabeticHub.hypoRiskCheck")}
                </button>
                {hypoRisk && (
                  <p className="text-[11px] text-amber-400/60 mt-1.5 px-1">
                    {t("diabeticHub.hypoRiskHint")}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-6 relative z-10">
              <label className="block text-md text-white mb-2">
                {t("diabeticHub.applyClinicalPreset")}
              </label>
              <Select value={selectedPreset} onValueChange={handleApplyPreset}>
                <SelectTrigger className="w-full bg-white/20 border-white/40 text-white [&>span]:text-white">
                  <SelectValue placeholder={t("diabeticHub.presetPlaceholder")} />
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
                  {t("diabeticHub.fastingRange")}
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
                  {t("diabeticHub.postMealMax")}
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
                  {t("diabeticHub.dailyCarbLimit")}
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
                  {t("diabeticHub.fiberMinimum")}
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
                  {t("diabeticHub.giCap")}
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
                  {t("diabeticHub.mealFrequency")}
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
                {saveMutation.isPending ? t("diabeticHub.saving") : t("diabeticHub.saveGuardrails")}
              </span>
            </button>

            <button
              onClick={() => setShowGlycemicModal(true)}
              className="w-full mt-3 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-medium transition-all border border-white/20 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-white/5 pointer-events-none" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Leaf className="h-4 w-4 text-green-400" />
                {t("diabeticHub.manageGlycemic")}
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
              <h2 className="text-lg font-bold text-white min-w-0 break-words">
                {t("diabeticHub.bloodSugarTracker")}
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6 relative z-10">
              <div className="space-y-4">
                <div>
                  <label className="block text-md text-white mb-2">
                    {t("diabeticHub.glucoseReadingLabel")}
                  </label>
                  <input
                    type="number"
                    value={glucoseReading}
                    onChange={(e) => setGlucoseReading(e.target.value)}
                    placeholder={t("diabeticHub.enterReading")}
                    className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/40 text-white placeholder-white/60 focus:outline-none focus:border-orange-300"
                  />
                </div>

                <div>
                  <label className="block text-md text-white mb-2">
                    {t("diabeticHub.contextLabel")}
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
                      <SelectItem value="FASTED">{t("diabeticHub.fasting")}</SelectItem>
                      <SelectItem value="PRE_MEAL">{t("diabeticHub.preMeal")}</SelectItem>
                      <SelectItem value="POST_MEAL_1H">{t("diabeticHub.postMeal1H")}</SelectItem>
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
                    {logMutation.isPending ? t("diabeticHub.logging") : t("diabeticHub.logReading")}
                  </span>
                </button>
              </div>

              <div className="bg-orange-500/20 backdrop-blur-sm rounded-xl p-6 border border-orange-400/30">
                <div className="text-white font-medium text-md mb-2">
                  {t("diabeticHub.lastReading")}
                </div>
                <div className="text-xl font-medium text-white mb-2">
                  {latestReading ? `${lastValue} mg/dL` : t("diabeticHub.noReadingsYet")}
                </div>
                {latestReading && (
                  <>
                    <div
                      className={`text-md mb-3 ${inRange ? "text-green-200" : "text-yellow-200"}`}
                    >
                      {inRange ? t("diabeticHub.inTargetRange") : t("diabeticHub.outsideTarget")}
                    </div>
                    {glucoseLogs?.data && glucoseLogs.data.length > 1 && (
                      <div className="text-white/80 text-md mb-2">
                        {t("diabeticHub.sevenDayAvg")}{" "}
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
                  {t("diabeticHub.targetLabel")} {targetMin}-{targetMax} mg/dL
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-xs">
                      {t("diabeticHub.glucoseGuardNote")}
                    </span>
                    <PillButton
                      onClick={() => setShowGlucoseExplainer(true)}
                      variant="amber"
                    >
                      {t("diabeticHub.howItWorks")}
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
                {t("diabeticHub.sevenDayTrend")}
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

          {/* Meal Memory Info Banner */}
          <section className="bg-black/20 backdrop-blur-lg rounded-2xl border border-lime-700/30 px-6 py-5 mb-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-2 h-2 rounded-full bg-lime-400 shrink-0 mt-1.5" />
              <p className="text-white/70 text-sm leading-relaxed">
                Meals generated by the Diabetic Builder remember the glucose context that was used to create them.
                Save meals you enjoy and My Perfect Meals will help you quickly find options that match similar glucose situations in the future.
              </p>
            </div>
          </section>

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
              className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-lime-600/20 border border-lime-500/30 text-white"
            >
              <div className="text-left">
                <p className="font-bold text-sm">Launch Diabetic Builder</p>
                <p className="text-white/80 text-xs mt-0.5">Low-GI meals built for your glucose guardrails</p>
              </div>
              <ChevronRight className="w-5 h-5 text-lime-400 flex-shrink-0" />
            </button>
          </section>
        </div>

        {/* Quick Tour Modal */}
        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title={t("diabeticHub.tourTitle")}
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
