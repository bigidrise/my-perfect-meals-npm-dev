// client/src/hooks/useGuestProgress.ts
// React hook for consuming Guest Progress state
// Single source of truth for guest feature access in components

import { useState, useEffect, useCallback } from "react";
import {
  isGuestMode,
  getGuestProgress,
  GuestProgress,
  GuestFeature,
  isGuestFeatureUnlocked,
  getFeatureUnlockMessage,
  getGuestNextStepMessage,
  hasCompletedMacros,
  hasBuiltFirstMeal,
  getMealsBuiltCount,
  getGuestGenerationsRemaining,
  getGuestDaysRemaining,
  shouldShowGuestUpgradePrompt,
  markMacrosCompleted,
  incrementMealsBuilt,
} from "@/lib/guestMode";

export interface UseGuestProgressResult {
  isGuest: boolean;
  progress: GuestProgress | null;
  
  // Feature access
  isFeatureUnlocked: (feature: GuestFeature) => boolean;
  getUnlockMessage: (feature: GuestFeature) => string;
  
  // Progress milestones
  macrosCompleted: boolean;
  firstMealBuilt: boolean;
  mealsBuiltCount: number;
  
  // Limits
  generationsRemaining: number;
  daysRemaining: number;
  shouldShowUpgrade: boolean;
  
  // Copilot integration
  nextStepMessage: string;
  
  // Actions
  completeMacros: () => void;
  addMealToBoard: () => void;
  
  // Refresh state
  refresh: () => void;
}

export function useGuestProgress(): UseGuestProgressResult {
  const [isGuest, setIsGuest] = useState(false);
  const [progress, setProgress] = useState<GuestProgress | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    setIsGuest(isGuestMode());
    setProgress(getGuestProgress());
  }, [refreshKey]);

  // Listen for custom events to refresh state
  useEffect(() => {
    const handleProgressUpdate = () => refresh();
    window.addEventListener("guestProgressUpdate", handleProgressUpdate);
    return () => window.removeEventListener("guestProgressUpdate", handleProgressUpdate);
  }, [refresh]);

  const isFeatureUnlocked = useCallback((feature: GuestFeature): boolean => {
    return isGuestFeatureUnlocked(feature);
  }, [progress]); // eslint-disable-line react-hooks/exhaustive-deps

  const getUnlockMessage = useCallback((feature: GuestFeature): string => {
    return getFeatureUnlockMessage(feature);
  }, []);

  const completeMacros = useCallback(() => {
    markMacrosCompleted();
    refresh();
    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent("guestProgressUpdate", { 
      detail: { action: "macrosCompleted" } 
    }));
  }, [refresh]);

  const addMealToBoard = useCallback(() => {
    incrementMealsBuilt();
    refresh();
    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent("guestProgressUpdate", { 
      detail: { action: "mealBuilt", count: getMealsBuiltCount() } 
    }));
  }, [refresh]);

  return {
    isGuest,
    progress,
    
    // Feature access
    isFeatureUnlocked,
    getUnlockMessage,
    
    // Progress milestones
    macrosCompleted: hasCompletedMacros(),
    firstMealBuilt: hasBuiltFirstMeal(),
    mealsBuiltCount: getMealsBuiltCount(),
    
    // Limits
    generationsRemaining: getGuestGenerationsRemaining(),
    daysRemaining: getGuestDaysRemaining(),
    shouldShowUpgrade: shouldShowGuestUpgradePrompt(),
    
    // Copilot integration
    nextStepMessage: getGuestNextStepMessage(),
    
    // Actions
    completeMacros,
    addMealToBoard,
    
    // Refresh
    refresh,
  };
}

// Convenience hook for checking a single feature
export function useGuestFeatureAccess(feature: GuestFeature) {
  const { isGuest, isFeatureUnlocked, getUnlockMessage } = useGuestProgress();
  
  return {
    isGuest,
    isUnlocked: isFeatureUnlocked(feature),
    unlockMessage: getUnlockMessage(feature),
  };
}
