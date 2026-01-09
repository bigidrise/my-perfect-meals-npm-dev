// client/src/lib/guestMode.ts
// Guest Mode: Apple App Review Compliant - Guided Preview Experience
// Single Source of Truth for all guest progress state

const GUEST_SESSION_KEY = "mpm_guest_session";
const GUEST_PROGRESS_KEY = "mpm_guest_progress";
const GUEST_GENERATIONS_KEY = "mpm_guest_generations";

// Configuration
const MAX_GUEST_GENERATIONS = 4; // Maximum meals a guest can build
const GUEST_DURATION_DAYS = 3; // Guest mode expires after 3 days

// ============================================
// GUEST PROGRESS STATE (Single Source of Truth)
// ============================================

export interface GuestProgress {
  macrosCompleted: boolean;
  mealsBuiltCount: number;
  guestUsesRemaining: number;
  guestStartDate: number;
}

export interface GuestSession {
  isGuest: true;
  sessionId: string;
  startedAt: number;
  generationsUsed: number;
  dayBuilt: boolean;
  progress: GuestProgress;
}

// Default progress state for new guests
function createDefaultProgress(): GuestProgress {
  return {
    macrosCompleted: false,
    mealsBuiltCount: 0,
    guestUsesRemaining: MAX_GUEST_GENERATIONS,
    guestStartDate: Date.now(),
  };
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export function startGuestSession(): GuestSession {
  const progress = createDefaultProgress();
  
  const session: GuestSession = {
    isGuest: true,
    sessionId: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: Date.now(),
    generationsUsed: 0,
    dayBuilt: false,
    progress,
  };
  
  // Use localStorage for persistence across browser sessions (Apple Review friendly)
  localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(progress));
  localStorage.setItem(GUEST_GENERATIONS_KEY, "0");
  
  console.log("🎫 Guest session started:", session.sessionId);
  
  return session;
}

export function getGuestSession(): GuestSession | null {
  try {
    const stored = localStorage.getItem(GUEST_SESSION_KEY);
    if (!stored) {
      // Fallback to sessionStorage for backwards compatibility
      const sessionStored = sessionStorage.getItem(GUEST_SESSION_KEY);
      if (sessionStored) {
        const session = JSON.parse(sessionStored) as GuestSession;
        // Migrate to localStorage
        localStorage.setItem(GUEST_SESSION_KEY, sessionStored);
        sessionStorage.removeItem(GUEST_SESSION_KEY);
        // Ensure progress exists
        if (!session.progress) {
          session.progress = createDefaultProgress();
          session.progress.guestStartDate = session.startedAt;
          localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
        }
        return session;
      }
      return null;
    }
    
    const session = JSON.parse(stored) as GuestSession;
    
    // Ensure progress exists (migration for existing sessions)
    if (!session.progress) {
      session.progress = createDefaultProgress();
      session.progress.guestStartDate = session.startedAt;
      session.progress.guestUsesRemaining = MAX_GUEST_GENERATIONS - session.generationsUsed;
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
    }
    
    return session;
  } catch {
    return null;
  }
}

function updateGuestSession(updates: Partial<GuestSession>): void {
  const session = getGuestSession();
  if (!session) return;
  
  const updated = { ...session, ...updates };
  localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(updated));
}

export function isGuestMode(): boolean {
  return getGuestSession() !== null;
}

export function endGuestSession(): void {
  localStorage.removeItem(GUEST_SESSION_KEY);
  localStorage.removeItem(GUEST_PROGRESS_KEY);
  localStorage.removeItem(GUEST_GENERATIONS_KEY);
  // Also clean up any legacy sessionStorage
  sessionStorage.removeItem(GUEST_SESSION_KEY);
  sessionStorage.removeItem(GUEST_GENERATIONS_KEY);
  console.log("🎫 Guest session ended");
}

// ============================================
// GUEST PROGRESS HELPERS
// ============================================

