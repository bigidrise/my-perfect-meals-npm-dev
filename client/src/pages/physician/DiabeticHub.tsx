import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Activity,
  Target,
  TrendingUp,
  ChefHat,
  Home,
  Utensils,
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

  // Guardrail state (hydrated from server)
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

  // Auto-mark info as seen since Copilot provides guidance now
  useEffect(() => {
    if (!localStorage.getItem("diabetic-hub-info-seen")) {
      localStorage.setItem("diabetic-hub-info-seen", "true");
    }
  }, []);

  // Auto-hydrate guardrails from server on mount
  useEffect(() => {
    if (profile?.data?.guardrails) {
      const g = profile.data.guardrails;
      if (g.fastingMin) setFastingMin(String(g.fastingMin));
      if (g.fastingMax) setFastingMax(String(g.fastingMax));
      if (g.postMealMax) setPostMealMax(String(g.postMealMax));
      if (g.carbLimit) setDailyCarbLimit(String(g.carbLimit));
      if (g.fiberMin) setFiberMin(String(g.fiberMin));
      if (g.giCap) setGiCap(String(g.giCap));
      if (g.mealFrequency) setMealFrequency(String(g.mealFrequency));
    }
  }, [profile?.data?.guardrails]);

  // Get latest reading for display
  const latestReading = glucoseLogs?.data?.[0];
  const lastValue = latestReading?.valueMgdl || 95;
  const targetMin = parseInt(fastingMin) || GLUCOSE_THRESHOLDS.PRE_MEAL_MIN;
  const targetMax = parseInt(fastingMax) || GLUCOSE_THRESHOLDS.PRE_MEAL_MAX;
  const inRange = lastValue >= targetMin && lastValue <= targetMax;

  // Handlers
  const handleSaveGuardrails = async () => {
    try {
      await saveMutation.mutateAsync({
        userId,
        type: "T2D",
        hypoHistory: false,
        guardrails: {
          fastingMin: parseInt(fastingMin) || 80,
          fastingMax: parseInt(fastingMax) || 120,
          postMealMax: parseInt(postMealMax) || 140,
          carbLimit: parseInt(dailyCarbLimit) || 120,
          fiberMin: parseInt(fiberMin) || 25,
          giCap: parseInt(giCap) || 55,
          mealFrequency: parseInt(mealFrequency) || 4,
        },
      });
      setSelectedPreset(""); // Clear preset after manual save
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
      await logMutation.mutateAsync({
        userId,
        valueMgdl: parseInt(glucoseReading),
        context: glucoseContext,
        recordedAt: new Date().toISOString(),
      });
      setGlucoseReading("");
      toast({ title: "Reading logged successfully" });
    } catch (error) {
      toast({ title: "Failed to log reading", variant: "destructive" });
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
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 relative pb-safe-nav">
        {/* Enhanced Glass Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/10 pointer-events-none" />

        {/* Universal Safe-Area Header */}
        <div
          className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <Activity className="h-6 w-6 text-orange-500" />

            {/* Title */}
            <h1 className="text-lg font-bold text-white">Diabetic Hub</h1>

            <div className="flex-grow" />

            {/* Medical Sources Button */}
            <MedicalSourcesInfo asIconButton />
            {/* Quick Tour Help Button */}
            <QuickTourButton onClick={quickTour.openTour} />
          </div>
        </div>

        {/* Main Content */}
        <div
          className="max-w-6xl mx-auto px-4 space-y-8 pb-24"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
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
              className="w-full px-8 py-4 rounded-xl bg-gradient-to-r from-lime-900 to-lime-900 hover:from-lime-500 hover:to-lime-500 text-white font-semibold transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 relative overflow-hidden"
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
      </div>
    </>
  );
}
