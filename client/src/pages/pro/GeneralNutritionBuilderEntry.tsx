/**
 * GeneralNutritionBuilderEntry
 *
 * Builder Entry screen for the General Nutrition Builder.
 * Users land here first and choose one of two paths:
 *   1. Continue → opens the General Nutrition Builder directly
 *   2. Training Nutrition Schedule → opens the scheduling modal (reuses
 *      the exact same scheduling system as the Performance Nutrition Hub)
 *
 * Scope: General Nutrition only (pilot). Do not add this pattern to
 * Diabetic, GLP-1, or Anti-Inflammatory builders until this is approved.
 */

import React from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ChevronRight, Dumbbell, CalendarDays, Utensils } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function GeneralNutritionBuilderEntry() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const hasSchedule = !!(user?.weeklyTrainingSchedule);

  // Derive today's session label from the stored schedule
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
            General Nutrition Builder
          </h1>
          <p className="text-white text-sm leading-relaxed">
            Build meals using your Nutrition Profile.
          </p>
        </div>

        {/* Option 1: Continue */}
        <button
          onClick={() => setLocation("/general-nutrition-builder/build")}
          className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 transition-colors text-left mb-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <Utensils className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base leading-tight mb-0.5">
              Continue to General Nutrition Builder
            </p>
            <p className="text-white text-sm leading-relaxed">
              Generate meals using your current Nutrition Profile and macro targets.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-blue-400/60 group-hover:text-blue-400 transition-colors flex-shrink-0" />
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs font-semibold uppercase tracking-wider">
            Optional
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Option 2: Training Nutrition Schedule */}
        <button
          onClick={() => setLocation("/general-nutrition/training")}
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
              {hasSchedule && (
                <span className="text-xs font-semibold text-orange-400 bg-orange-600/20 border border-orange-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                  Active
                </span>
              )}
            </div>
            <p className="text-white text-sm leading-relaxed mb-2">
              Automatically adjust your daily macro targets based on your weekly workout schedule.
            </p>

            {/* Active schedule status */}
            {hasSchedule && todayLabel && (
              <div className="flex items-center gap-2 mt-2">
                <CalendarDays className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                <span className="text-orange-300 text-xs font-semibold">
                  Today: {todayLabel}
                </span>
                <span className="text-white/60 text-xs">·</span>
                <span className="text-white text-xs">Training adjustments active</span>
              </div>
            )}

            {/* CTA label */}
            <p className="text-orange-400 text-sm font-semibold mt-2">
              {hasSchedule ? "Edit Training Nutrition Schedule →" : "Set Up Training Nutrition Schedule →"}
            </p>
          </div>
        </button>

        {/* Explainer — only shown when no schedule is active */}
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