export function getGuestProgress(): GuestProgress | null {
  const session = getGuestSession();
  return session?.progress ?? null;
}

function updateGuestProgress(updates: Partial<GuestProgress>): void {
  const session = getGuestSession();
  if (!session) return;
  
  session.progress = { ...session.progress, ...updates };
  localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(session.progress));
}

// ============================================
// PROGRESSIVE UNLOCK STATE
// ============================================

/**
 * Mark macros as completed - unlocks Weekly Meal Builder
 */
export function markMacrosCompleted(): void {
  updateGuestProgress({ macrosCompleted: true });
  console.log("✅ Guest: Macros completed - Weekly Meal Builder unlocked");
}

/**
 * Check if guest has completed macros
 */
export function hasCompletedMacros(): boolean {
  const progress = getGuestProgress();
  return progress?.macrosCompleted ?? false;
}

/**
 * Increment meal count when a meal is actually added to the board
 * This unlocks Fridge Rescue & Craving Creator after first meal
 */
export function incrementMealsBuilt(): void {
  const progress = getGuestProgress();
  if (!progress) return;
  
  const newCount = progress.mealsBuiltCount + 1;
  const newRemaining = Math.max(0, progress.guestUsesRemaining - 1);
  
  updateGuestProgress({
    mealsBuiltCount: newCount,
    guestUsesRemaining: newRemaining,
  });
  
  // Also update legacy counter for backwards compatibility
  const session = getGuestSession();
  if (session) {
    session.generationsUsed = newCount;
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(GUEST_GENERATIONS_KEY, newCount.toString());
  }
  
  console.log(`✅ Guest: Meal ${newCount} built - ${newRemaining} remaining`);
  
  if (newCount === 1) {
    console.log("🔓 Guest: First meal built - Fridge Rescue & Craving Creator unlocked");
  }
}

/**
 * Check if guest has built at least one meal (unlocks lifestyle tools)
 */
export function hasBuiltFirstMeal(): boolean {
  const progress = getGuestProgress();
  return (progress?.mealsBuiltCount ?? 0) >= 1;
}

/**
 * Get number of meals built
 */
export function getMealsBuiltCount(): number {
  const progress = getGuestProgress();
  return progress?.mealsBuiltCount ?? 0;
}

// ============================================
// FEATURE ACCESS CHECKS
// ============================================

export type GuestFeature = 
  | "macro-calculator"
  | "weekly-meal-builder"
  | "fridge-rescue"
  | "craving-creator"
  | "biometrics"
  | "shopping-list";

/**
 * Check if a guest feature is unlocked
 * This is the SINGLE SOURCE OF TRUTH for feature access
 */
export function isGuestFeatureUnlocked(feature: GuestFeature): boolean {
  if (!isGuestMode()) return true; // Non-guests have full access
  
  const progress = getGuestProgress();
  if (!progress) return false;
  
  switch (feature) {
    case "macro-calculator":
      // Always available to guests
      return true;
      
    case "weekly-meal-builder":
      // Unlocked after completing macros
      return progress.macrosCompleted;
      
    case "fridge-rescue":
    case "craving-creator":
      // Unlocked after building first meal
      return progress.mealsBuiltCount >= 1;
      
    case "biometrics":
    case "shopping-list":
      // Available after completing macros
      return progress.macrosCompleted;
      
    default:
      return false;
  }
}

/**
 * Get the unlock requirement message for a locked feature
 * Used for tooltips/toasts when tapping locked features
 */
export function getFeatureUnlockMessage(feature: GuestFeature): string {
  switch (feature) {
    case "weekly-meal-builder":
      return "Complete the Macro Calculator to unlock this feature.";
      
    case "fridge-rescue":
    case "craving-creator":
      return "Build your first meal in the Weekly Meal Builder to unlock this feature.";
      
    case "biometrics":
    case "shopping-list":
      return "Complete the Macro Calculator to unlock this feature.";
      
    default:
      return "Complete the guided steps to unlock this feature.";
  }
}

