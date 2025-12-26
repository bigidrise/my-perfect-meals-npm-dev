// client/src/lib/macroResolver.ts
// Unified macro targets resolver - connects ProCare professional targets with client self-set targets

import { getMacroTargets, setMacroTargets, type MacroTargets } from './dailyLimits';
import { proStore, type Targets } from './proData';

export type MacroSource = 'pro' | 'self' | 'none';

export type ResolvedTargets = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  // Carb breakdown (optional - only available when pro targets or explicit breakdown is set)
  starchyCarbs_g?: number;
  fibrousCarbs_g?: number;
  source: MacroSource;
  flags?: {
    // Medical flags (for doctors/dietitians)
    lowSodium?: boolean;
    diabetesFriendly?: boolean;
    glp1?: boolean;
    cardiac?: boolean;
    renal?: boolean;
    postBariatric?: boolean;
    
    // Performance flags (for trainers)
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
  setBy?: string; // Professional name if source=pro
};

const LS_USER_CLIENT_MAP = 'mpm_user_client_map'; // Maps userId to clientId

// Helper to get current user's client ID (if they're a ProCare client)
function getCurrentUserClientId(userId: string = 'anon'): string | null {
  try {
    const mapRaw = localStorage.getItem(LS_USER_CLIENT_MAP);
    if (!mapRaw) return null;
    const map = JSON.parse(mapRaw);
    return map[userId] || null;
  } catch {
    return null;
  }
}

// Link a user to their ProCare client profile
export function linkUserToClient(userId: string, clientId: string) {
  try {
    const mapRaw = localStorage.getItem(LS_USER_CLIENT_MAP) || '{}';
    const map = JSON.parse(mapRaw);
    map[userId] = clientId;
    localStorage.setItem(LS_USER_CLIENT_MAP, JSON.stringify(map));
  } catch (e) {
    console.error('Failed to link user to client:', e);
  }
}

// Get self-set targets from dailyLimits system
function getSelfTargets(userId?: string): MacroTargets | null {
  return getMacroTargets(userId);
}

// Main resolver: returns pro targets if set, otherwise self targets
export function getResolvedTargets(userId?: string): ResolvedTargets {
  // Try to get professional targets first
  const clientId = getCurrentUserClientId(userId);
  
  if (clientId) {
    const proTargets = proStore.getTargets(clientId);
    // Calculate totals from the stored structure
    const totalCarbs = (proTargets?.starchyCarbs || 0) + (proTargets?.fibrousCarbs || 0);
    const totalKcal = ((proTargets?.protein || 0) * 4) + (totalCarbs * 4) + ((proTargets?.fat || 0) * 9);
    
    // Check if these are actual pro-set targets (not just defaults)
    // Must check ALL macro fields since trainers often only adjust carbs/fat
    const hasProTargets = proTargets && (
      totalKcal !== 2000 || 
      proTargets.protein !== 160 || 
      totalCarbs !== 180 ||
      proTargets.fat !== 70 ||
      Object.keys(proTargets.flags || {}).length > 0
    );
    
    if (hasProTargets) {
      // Get professional title from client's role
      const client = proStore.getClient(clientId);
      const role = client?.role;
      
      // Map role to professional title
      let proTitle = 'Your professional';
      if (role === 'doctor') proTitle = 'Your physician';
      else if (role === 'nurse' || role === 'pa') proTitle = 'Your clinician';
      else if (role === 'nutritionist' || role === 'dietitian') proTitle = 'Your dietitian';
      else if (role === 'trainer') proTitle = 'Your trainer';
      
      return {
        calories: totalKcal,
        protein_g: proTargets.protein,
        carbs_g: totalCarbs,
        fat_g: proTargets.fat,
        // Include starchy/fibrous breakdown from pro targets
        starchyCarbs_g: proTargets.starchyCarbs || 0,
        fibrousCarbs_g: proTargets.fibrousCarbs || 0,
        source: 'pro',
        flags: proTargets.flags,
        allergens: proTargets.allergens,
        carbDirective: proTargets.carbDirective,
        setBy: proTitle,
      };
    }
  }
  
  // Fall back to self-set targets
  const selfTargets = getSelfTargets(userId);
  if (selfTargets) {
    return {
      calories: selfTargets.calories,
      protein_g: selfTargets.protein_g,
      carbs_g: selfTargets.carbs_g,
      fat_g: selfTargets.fat_g,
      source: 'self',
    };
  }
  
  // No targets set at all
  return {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    source: 'none',
  };
}

// Save self-set targets (from macro calculator)
export function saveSelfTargets(macros: MacroTargets, userId?: string) {
  setMacroTargets(macros, userId);
  
  // Dispatch event to notify Biometrics page of target updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mpm:targetsUpdated'));
  }
}

// Check if professional has overridden targets
export function hasProOverride(userId?: string): boolean {
  const resolved = getResolvedTargets(userId);
  return resolved.source === 'pro';
}
