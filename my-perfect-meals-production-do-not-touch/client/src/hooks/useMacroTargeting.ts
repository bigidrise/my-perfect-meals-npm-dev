import { useState, useEffect, useCallback } from 'react';

export interface MacroTargets {
  protein: number | '';
  fibrousCarbs: number | '';
  starchyCarbs: number | '';
  fat: number | '';
}

export interface MacroTargetingState {
  enabled: boolean;
  targets: MacroTargets;
  toggleEnabled: () => void;
  updateTarget: (field: keyof MacroTargets, value: number | '') => void;
  applyPreset: (preset: MacroTargets) => void;
  serializeForRequest: () => { 
    protein_g?: number; 
    fibrous_carbs_g?: number; 
    starchy_carbs_g?: number; 
    fat_g?: number 
  } | null;
}

const PRESETS = {
  PRESET_1: { protein: 50, fibrousCarbs: 15, starchyCarbs: 30, fat: 20 },
  PRESET_2: { protein: 40, fibrousCarbs: 20, starchyCarbs: 40, fat: 15 },
};

/**
 * Reusable hook for macro targeting functionality
 * Handles state, localStorage persistence, and validation
 * 
 * @param storageKey - Unique localStorage key (e.g., "macroTargets::trainer::general")
 */
export function useMacroTargeting(storageKey: string): MacroTargetingState {
  const [enabled, setEnabled] = useState(false);
  const [targets, setTargets] = useState<MacroTargets>({
    protein: '',
    fibrousCarbs: '',
    starchyCarbs: '',
    fat: '',
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setEnabled(parsed.enabled || false);
        setTargets({
          protein: parsed.protein ?? '',
          fibrousCarbs: parsed.fibrousCarbs ?? '',
          starchyCarbs: parsed.starchyCarbs ?? '',
          fat: parsed.fat ?? '',
        });
      }
    } catch (error) {
      console.error('Failed to load macro targets from localStorage:', error);
    }
  }, [storageKey]);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          enabled,
          protein: targets.protein,
          fibrousCarbs: targets.fibrousCarbs,
          starchyCarbs: targets.starchyCarbs,
          fat: targets.fat,
        })
      );
    } catch (error) {
      console.error('Failed to save macro targets to localStorage:', error);
    }
  }, [storageKey, enabled, targets]);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  const updateTarget = useCallback((field: keyof MacroTargets, value: number | '') => {
    setTargets((prev) => ({ ...prev, [field]: value }));
  }, []);

  const applyPreset = useCallback((preset: MacroTargets) => {
    setTargets(preset);
  }, []);

  const serializeForRequest = useCallback((): { 
    protein_g?: number; 
    fibrous_carbs_g?: number; 
    starchy_carbs_g?: number; 
    fat_g?: number 
  } | null => {
    if (!enabled) return null;

    const result: { 
      protein_g?: number; 
      fibrous_carbs_g?: number; 
      starchy_carbs_g?: number; 
      fat_g?: number 
    } = {};

    // Add only the fields that have valid numbers (all fields are optional)
    if (typeof targets.protein === 'number' && targets.protein > 0) {
      result.protein_g = targets.protein;
    }
    if (typeof targets.fibrousCarbs === 'number' && targets.fibrousCarbs > 0) {
      result.fibrous_carbs_g = targets.fibrousCarbs;
    }
    if (typeof targets.starchyCarbs === 'number' && targets.starchyCarbs > 0) {
      result.starchy_carbs_g = targets.starchyCarbs;
    }
    if (typeof targets.fat === 'number' && targets.fat > 0) {
      result.fat_g = targets.fat;
    }

    // Return the object if at least one field is set, otherwise null
    return Object.keys(result).length > 0 ? result : null;
  }, [enabled, targets]);

  return {
    enabled,
    targets,
    toggleEnabled,
    updateTarget,
    applyPreset,
    serializeForRequest,
  };
}

export { PRESETS };
