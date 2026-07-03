import { useState, useEffect, useMemo } from "react";
import { getNutritionBaseline, getResolvedTargets, type ResolvedTargets } from "@/lib/macroResolver";

/**
 * Reactive hook for BASELINE nutrition targets.
 *
 * Use this in any workflow page that is NOT part of the Performance workflow:
 *   Weekly Meal Builder, BeachBody Board, GLP-1 Builder, Anti-Inflammatory,
 *   Diabetic Builder, General Nutrition Builder, Biometrics, etc.
 *
 * Returns: Pro targets (if coach-set) → MacroCalculator baseline.
 * Never applies Performance session modifiers.
 *
 * Architecture rule: only workflow pages call nutrition resolvers.
 * Components receive the resolved object as props.
 */
export function useBaselineNutrition(userId?: string): ResolvedTargets {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handle = () => setTick(t => t + 1);
    window.addEventListener("mpm:targetsUpdated", handle);
    return () => window.removeEventListener("mpm:targetsUpdated", handle);
  }, []);

  return useMemo(
    () => getNutritionBaseline(userId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, tick],
  );
}

/**
 * Reactive hook for PERFORMANCE-ADJUSTED nutrition targets.
 *
 * Use this ONLY in Performance-specific workflow pages:
 *   Performance Nutrition Hub, Performance Competition Builder,
 *   Athlete Meal Picker.
 *
 * Returns: Pro targets → MacroCalculator baseline + today's session modifier.
 */
export function usePerformanceNutrition(userId?: string): ResolvedTargets {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handle = () => setTick(t => t + 1);
    window.addEventListener("mpm:targetsUpdated", handle);
    return () => window.removeEventListener("mpm:targetsUpdated", handle);
  }, []);

  return useMemo(
    () => getResolvedTargets(userId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, tick],
  );
}
