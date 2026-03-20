import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthHeaders } from '@/lib/auth';
import { apiUrl } from '@/lib/resolveApiBase';

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

function getUserId(): string | null {
  try {
    const u = localStorage.getItem('mpm_current_user');
    return u ? JSON.parse(u).id : null;
  } catch {
    return null;
  }
}

/**
 * Reusable hook for macro targeting functionality.
 * Server is source of truth. localStorage is a fast cache.
 * Only writes to server after explicit user actions.
 *
 * @param storageKey - Unique key (e.g., "macroTargets::trainer::premadePicker")
 */
export function useMacroTargeting(storageKey: string): MacroTargetingState {
  const [enabled, setEnabled] = useState(false);
  const [targets, setTargets] = useState<MacroTargets>({
    protein: '',
    fibrousCarbs: '',
    starchyCarbs: '',
    fat: '',
  });

  const isUserActionRef = useRef(false);
  const hydratedRef = useRef(false);

  // On mount: load from localStorage instantly, then hydrate from server
  useEffect(() => {
    // 1. Instant local read
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
    } catch {}

    // 2. Hydrate from server (source of truth)
    const userId = getUserId();
    if (!userId || userId.startsWith('guest-')) return;

    fetch(apiUrl(`/api/users/${userId}/app-preferences`), {
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    })
      .then((r) => r.ok ? r.json() : null)
      .then((prefs: Record<string, unknown> | null) => {
        if (!prefs) return;
        const data = prefs[storageKey] as { enabled?: boolean; protein?: number | ''; fibrousCarbs?: number | ''; starchyCarbs?: number | ''; fat?: number | '' } | undefined;
        if (!data) return;

        const hydrated = {
          protein: data.protein ?? '' as number | '',
          fibrousCarbs: data.fibrousCarbs ?? '' as number | '',
          starchyCarbs: data.starchyCarbs ?? '' as number | '',
          fat: data.fat ?? '' as number | '',
        };
        setEnabled(data.enabled || false);
        setTargets(hydrated);

        // Update local cache
        localStorage.setItem(storageKey, JSON.stringify({ enabled: data.enabled || false, ...hydrated }));
        hydratedRef.current = true;
      })
      .catch(() => {});
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
    } catch {}
  }, [storageKey, enabled, targets]);

  // Save to server only after user actions (not on initial hydration)
  const saveToServer = useCallback((newEnabled: boolean, newTargets: MacroTargets) => {
    const userId = getUserId();
    if (!userId || userId.startsWith('guest-')) return;

    const payload = {
      [storageKey]: {
        enabled: newEnabled,
        protein: newTargets.protein,
        fibrousCarbs: newTargets.fibrousCarbs,
        starchyCarbs: newTargets.starchyCarbs,
        fat: newTargets.fat,
      },
    };

    fetch(apiUrl(`/api/users/${userId}/app-preferences`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, [storageKey]);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setTargets((t) => { saveToServer(next, t); return t; });
      return next;
    });
  }, [saveToServer]);

  const updateTarget = useCallback((field: keyof MacroTargets, value: number | '') => {
    setTargets((prev) => {
      const next = { ...prev, [field]: value };
      saveToServer(enabled, next);
      return next;
    });
  }, [enabled, saveToServer]);

  const applyPreset = useCallback((preset: MacroTargets) => {
    setTargets(preset);
    saveToServer(enabled, preset);
  }, [enabled, saveToServer]);

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

    if (typeof targets.protein === 'number' && targets.protein > 0) result.protein_g = targets.protein;
    if (typeof targets.fibrousCarbs === 'number' && targets.fibrousCarbs > 0) result.fibrous_carbs_g = targets.fibrousCarbs;
    if (typeof targets.starchyCarbs === 'number' && targets.starchyCarbs > 0) result.starchy_carbs_g = targets.starchyCarbs;
    if (typeof targets.fat === 'number' && targets.fat > 0) result.fat_g = targets.fat;

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
