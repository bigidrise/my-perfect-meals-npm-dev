import React, { useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ChevronRight, Dumbbell, CalendarDays, Activity } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/apiRequest";

export default function DiabeticBuilderEntry() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();

  const hasSchedule = !!(user?.weeklyTrainingSchedule);
  const performanceModeEnabled = user?.performanceModeEnabled ?? false;

  const DOW = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const todayKey = DOW[new Date().getDay()];
  const schedule = user?.weeklyTrainingSchedule as Record<string, string> | null | undefined;
  const todaySession = schedule?.[todayKey];

  const SESSION_LABELS: Record<string, string> = {
    strength: "Strength Day",
    power: "Power Day",
    endurance: "Endurance Day",
    sport_practice: "Sport Practice Day",
    competition: "Competition Day",
    recovery: "Recovery Day",
    off: "Rest Day",
  };
  const todayLabel = todaySession ? (SESSION_LABELS[todaySession] ?? todaySession) : null;

  const setMode = useCallback(async (enabled: boolean) => {
    try {
      await apiRequest("/api/performance/mode", { method: "PATCH", body: JSON.stringify({ enabled }) });
      await refreshUser();
    } catch { /* silent — navigation proceeds regardless */ }
  }, [refreshUser]);

  const handleContinue = useCallback(async () => {
    await setMode(false);
    setLocation("/diabetic-hub");
  }, [setMode, setLocation]);

  const handlePerformance = useCallback(async () => {
    await setMode(true);
    setLocation(hasSchedule ? "/diabetic-hub" : "/diabetic/training");
  }, [setMode, setLocation, hasSchedule]);

  return (
    <motion.div
      className="min-h-screen bg-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="max-w-lg mx-auto px-5 pb-12"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {/* Header */}
        <div className="mb-8">
          <p className="text-white text-xs font-semibold uppercase tracking-wider mb-2">
            Meal Builder
          </p>
          <h1 className="text-white font-bold text-2xl leading-tight mb-2">
            Diabetic Menu Builder
          </h1>
          <p className="text-white text-sm leading-relaxed">
            Build meals calibrated to your diabetic nutrition protocol.
          </p>
        </div>

        {/* Option 1: Continue — disables Performance Mode */}
        <button
          onClick={handleContinue}
          className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 transition-colors text-left mb-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base leading-tight mb-0.5">
              Continue to Diabetic Hub
            </p>
            <p className="text-white text-sm leading-relaxed">
              View your diabetic nutrition hub, generate meals using your baseline macro targets.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-rose-400/60 group-hover:text-rose-400 transition-colors flex-shrink-0" />
        </button>

        {/* Section Header */}
        <div className="mt-6 mb-4">
          <div className="h-px bg-white/10 mb-4" />
          <p className="text-white font-semibold text-base mb-1">Train or work out regularly?</p>
          <p className="text-white text-sm leading-relaxed">
            Set up your Training Nutrition Schedule so your meals automatically adapt to your workout schedule while continuing to honor your diabetic nutrition protocol.
          </p>
        </div>

        {/* Option 2: Performance Mode — enables Performance Mode */}
        <button
          onClick={handlePerformance}
          className="w-full flex items-start gap-4 px-5 py-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-orange-600/10 hover:border-orange-500/30 transition-colors text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Dumbbell className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-white font-semibold text-base leading-tight">
                Training Nutrition Schedule
              </p>
              {performanceModeEnabled && hasSchedule && (
                <span className="text-xs font-semibold text-orange-400 bg-orange-600/20 border border-orange-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                  Active
                </span>
              )}
            </div>
            <p className="text-white text-sm leading-relaxed mb-2">
              Automatically adjust your daily macro targets based on your weekly workout schedule.
            </p>
            {performanceModeEnabled && hasSchedule && todayLabel && (
              <div className="flex items-center gap-2 mt-2">
                <CalendarDays className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                <span className="text-orange-300 text-xs font-semibold">Today: {todayLabel}</span>
                <span className="text-white/60 text-xs">·</span>
                <span className="text-white text-xs">Training adjustments active</span>
              </div>
            )}
            <p className="text-orange-400 text-sm font-semibold mt-2">
              {hasSchedule ? "Edit Training Nutrition Schedule →" : "Set Up Training Nutrition Schedule →"}
            </p>
          </div>
        </button>

        {!hasSchedule && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white text-xs leading-relaxed">
              When configured, your macro targets automatically shift each day based on your training — more carbohydrates on power days, reduced targets on rest days. Your macro baseline always stays under your Macro Calculator.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
