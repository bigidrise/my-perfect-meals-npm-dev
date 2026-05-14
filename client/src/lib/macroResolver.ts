// client/src/lib/macroResolver.ts
// Unified macro targets resolver - connects ProCare professional targets with client self-set targets

import { getMacroTargets, setMacroTargets, type MacroTargets, type StarchStrategy } from './dailyLimits';
import { proStore, type Targets } from './proData';

export type MacroSource = 'pro' | 'self' | 'none';

// ProCare coach override hook — allows coach to override individual macro multipliers.
// When present, these values take precedence over strategy-layer multipliers.
// No UI yet — this is reserved for ProCare and advanced mode.
export type CoachMacroOverride = {
  proteinMult?: number;
  starchyMult?: number;
  fatMult?: number;
};

export type ResolvedTargets = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  starchyCarbs_g?: number;
  fibrousCarbs_g?: number;
  starchStrategy?: StarchStrategy;
  source: MacroSource;
  flags?: {
    lowSodium?: boolean;
    diabetesFriendly?: boolean;
    glp1?: boolean;
    cardiac?: boolean;
    renal?: boolean;
    postBariatric?: boolean;
    liverDisease?: boolean;
    liverSupport?: boolean;
    thyroidSupport?: boolean;
    oncologySupport?: boolean;
    highProtein?: boolean;
    carbCycling?: boolean;
    antiInflammatory?: boolean;
  };
  allergens?: string[];
  carbDirective?: {
    starchyCapG?: number | null;
    fibrousFloorG?: number | null;
    addedSugarCapG?: number | null;
  };
  setBy?: string;
  // ProCare hook: coach-level multiplier overrides (no UI yet)
  coachOverride?: CoachMacroOverride;
};

const LS_USER_CLIENT_MAP = 'mpm_user_client_map';

// Item 4: Session-level cache — cleared when targets are updated
const resolvedTargetsCache: Record<string, ResolvedTargets> = {};

export function clearResolvedTargetsCache() {
  Object.keys(resolvedTargetsCache).forEach(k => delete resolvedTargetsCache[k]);
}

// Listen for target updates and clear cache automatically
if (typeof window !== 'undefined') {
  window.addEventListener('mpm:targetsUpdated', () => clearResolvedTargetsCache());
}

// Item 2: Null-safe localStorage map read
function getUserClientMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_USER_CLIENT_MAP) || '{}');
  } catch {
    return {};
  }
}

function getCurrentUserClientId(userId: string = 'anon'): string | null {
  return getUserClientMap()[userId] || null;
}

// Link a user to their ProCare client profile
export function linkUserToClient(userId: string, clientId: string) {
  try {
    const map = getUserClientMap();
    map[userId] = clientId;
    localStorage.setItem(LS_USER_CLIENT_MAP, JSON.stringify(map));
    // Clear cache so next read reflects the new mapping
    clearResolvedTargetsCache();
  } catch (e) {
    console.error('Failed to link user to client:', e);
  }
}

// Remove a user's ProCare mapping from localStorage (called when isProCare = false)
export function unlinkUser(userId: string) {
  try {
    const map = getUserClientMap();
    if (map[userId]) {
      delete map[userId];
      localStorage.setItem(LS_USER_CLIENT_MAP, JSON.stringify(map));
      clearResolvedTargetsCache();
    }
  } catch (e) {
    console.error('Failed to unlink user from ProCare client map:', e);
  }
}

function getSelfTargets(userId?: string): MacroTargets | null {
  return getMacroTargets(userId);
}

// Item 3: Guarantee mapping exists for a known clientId/realUserId pair
export function ensureClientMapping(realUserId: string, clientId: string) {
  if (realUserId && clientId) {
    linkUserToClient(realUserId, clientId);
    linkUserToClient(clientId, clientId);
  }
}