/**
 * Get the next step message for Copilot guidance
 */
export function getGuestNextStepMessage(): string {
  const progress = getGuestProgress();
  if (!progress) return "";
  
  if (!progress.macrosCompleted) {
    return "Start by completing the Macro Calculator to set up your nutrition goals.";
  }
  
  if (progress.mealsBuiltCount === 0) {
    return "Great! Now head to the Weekly Meal Builder to create your first meal.";
  }
  
  return "You've unlocked all features! Explore Fridge Rescue and Craving Creator, or keep building meals.";
}

// ============================================
// USAGE LIMITS (Soft Gating)
// ============================================

export function getGuestGenerationsRemaining(): number {
  const progress = getGuestProgress();
  return progress?.guestUsesRemaining ?? 0;
}

export function canGuestGenerate(): boolean {
  return getGuestGenerationsRemaining() > 0;
}

export function isGuestExpired(): boolean {
  const progress = getGuestProgress();
  if (!progress) return false;
  
  const daysSinceStart = (Date.now() - progress.guestStartDate) / (1000 * 60 * 60 * 24);
  return daysSinceStart >= GUEST_DURATION_DAYS;
}

export function getGuestDaysRemaining(): number {
  const progress = getGuestProgress();
  if (!progress) return 0;
  
  const daysSinceStart = (Date.now() - progress.guestStartDate) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(GUEST_DURATION_DAYS - daysSinceStart));
}

/**
 * Check if guest should see upgrade prompt (limits reached but not blocked)
 */
export function shouldShowGuestUpgradePrompt(): boolean {
  return !canGuestGenerate() || isGuestExpired();
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

export function incrementGuestGeneration(): boolean {
  const progress = getGuestProgress();
  if (!progress || progress.guestUsesRemaining <= 0) {
    return false;
  }
  
  incrementMealsBuilt();
  return true;
}

export function markGuestDayBuilt(): void {
  const session = getGuestSession();
  if (!session) return;
  
  session.dayBuilt = true;
  localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
}

export function hasGuestBuiltDay(): boolean {
  const session = getGuestSession();
  return session?.dayBuilt ?? false;
}

// ============================================
// ROUTE ACCESS
// ============================================

// Pages guests CAN access (initial)
export const GUEST_ALLOWED_ROUTES = [
  "/welcome",
  "/guest-builder",
  "/macro-counter",
  "/weekly-meal-board",
  "/craving-creator",
  "/fridge-rescue",
  "/privacy-policy",
  "/terms",
];

// Pages that require account (show soft gate)
export const ACCOUNT_REQUIRED_ROUTES = [
  "/dashboard",
  "/shopping-list",
  "/procare-cover",
  "/care-team",
  "/pro-portal",
  "/diabetic-hub",
  "/glp1-hub",
  "/beach-body-meal-board",
];

export function isGuestAllowedRoute(path: string): boolean {
  return GUEST_ALLOWED_ROUTES.some(route => path.startsWith(route));
}

export function requiresAccount(path: string): boolean {
  return ACCOUNT_REQUIRED_ROUTES.some(route => path.startsWith(route));
}

// ============================================
// DEBUG HELPERS (Dev Only)
// ============================================

export function debugSetGuestProgress(progress: Partial<GuestProgress>): void {
  if (process.env.NODE_ENV !== "development") return;
  updateGuestProgress(progress);
  console.log("🔧 Debug: Guest progress updated:", getGuestProgress());
}

export function debugResetGuestProgress(): void {
  if (process.env.NODE_ENV !== "development") return;
  const session = getGuestSession();
  if (session) {
    session.progress = createDefaultProgress();
    session.generationsUsed = 0;
    session.dayBuilt = false;
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(GUEST_GENERATIONS_KEY, "0");
    console.log("🔧 Debug: Guest progress reset");
  }
}
