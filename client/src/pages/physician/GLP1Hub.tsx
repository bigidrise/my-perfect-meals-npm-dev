import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
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
  Activity,
  Pill,
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

const GLP1_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Choose Your Preset",
    description:
      "Select a starting point based on your medication or customize your own guardrails.",
  },
  {
    icon: "2",
    title: "Track Your Shots",
    description:
      "Log your GLP-1 injections to stay on schedule and monitor your progress.",
  },
  {
    icon: "3",
    title: "Set Meal Limits",
    description:
      "Configure maximum meal volume and macros to match your reduced appetite.",
  },
  {
    icon: "4",
    title: "Get GLP-1 Friendly Meals",
    description:
      "Browse meals designed for smaller portions with maximum nutrition.",
  },
];

export default function GLP1Hub() {
  const [, setLocation] = useLocation();
  const [noteOpen, setNoteOpen] = useState(false);
  const [shotTrackerOpen, setShotTrackerOpen] = useState(false);
  const { user } = useAuth();
  const quickTour = useQuickTour("glp1-hub");

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
    document.title = "GLP-1 Hub | My Perfect Meals";
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
      title: "GLP-1 Profile Saved",
      description: "Your guardrail settings have been updated.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav">
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 flex-nowrap">
          <Pill className="h-6 w-6 text-orange-500 flex-shrink-0" />
          {/* Title */}
          <h1 className="text-lg font-bold text-white truncate min-w-0">
            GLP-1 Hub
          </h1>

          <div className="flex-grow" />

          {/* Pill Buttons */}
          <div className="flex items-center gap-2">
            <MedicalSourcesInfo asPillButton />
            <QuickTourButton onClick={quickTour.openTour} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-2xl mx-auto px-4 space-y-6 pb-16"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* Important Medical Note Dropdown */}
        <section className="bg-black/40 backdrop-blur-lg border border-purple-300/30 rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={() => setNoteOpen(!noteOpen)}
            className="w-full p-4 flex items-center justify-between text-white hover:bg-white/5 transition-colors"
          >
            <span className="font-medium">
              <span className="text-emerald-400">Important:</span>{" "}
              <span className="text-md text-white">
                How This App Supports Your Care
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
                <span className="font-semibold text-emerald-400">
                  Important:
                </span>{" "}
                My Perfect Meals is designed to work{" "}
                <span className="font-semibold text-white">with</span> your
                doctor, dietitian, or healthcare provider — never instead of
                them. Use the information and tools here to stay consistent
                between visits, to understand your body, and to make small,
                confident choices that honor your professional guidance. Every
                tracker, every meal, and every suggestion in this app is meant
                to <span className="italic">support</span> your care plan, not
                replace it.
              </p>
            </div>
          )}
        </section>

        {/* Shot Tracker - Database-backed */}
        <section className="bg-black/60 border border-purple-300/20 rounded-xl p-4 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg text-white font-bold">GLP-1 Shot Tracker</h2>
            <Button
              onClick={() => setShotTrackerOpen(!shotTrackerOpen)}
              className="bg-lime-600 text-md font-bold text-white rounded-xl px-4 py-2"
              data-testid="button-toggle-shot-tracker"
            >
              {shotTrackerOpen ? "Hide Tracker" : "Open Tracker"}
            </Button>
          </div>
          {shotTrackerOpen && (
            <div className="mt-4">
              {user?.id ? (
                <ShotTrackerPanel
                  userId={user.id.toString()}
                  onClose={() => setShotTrackerOpen(false)}
                />
              ) : (
                <p className="text-white/60 text-sm">Loading your shot history...</p>
              )}
            </div>
          )}
          {!shotTrackerOpen && (
            <p className="text-white/80 text-md">
              Track your medication shots with date, dosage, injection site, and
              notes. Click to manage your shot history.
            </p>
          )}
        </section>

        {/* Doctor / Coach Guardrails */}
        <section className="bg-black/60 border border-purple-300/20 rounded-xl p-5 backdrop-blur shadow-lg">
          <h2 className="text-lg text-white font-bold mb-2">
            Doctor / Coach Guardrails
          </h2>
          <p className="text-white/80 text-md mb-4">
            Set clinical meal guardrails for GLP-1 patients (portion, macros,
            hydration).
          </p>

          {/* Preset Selector */}
          <div className="mb-4">
            <label className="text-white/90 text-md block mb-1">
              Quick Start Preset
            </label>
            <Select value={selectedPreset} onValueChange={handlePresetSelect}>
              <SelectTrigger className="w-full bg-black/30 border-purple-300/30 text-white [&>span]:text-white">
                <SelectValue placeholder="Choose a preset or customize below..." />
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
                Max Meal Volume (mL)
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
                Protein Min (g per meal)
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
                Fat Max (g per meal)
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
                Fiber Min (g per day)
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
                Hydration Goal (mL per day)
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
                Meals per Day
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
                Slow-Digest Foods Only
              </label>
              <input
                type="checkbox"
                checked={slowDigestFoodsOnly}
                onChange={(e) => setSlowDigestFoodsOnly(e.target.checked)}
                className="h-5 w-5 rounded bg-black/30 border-purple-300/30 text-purple-600 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/90 text-md">Limit Carbonation</label>
              <input
                type="checkbox"
                checked={limitCarbonation}
                onChange={(e) => setLimitCarbonation(e.target.checked)}
                className="h-5 w-5 rounded bg-black/30 border-purple-300/30 text-purple-600 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/90 text-md">Limit Alcohol</label>
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
            {saveMutation.isPending ? "Saving..." : "Save Guardrails"}
          </Button>
        </section>

        {/* CTA → Meals */}
        <section className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-xl">
          <h3 className="text-white font-bold text-lg mb-1">
            Find Meals for GLP-1 Users
          </h3>
          <p className="text-white/90 text-md mb-3">
            Small portions • Calorie-dense • Mixed cuisines.
          </p>
          <Button
            onClick={() => setLocation("/glp1-meal-builder")}
            className="bg-lime-600 text-md font-bold text-white w-full rounded-xl"
            data-testid="button-go-to-glp1-meals"
          >
            GLP-1 Meal Builder
          </Button>
        </section>
      </div>

      {/* Quick Tour Modal */}
      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="How to Use GLP-1 Hub"
        steps={GLP1_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </div>
  );
}