// Priority: 1 = Pro (trainer/physician) targets, 2 = self targets, 3 = none
export function getResolvedTargets(userId?: string): ResolvedTargets {
  const cacheKey = userId || 'anon';

  // Item 4: Return cached result if available
  if (resolvedTargetsCache[cacheKey]) {
    return resolvedTargetsCache[cacheKey];
  }

  let result: ResolvedTargets;

  // Priority 1: Professional targets
  const clientId = getCurrentUserClientId(userId);

  if (clientId) {
    // Item 1 fix: Use provenance check instead of magic-number comparison
    const hasPro = proStore.hasTargets(clientId);

    if (hasPro) {
      const proTargets = proStore.getTargets(clientId);

      // When the coach left starchy/fibrous blank (zero), fall back to the
      // user's own macro-calculator targets for those two fields only.
      // Protein, fat, and all other pro fields are still coach-authoritative.
      const selfFallback = proTargets.starchyCarbs > 0 && proTargets.fibrousCarbs > 0
        ? null
        : getSelfTargets(userId);
      const resolvedStarchy = proTargets.starchyCarbs > 0
        ? proTargets.starchyCarbs
        : (selfFallback?.starchyCarbs_g ?? 0);
      const resolvedFibrous = proTargets.fibrousCarbs > 0
        ? proTargets.fibrousCarbs
        : (selfFallback?.fibrousCarbs_g ?? 0);

      const totalCarbs = resolvedStarchy + resolvedFibrous;
      const totalKcal = ((proTargets.protein || 0) * 4) + (totalCarbs * 4) + ((proTargets.fat || 0) * 9);

      const client = proStore.getClient(clientId);
      const role = client?.role;
      let proTitle = 'Your professional';
      if (role === 'doctor') proTitle = 'Your physician';
      else if (role === 'rn' || role === 'np' || role === 'pa') proTitle = 'Your clinician';
      else if (role === 'nutritionist' || role === 'dietitian') proTitle = 'Your dietitian';
      else if (role === 'trainer') proTitle = 'Your trainer';

      result = {
        calories: totalKcal,
        protein_g: proTargets.protein,
        carbs_g: totalCarbs,
        fat_g: proTargets.fat,
        starchyCarbs_g: resolvedStarchy,
        fibrousCarbs_g: resolvedFibrous,
        starchStrategy: proTargets.starchStrategy || 'one',
        source: 'pro',
        flags: proTargets.flags,
        allergens: proTargets.allergens,
        carbDirective: proTargets.carbDirective,
        setBy: proTitle,
      };

      // Item 7: Debug log
      console.log('[MPM] Target Source:', result.source, `(${proTitle})`, result.calories, 'kcal');
      resolvedTargetsCache[cacheKey] = result;
      return result;
    }
  }

  // Priority 2: Self-set targets
  const selfTargets = getSelfTargets(userId);
  if (selfTargets) {
    result = {
      calories: selfTargets.calories,
      protein_g: selfTargets.protein_g,
      carbs_g: selfTargets.carbs_g,
      fat_g: selfTargets.fat_g,
      starchyCarbs_g: selfTargets.starchyCarbs_g,
      fibrousCarbs_g: selfTargets.fibrousCarbs_g,
      starchStrategy: selfTargets.starchStrategy || 'one',
      source: 'self',
    };

    // Item 7: Debug log
    console.log('[MPM] Target Source: self', result.calories, 'kcal');
    resolvedTargetsCache[cacheKey] = result;
    return result;
  }

  // Priority 3: No targets set
  result = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    starchStrategy: 'one',
    source: 'none',
  };

  // Item 7: Debug log
  console.log('[MPM] Target Source: none — no targets set for', userId);
  resolvedTargetsCache[cacheKey] = result;
  return result;
}

// Save self-set targets (from macro calculator)
export function saveSelfTargets(macros: MacroTargets, userId?: string) {
  setMacroTargets(macros, userId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mpm:targetsUpdated'));
  }
}

export function hasProOverride(userId?: string): boolean {
  return getResolvedTargets(userId).source === 'pro';
}

/**
 * Canonical carb sub-target resolver.
 * Always call this — never read starchyCarbs_g / fibrousCarbs_g directly from
 * a resolved target object. Directive-based builders (Anti-Inflammatory, etc.)
 * store caps/floors in carbDirective instead of the gram fields; this helper
 * collapses both representations into plain numbers so every UI component
 * reads the same values without needing to know about the internal storage model.
 */
export function resolveDisplayCarbTargets(targets: {
  starchyCarbs_g?: number | null;
  fibrousCarbs_g?: number | null;
  carbDirective?: {
    starchyCapG?: number | null;
    fibrousFloorG?: number | null;
  };
}): { starchyCarbs_g: number; fibrousCarbs_g: number } {
  return {
    starchyCarbs_g: targets.starchyCarbs_g ?? targets.carbDirective?.starchyCapG ?? 0,
    fibrousCarbs_g: targets.fibrousCarbs_g ?? targets.carbDirective?.fibrousFloorG ?? 0,
  };
}
