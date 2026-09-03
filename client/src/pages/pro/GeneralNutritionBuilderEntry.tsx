/**
 * GeneralNutritionBuilderEntry
 *
 * Builder Entry screen for the General Nutrition Builder.
 * Users land here first and choose one of two paths:
 *   1. Continue → sets Performance Mode OFF, enters the General Nutrition Builder
 *   2. Training Nutrition Schedule → sets Performance Mode ON, enters the builder
 *      with today's performance-adjusted macro targets active
 */

import React, { useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronRight, Dumbbell, CalendarDays, Utensils } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/apiRequest";
import { isClinicalOrAbove } from "@/lib/subscriptionCheck";

export default function GeneralNutritionBuilderEntry() {
  const { t } = useTranslation("pro");
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const canAccessTrainingNutrition = isClinicalOrAbove(user);

  const hasSchedule = !!(user?.weeklyTrainingSchedule);
  const performanceModeEnabled = user?.performanceModeEnabled ?? false;

  const DOW = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const todayKey = DOW[new Date().getDay()];
  const schedule = user?.weeklyTrainingSchedule as Record<string, string> | null | undefined;
  const todaySession = schedule?.[todayKey];

  const SESSION_LABELS: Record<string, string> = {
    strength: t("gnbEntry.sessions.strength"),
    power: t("gnbEntry.sessions.power"),
    endurance: t("gnbEntry.sessions.endurance"),
    sport_practice: t("gnbEntry.sessions.sport_practice"),
    competition: t("gnbEntry.sessions.competition"),
    recovery: t("gnbEntry.sessions.recovery"),
    off: t("gnbEntry.sessions.off"),
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
    setLocation("/general-nutrition-builder/build");
  }, [setMode, setLocation]);

  const handlePerformance = useCallback(async () => {
    await setMode(true);
    setLocation(hasSchedule ? "/general-nutrition-builder/build" : "/general-nutrition/training");
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
            {t("gnbEntry.headerLabel")}
          </p>
          <h1 className="text-white font-bold text-2xl leading-tight mb-2">
            {t("gnbEntry.title")}
          </h1>
          <p className="text-white text-sm leading-relaxed">
            {t("gnbEntry.subtitle")}
          </p>
        </div>

        {/* Option 1: Continue — sets Performance Mode OFF */}
        <button
          onClick={handleContinue}
          className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 transition-colors text-left mb-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <Utensils className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base leading-tight mb-0.5">
              {t("gnbEntry.continueTo")}
            </p>
            <p className="text-white text-sm leading-relaxed">
              {t("gnbEntry.continueDesc")}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-blue-400/60 group-hover:text-blue-400 transition-colors flex-shrink-0" />
        </button>

        {/* Section Header */}
        <div className="mt-6 mb-4" hidden={!canAccessTrainingNutrition}>
          <div className="h-px bg-white/10 mb-4" />
          <p className="text-white font-semibold text-base mb-1">{t("gnbEntry.trainTitle")}</p>
          <p className="text-white text-sm leading-relaxed">
            {t("gnbEntry.trainDesc")}
          </p>
        </div>

        {/* Option 2: Performance Mode — sets Performance Mode ON */}
        <button
          hidden={!canAccessTrainingNutrition}
          onClick={handlePerformance}
          className="w-full flex items-start gap-4 px-5 py-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-orange-600/10 hover:border-orange-500/30 transition-colors text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Dumbbell className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-white font-semibold text-base leading-tight">
                {t("gnbEntry.scheduleTitle")}
              </p>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-300 bg-orange-600/20 border border-orange-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                Clinical
              </span>
              {performanceModeEnabled && hasSchedule && (
                <span className="text-xs font-semibold text-orange-400 bg-orange-600/20 border border-orange-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                  {t("gnbEntry.activeLabel")}
                </span>
              )}
            </div>
            <p className="text-white text-sm leading-relaxed mb-2">
              {t("gnbEntry.scheduleDesc")}
            </p>

            {/* Active schedule status — only shown when performance mode is on */}
            {performanceModeEnabled && hasSchedule && todayLabel && (
              <div className="flex items-center gap-2 mt-2">
                <CalendarDays className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                <span className="text-orange-300 text-xs font-semibold">
                  {t("gnbEntry.today", { label: todayLabel })}
                </span>
                <span className="text-white/60 text-xs">·</span>
                <span className="text-white text-xs">{t("gnbEntry.adjustmentsActive")}</span>
              </div>
            )}

            <p className="text-orange-400 text-sm font-semibold mt-2">
              {hasSchedule ? `${t("gnbEntry.editSchedule")} →` : `${t("gnbEntry.setupSchedule")} →`}
            </p>
          </div>
        </button>

        {/* Explainer — only shown when no schedule is active */}
        {canAccessTrainingNutrition && !hasSchedule && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white text-xs leading-relaxed">
              {t("gnbEntry.explainer")}
            </p>
          </div>
        )}
      </div>

    </motion.div>
  );
}
