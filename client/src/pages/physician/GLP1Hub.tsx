import React, { useEffect, useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Activity,
  Pill,
  Dumbbell,
} from "lucide-react";
import { useGLP1Profile, useSaveGLP1Profile } from "@/hooks/useGLP1";
import { useToast } from "@/hooks/use-toast";
import { glp1Presets } from "@/data/glp1Presets";
import ShotTrackerPanel from "@/pages/glp1/ShotTrackerPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import GLP1DailyCheckin from "@/components/glp1/GLP1DailyCheckin";
import ProtocolStatusBadge from "@/components/ProtocolStatusBadge";
import { isClinicalOrAbove } from "@/lib/subscriptionCheck";

export default function GLP1Hub() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [noteOpen, setNoteOpen] = useState(false);
  const [shotTrackerOpen, setShotTrackerOpen] = useState(false);
  const { user } = useAuth();
  const canAccessTrainingNutrition = isClinicalOrAbove(user);
  const quickTour = useQuickTour("glp1-hub");

  const GLP1_TOUR_STEPS = useMemo<TourStep[]>(() => [
    { icon: "1", title: t("glp1Hub.tour1Title"), description: t("glp1Hub.tour1Desc") },
    { icon: "2", title: t("glp1Hub.tour2Title"), description: t("glp1Hub.tour2Desc") },
    { icon: "3", title: t("glp1Hub.tour3Title"), description: t("glp1Hub.tour3Desc") },
    { icon: "4", title: t("glp1Hub.tour4Title"), description: t("glp1Hub.tour4Desc") },
  ], [t]);

  // Fetch and mutate state for GLP-1 profile (local-first)
  const { data: profile, updateGuardrails, syncStatus } = useGLP1Profile();
  const saveMutation = useSaveGLP1Profile(updateGuardrails);
  const { toast } = useToast();

  // Initialize form fields directly from profile (local-first = always has data)
  const [maxMealVolume, setMaxMealVolume] = useState<number | undefined>(
    () => profile?.guardrails?.maxMealVolumeMl,
  );
  const [proteinMin, setProteinMin] = useState<number | undefined>(
    () => profile?.guardrails?.proteinMinG,
  );
  const [fatMax, setFatMax] = useState<number | undefined>(
    () => profile?.guardrails?.fatMaxG,
  );
  const [fiberMin, setFiberMin] = useState<number | undefined>(
    () => profile?.guardrails?.fiberMinG,
  );
  const [hydrationGoal, setHydrationGoal] = useState<number | undefined>(
    () => profile?.guardrails?.hydrationMinMl,
  );
  const [mealsPerDay, setMealsPerDay] = useState<number | undefined>(
    () => profile?.guardrails?.mealsPerDay,
  );
  const [slowDigestFoodsOnly, setSlowDigestFoodsOnly] = useState<boolean>(
    () => profile?.guardrails?.slowDigestOnly ?? false,
  );
  const [limitCarbonation, setLimitCarbonation] = useState<boolean>(
    () => profile?.guardrails?.limitCarbonation ?? false,
  );
  const [limitAlcohol, setLimitAlcohol] = useState<boolean>(
    () => profile?.guardrails?.limitAlcohol ?? false,
  );
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const hasHydratedFromServer = useRef(false);

  useEffect(() => {
    document.title = `${t("glp1Hub.pageTitle")} | My Perfect Meals`;
    if (!localStorage.getItem("glp1-hub-info-seen")) {
      localStorage.setItem("glp1-hub-info-seen", "true");
    }
  }, []);

  // Only hydrate from server sync ONCE when it completes (not on every render)
  useEffect(() => {
    if (syncStatus === "synced" && !hasHydratedFromServer.current && profile?.guardrails) {
      hasHydratedFromServer.current = true;
      setMaxMealVolume(profile.guardrails.maxMealVolumeMl);
      setProteinMin(profile.guardrails.proteinMinG);
      setFatMax(profile.guardrails.fatMaxG);
      setFiberMin(profile.guardrails.fiberMinG);
      setHydrationGoal(profile.guardrails.hydrationMinMl);
      setMealsPerDay(profile.guardrails.mealsPerDay);
      setSlowDigestFoodsOnly(profile.guardrails.slowDigestOnly ?? false);
      setLimitCarbonation(profile.guardrails.limitCarbonation ?? false);
      setLimitAlcohol(profile.guardrails.limitAlcohol ?? false);
    }
  }, [syncStatus, profile]);

  const handlePresetSelect = (presetId: string) => {
    const preset = glp1Presets.find((p) => p.id === presetId);
    if (preset) {
      setMaxMealVolume(preset.values.maxMealVolumeMl);
      setProteinMin(preset.values.proteinMinG);
      setFatMax(preset.values.fatMaxG);
      setFiberMin(preset.values.fiberMinG);
      setHydrationGoal(preset.values.hydrationMinMl);
      setMealsPerDay(preset.values.mealsPerDay);
      setSlowDigestFoodsOnly(preset.values.slowDigestOnly ?? false);
      setLimitCarbonation(preset.values.limitCarbonation ?? false);
      setLimitAlcohol(preset.values.limitAlcohol ?? false);
    }
    setSelectedPreset(presetId);
  };

  const handleSave = async () => {
    const sanitizedGuardrails = {
      maxMealVolumeMl: typeof maxMealVolume === "number" ? maxMealVolume : profile?.guardrails?.maxMealVolumeMl,
      proteinMinG: typeof proteinMin === "number" ? proteinMin : profile?.guardrails?.proteinMinG,
      fatMaxG: typeof fatMax === "number" ? fatMax : profile?.guardrails?.fatMaxG,
      fiberMinG: typeof fiberMin === "number" ? fiberMin : profile?.guardrails?.fiberMinG,
      hydrationMinMl: typeof hydrationGoal === "number" ? hydrationGoal : profile?.guardrails?.hydrationMinMl,
      mealsPerDay: typeof mealsPerDay === "number" ? mealsPerDay : profile?.guardrails?.mealsPerDay,
      slowDigestOnly: slowDigestFoodsOnly,
      limitCarbonation,
      limitAlcohol,
    };
    saveMutation.mutate(sanitizedGuardrails);
    toast({
      title: t("glp1Hub.toastSavedTitle"),
      description: t("glp1Hub.toastSavedDesc"),
    });
  };

  return (
      <div
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 relative"
        style={{ paddingBottom: "var(--safe-bottom)" }}
>
      {/* Universal Safe-Area Header */}
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 pb-3 flex items-center gap-3 flex-nowrap">
          <Pill className="h-6 w-6 text-orange-500 flex-shrink-0" />
          {/* Title */}
          <h1 className="text-lg font-bold text-white break-words leading-tight min-w-0">
            {t("glp1Hub.pageTitle")}
          </h1>

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
        className="max-w-2xl mx-auto px-4 space-y-6 pb-16"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* ── Protocol Status ── */}
        <ProtocolStatusBadge className="mb-2" />

        {/* ── Daily Symptom Check-In ── */}
        <GLP1DailyCheckin />

        {/* ── Quick Launch ── */}
        <button
          onClick={() => setLocation("/glp1-meal-builder")}
          className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-lime-600/20 border border-lime-500/30 text-white"
        >
          <div className="text-left">
            <p className="font-bold text-sm">{t("glp1Hub.launchBuilder")}</p>
            <p className="text-white/80 text-xs mt-0.5">{t("glp1Hub.launchBuilderSub")}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-lime-400 flex-shrink-0" />
        </button>

        {/* ── Training Nutrition Schedule ── */}
        <button
          hidden={!canAccessTrainingNutrition}
          onClick={() => setLocation("/glp1/training")}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-orange-600/10 hover:border-orange-500/30 transition-colors text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
            <Dumbbell className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-white leading-tight">{t("glp1Hub.trainingTitle")}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-300 bg-orange-600/20 border border-orange-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                Clinical
              </span>
            </div>
            <p className="text-white/40 text-xs mt-0.5">{t("glp1Hub.trainingSub")}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-orange-400 transition-colors flex-shrink-0" />
        </button>

        {/* ── Copilot Banner ── */}
        <div className="rounded-xl border-l-[3px] border-purple-500/60 bg-purple-500/5 px-4 py-3 space-y-1.5">
          <p className="text-sm text-white/80 leading-relaxed">
            {t("glp1Hub.copilotText")}
          </p>
          <p className="text-sm text-white/50 leading-relaxed">
            {t("glp1Hub.copilotSub")}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {[t("glp1Hub.chip1"), t("glp1Hub.chip2"), t("glp1Hub.chip3")].map(chip => (
              <span key={chip} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                {chip}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-white/30 pt-0.5">
            {t("glp1Hub.autoSettings")}
          </p>
        </div>

        {/* Important Medical Note Dropdown */}
        <section className="bg-black/40 backdrop-blur-lg border border-purple-300/30 rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={() => setNoteOpen(!noteOpen)}
            className="w-full p-4 flex items-center justify-between text-white hover:bg-white/5 transition-colors"
          >
            <span className="font-medium">
              <span className="text-emerald-400">{t("glp1Hub.importantNote")}</span>{" "}
              <span className="text-md text-white">
                {t("glp1Hub.careTitle")}
              </span>
            </span>
            {noteOpen ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
          {noteOpen && (
            <div className="px-4 pb-4">
              <p className="text-md leading-relaxed text-white/90">
                {t("glp1Hub.careBody")}
              </p>
            </div>
          )}
        </section>

        {/* Shot Tracker - Database-backed */}
        <section className="bg-black/60 border border-purple-300/20 rounded-xl p-4 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg text-white font-bold min-w-0 break-words">{t("glp1Hub.shotTrackerTitle")}</h2>
            <div className="flex flex-col items-center gap-1">
              <PillButton
                onClick={() => setShotTrackerOpen(!shotTrackerOpen)}
                active={shotTrackerOpen}
                data-testid="button-toggle-shot-tracker"
              >
                {shotTrackerOpen
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </PillButton>
              <span className="text-[11px] text-white font-medium">
                {shotTrackerOpen ? t("glp1Hub.closeTracker") : t("glp1Hub.openTracker")}
              </span>
            </div>
          </div>
          {shotTrackerOpen && (
            <div className="mt-4">
              {user?.id ? (
                <ShotTrackerPanel
                  userId={user.id.toString()}
                  onClose={() => setShotTrackerOpen(false)}
                />
              ) : (
                <p className="text-white/60 text-sm">{t("glp1Hub.shotLoading")}</p>
              )}
            </div>
          )}
          {!shotTrackerOpen && (
            <p className="text-white/80 text-md">
              {t("glp1Hub.shotTrackerDesc")}
            </p>
          )}
        </section>

        {/* Doctor / Coach Guardrails */}
        <section className="bg-black/60 border border-purple-300/20 rounded-xl p-5 backdrop-blur shadow-lg">
          <h2 className="text-lg text-white font-bold mb-2">
            {t("glp1Hub.guardrailsTitle")}
          </h2>
          <p className="text-white/80 text-md mb-4">
            {t("glp1Hub.guardrailsDesc")}
          </p>

          {/* Preset Selector */}
          <div className="mb-4">
            <label className="text-white/90 text-md block mb-1">
              {t("glp1Hub.quickStartPreset")}
            </label>
            <Select value={selectedPreset} onValueChange={handlePresetSelect}>
              <SelectTrigger className="w-full bg-black/30 border-purple-300/30 text-white [&>span]:text-white">
                <SelectValue placeholder={t("glp1Hub.presetPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {glp1Presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPreset && (
              <p className="text-white/70 text-xs mt-2">
                {glp1Presets.find((p) => p.id === selectedPreset)?.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-white/90 text-md block mb-1">
                {t("glp1Hub.maxMealVolume")}
              </label>
              <input
                type="number"
                placeholder="e.g., 300"
                value={maxMealVolume}
                onChange={(e) =>
                  setMaxMealVolume(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className="w-full rounded-xl bg-black/30 border border-purple-300/30 text-white px-3 py-2 text-md focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div>
              <label className="text-white/90 text-md block mb-1">
                {t("glp1Hub.proteinMin")}
              </label>
              <input
                type="number"
                placeholder="e.g., 20"
                value={proteinMin}
                onChange={(e) =>
                  setProteinMin(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className="w-full rounded-xl bg-black/30 border border-purple-300/30 text-white px-3 py-2 text-md focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div>
              <label className="text-white/90 text-md block mb-1">
                {t("glp1Hub.fatMax")}
              </label>
              <input
                type="number"
                placeholder="e.g., 15"
                value={fatMax}
                onChange={(e) =>
                  setFatMax(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className="w-full rounded-xl bg-black/30 border border-purple-300/30 text-white px-3 py-2 text-md focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div>
              <label className="text-white/90 text-md block mb-1">
                {t("glp1Hub.fiberMin")}
              </label>
              <input
                type="number"
                placeholder="e.g., 25"
                value={fiberMin}
                onChange={(e) =>
                  setFiberMin(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className="w-full rounded-xl bg-black/30 border border-purple-300/30 text-white px-3 py-2 text-md focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div>
              <label className="text-white/90 text-md block mb-1">
                {t("glp1Hub.hydrationGoal")}
              </label>
              <input
                type="number"
                placeholder="e.g., 2000"
                value={hydrationGoal}
                onChange={(e) =>
                  setHydrationGoal(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className="w-full rounded-xl bg-black/30 border border-purple-300/30 text-white px-3 py-2 text-md focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div>
              <label className="text-white/90 text-md block mb-1">
                {t("glp1Hub.mealsPerDay")}
              </label>
              <input
                type="number"
                placeholder="e.g., 4"
                value={mealsPerDay}
                onChange={(e) =>
                  setMealsPerDay(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className="w-full rounded-xl bg-black/30 border border-purple-300/30 text-white px-3 py-2 text-md focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/90 text-md">
                {t("glp1Hub.slowDigestFoods")}
              </label>
              <input
                type="checkbox"
                checked={slowDigestFoodsOnly}
                onChange={(e) => setSlowDigestFoodsOnly(e.target.checked)}
                className="h-5 w-5 rounded bg-black/30 border-purple-300/30 text-purple-600 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/90 text-md">{t("glp1Hub.limitCarbonation")}</label>
              <input
                type="checkbox"
                checked={limitCarbonation}
                onChange={(e) => setLimitCarbonation(e.target.checked)}
                className="h-5 w-5 rounded bg-black/30 border-purple-300/30 text-purple-600 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/90 text-md">{t("glp1Hub.limitAlcohol")}</label>
              <input
                type="checkbox"
                checked={limitAlcohol}
                onChange={(e) => setLimitAlcohol(e.target.checked)}
                className="h-5 w-5 rounded bg-black/30 border-purple-300/30 text-purple-600 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-lime-600 text-md font-bold text-white w-full rounded-xl mt-4"
          >
            {saveMutation.isPending ? t("glp1Hub.saving") : t("glp1Hub.saveGuardrails")}
          </Button>
        </section>

        {/* CTA → Meals */}
        <section className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-xl">
          <h3 className="text-white font-bold text-lg mb-1">
            {t("glp1Hub.ctaTitle")}
          </h3>
          <p className="text-white/90 text-md mb-3">
            {t("glp1Hub.ctaDesc")}
          </p>
          <button
            onClick={() => setLocation("/glp1-meal-builder")}
            className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-lime-600/20 border border-lime-500/30 text-white"
            data-testid="button-go-to-glp1-meals"
          >
            <div className="text-left">
              <p className="font-bold text-sm">{t("glp1Hub.launchBuilder")}</p>
              <p className="text-white/80 text-xs mt-0.5">{t("glp1Hub.launchBuilderSub")}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-lime-400 flex-shrink-0" />
          </button>
        </section>
      </div>

      {/* Quick Tour Modal */}
      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title={t("glp1Hub.tourTitle")}
        steps={GLP1_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </div>
  );
}
