// client/src/lib/guestMode.ts
// Guest Mode: Apple App Review Compliant - Guided Preview Experience
// Single Source of Truth for all guest progress state

const GUEST_SESSION_KEY = "mpm_guest_session";
const GUEST_PROGRESS_KEY = "mpm_guest_progress";
const GUEST_GENERATIONS_KEY = "mpm_guest_generations";

// Configuration
const MAX_GUEST_GENERATIONS = 4; // Maximum meals a guest can build
const GUEST_DURATION_DAYS = 14; // Guest mode expires after 14-day concierge trial
const MAX_GUEST_LOOPS = 4; // Maximum full loops (hard gate at 4)
const SOFT_NUDGE_LOOP = 3; // Show soft nudge at loop 3
const MEAL_DAY_SESSION_HOURS = 24; // Active meal day session lasts 24 hours

// ============================================
// DEV SPACE BYPASS - Unlimited access for testing
// ============================================
function isDevSpace(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  // Production domains should enforce limits
  if (hostname === "myperfectmeals.com" || hostname === "www.myperfectmeals.com") {
    return false;
  }
  // iOS native app should enforce limits
  if ((window as any).Capacitor?.isNativePlatform?.()) {
    return false;
  }
  // All other environments (dev spaces, staging, localhost) = unlimited
  return true;
}

// ============================================
// GUEST SUITE JOURNEY STATE (Phase System)
// ============================================

export type GuestSuitePhase = 1 | 2;

export type GuestCompletedStep = 
  | "macros_saved"
  | "meal_built"
  | "shopping_viewed"
  | "biometrics_viewed";

// ============================================
// GUEST PROGRESS STATE (Single Source of Truth)
// ============================================

export interface GuestProgress {
  macrosCompleted: boolean;
  mealsBuiltCount: number;
  guestUsesRemaining: number;
  guestStartDate: number;
  // Phase system
  phase: GuestSuitePhase;
  completedSteps: GuestCompletedStep[];
  loopCount: number;
  // Active meal day session (24-hour window)
  // When set, guest can freely explore and return to meal board without consuming another day
  activeMealDaySessionStart?: number;
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
    // Phase system
    phase: 1,
    completedSteps: [],
    loopCount: 0,
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
  
  // Clear any stale first-loop flag from previous sessions
  localStorage.removeItem("mpm_guest_first_loop_complete");
  
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
 * Increment meal count when a meal is actually added to the board.
 * This handles unlock progression (Fridge Rescue & Craving Creator).
 * Also triggers meal day counting if within a meal board visit.
 * 
 * This is the SINGLE entry point for all meal additions - ensures
 * both mealsBuiltCount and loopCount are properly tracked.
 */
export function incrementMealsBuilt(): void {
  const progress = getGuestProgress();
  if (!progress) return;
  
  const newCount = progress.mealsBuiltCount + 1;
  
  // Update mealsBuiltCount for unlock progression
  updateGuestProgress({
    mealsBuiltCount: newCount,
  });
  
  // Keep legacy counters in sync for backwards compatibility
  const session = getGuestSession();
  if (session) {
    session.generationsUsed = newCount;
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(GUEST_GENERATIONS_KEY, newCount.toString());
  }
  
  console.log(`✅ Guest: Meal ${newCount} added to board`);
  
  if (newCount === 1) {
    console.log("🔓 Guest: First meal built - Fridge Rescue & Craving Creator unlocked");
  }
  
  // NOTE: Meal day consumption now happens on board ENTRY (startMealBoardVisit)
  // NOT on meal building. This enables the 24-hour session model where
  // guests can freely explore and return without burning additional days.
  
  // Dispatch event for meal updates
  window.dispatchEvent(new CustomEvent("guestProgressUpdate", {
    detail: { action: "mealBuilt", mealsBuiltCount: newCount }
  }));
}

// ============================================
// MEAL DAY SESSION (24-Hour Active Session)
// ============================================
// CONCEPT: A "meal day" is a 24-hour window, not a single visit.
// Fridge Rescue & Craving Creator are FREE to explore.
// Only entering Weekly Meal Board WITHOUT an active session consumes a meal day.
// Once a session is active, guest can explore, leave, and return freely.

/**
 * Check if there's an active meal day session (within 24 hours).
 */
export function hasActiveMealDaySession(): boolean {
  if (!isGuestMode()) return false;
  
  const progress = getGuestProgress();
  if (!progress?.activeMealDaySessionStart) return false;
  
  const now = Date.now();
  const sessionStart = progress.activeMealDaySessionStart;
  const hoursElapsed = (now - sessionStart) / (1000 * 60 * 60);
  
  return hoursElapsed < MEAL_DAY_SESSION_HOURS;
}

/**
 * Get remaining time in active session (for UI display).
 * Returns null if no active session.
 */
export function getActiveMealDaySessionRemaining(): { hours: number; minutes: number } | null {
  if (!isGuestMode()) return null;
  
  const progress = getGuestProgress();
  if (!progress?.activeMealDaySessionStart) return null;
  
  const now = Date.now();
  const sessionStart = progress.activeMealDaySessionStart;
  const msElapsed = now - sessionStart;
  const msTotal = MEAL_DAY_SESSION_HOURS * 60 * 60 * 1000;
  const msRemaining = msTotal - msElapsed;
  
  if (msRemaining <= 0) return null;
  
  const hours = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes };
}

/**
 * Start a meal board visit. Called when WeeklyMealBoard mounts.
 * Consumes a meal day ONLY if there's no active session.
 * Returns true if a NEW meal day was consumed.
 */
export function startMealBoardVisit(): boolean {
  if (!isGuestMode()) return false;
  
  const progress = getGuestProgress();
  if (!progress) return false;
  
  // GUARD: Prevent exceeding the meal day cap
  if (progress.loopCount >= MAX_GUEST_LOOPS) {
    console.log(`🚫 Guest: Already at max meal days (${progress.loopCount}/${MAX_GUEST_LOOPS})`);
    return false;
  }
  
  // Check if there's an active session (within 24 hours)
  if (hasActiveMealDaySession()) {
    console.log(`📋 Guest: Returning to active meal day session (still valid)`);
    return false; // No new meal day consumed
  }
  
  // No active session - start a new one and consume a meal day
  const newLoopCount = progress.loopCount + 1;
  
  updateGuestProgress({
    loopCount: newLoopCount,
    activeMealDaySessionStart: Date.now(),
  });
  
  console.log(`🗓️ Guest: Meal Day ${newLoopCount} of ${MAX_GUEST_LOOPS} started (24-hour session)`);
  
  // Dispatch event for meal day consumption
  window.dispatchEvent(new CustomEvent("guestProgressUpdate", {
    detail: { action: "mealDayUsed", loopCount: newLoopCount }
  }));
  
  return true;
}

/**
 * End the current meal board visit.
 * Note: This does NOT end the 24-hour session - just the current visit.
 * Guest can return to the meal board within 24 hours without consuming another day.
 */
export function endMealBoardVisit(): void {
  // Session persists for 24 hours, so nothing to do here
  // Just log for debugging
  if (isGuestMode()) {
    const remaining = getActiveMealDaySessionRemaining();
    if (remaining) {
      console.log(`📋 Guest: Left meal board. Session active for ${remaining.hours}h ${remaining.minutes}m more.`);
    }
  }
}

/**
 * DEPRECATED: Use startMealBoardVisit() instead.
 * Kept for backward compatibility - now just checks/extends session.
 */
export function countMealDayUsed(): boolean {
  // This is now a no-op since meal days are consumed on board ENTRY, not meal building
  // Kept for backward compatibility with existing incrementMealsBuilt() call
  return false;
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

const GUEST_FIRST_LOOP_KEY = "mpm_guest_first_loop_complete";

/**
 * Check if guest has completed their first loop (Shopping → Biometrics transition)
 * This is a local helper to avoid circular imports with guestSuiteNavigator
 */
function hasCompletedFirstLoopFlag(): boolean {
  if (!isGuestMode()) return true;
  try {
    return localStorage.getItem(GUEST_FIRST_LOOP_KEY) === "true";
  } catch {
    return false;
  }
}

export type GuestFeature = 
  | "macro-calculator"
  | "weekly-meal-builder"
  | "fridge-rescue"
  | "craving-creator"
  | "biometrics"
  | "shopping-list"
  | "chefs-kitchen";

/**
 * Check if a guest feature is unlocked
 * This is the SINGLE SOURCE OF TRUTH for feature access
 * 
 * Simple unlock: Macro Calculator always open, everything else unlocks when macros completed
 */
export function isGuestFeatureUnlocked(feature: GuestFeature): boolean {
  if (!isGuestMode()) return true; // Non-guests have full access
  
  const progress = getGuestProgress();
  if (!progress) return false;
  
  switch (feature) {
    case "macro-calculator":
      // Always available to guests - entry point
      return true;
      
    case "weekly-meal-builder":
    case "fridge-rescue":
    case "craving-creator":
    case "biometrics":
    case "shopping-list":
    case "chefs-kitchen":
      // ALL features unlock together after completing macros
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
    case "fridge-rescue":
    case "craving-creator":
    case "biometrics":
    case "shopping-list":
    case "chefs-kitchen":
      return "Complete the Macro Calculator to unlock all features.";
      
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
  // Dev space bypass - unlimited generations for testing
  if (isDevSpace()) return true;
  return getGuestGenerationsRemaining() > 0;
}

export function isGuestExpired(): boolean {
  // Dev space bypass - never expire for testing
  if (isDevSpace()) return false;
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
  // Dev space bypass - never show upgrade prompts for testing
  if (isDevSpace()) return false;
  return !canGuestGenerate() || isGuestExpired();
}

/**
 * Export isDevSpace for use in other modules
 */
export { isDevSpace };

// ============================================
// GENERATION TRACKING (separate from meal-building unlocks)
// ============================================

/**
 * Track a generation usage WITHOUT affecting mealsBuiltCount or unlock progression.
 * mealsBuiltCount should only increment when a meal is placed on the board.
 * This function only decrements guestUsesRemaining for limit enforcement.
 * 
 * NOTE: Legacy counters (generationsUsed, GUEST_GENERATIONS_KEY) are updated by
 * incrementMealsBuilt() when meals are added to the board, not here.
 */
export function trackGuestGenerationUsage(): boolean {
  const progress = getGuestProgress();
  if (!progress || progress.guestUsesRemaining <= 0) {
    return false;
  }
  
  const newRemaining = Math.max(0, progress.guestUsesRemaining - 1);
  
  updateGuestProgress({
    guestUsesRemaining: newRemaining,
  });
  
  console.log(`✅ Guest: Generation used - ${newRemaining} remaining`);
  return true;
}

/**
 * @deprecated Use trackGuestGenerationUsage() instead
 * Legacy function maintained for backwards compatibility
 */
export function incrementGuestGeneration(): boolean {
  return trackGuestGenerationUsage();
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
// GUEST SUITE PHASE SYSTEM
// ============================================

/**
 * Get current phase (1 = Guided Build, 2 = Revealed/Unlocked)
 */
export function getGuestSuitePhase(): GuestSuitePhase {
  const progress = getGuestProgress();
  return progress?.phase ?? 1;
}

/**
 * Get completed steps
 */
export function getCompletedSteps(): GuestCompletedStep[] {
  const progress = getGuestProgress();
  return progress?.completedSteps ?? [];
}

/**
 * Check if a step is completed
 */
export function isStepCompleted(step: GuestCompletedStep): boolean {
  return getCompletedSteps().includes(step);
}

/**
 * Mark a step as completed
 * Phase 2 unlocks when shopping_viewed is completed AND a meal has been built
 */
export function markStepCompleted(step: GuestCompletedStep): void {
  const progress = getGuestProgress();
  if (!progress) return;
  
  if (!progress.completedSteps.includes(step)) {
    const newSteps = [...progress.completedSteps, step];
    updateGuestProgress({ completedSteps: newSteps });
    console.log(`✅ Guest: Step completed - ${step}`);
    
    // Trigger Phase 2 unlock when shopping is viewed after building a meal
    if (step === "shopping_viewed" && progress.mealsBuiltCount >= 1 && progress.phase === 1) {
      unlockGuestSuitePhase2();
    }
    
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent("guestProgressUpdate", {
      detail: { action: "stepCompleted", step }
    }));
  }
}

/**
 * Transition to Phase 2 (Revealed/Unlocked state)
 * Called when guest exits Shopping List after first loop
 */
export function unlockGuestSuitePhase2(): void {
  const progress = getGuestProgress();
  if (!progress || progress.phase === 2) return;
  
  updateGuestProgress({ phase: 2 });
  console.log("🔓 Guest Suite: Phase 2 unlocked - Biometrics revealed");
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent("guestProgressUpdate", {
    detail: { action: "phase2Unlocked" }
  }));
}

/**
 * Get current loop count
 */
export function getGuestLoopCount(): number {
  const progress = getGuestProgress();
  return progress?.loopCount ?? 0;
}

/**
 * Increment loop count (called when exiting Shopping List)
 */
export function incrementGuestLoop(): void {
  const progress = getGuestProgress();
  if (!progress) return;
  
  const newLoopCount = progress.loopCount + 1;
  updateGuestProgress({ loopCount: newLoopCount });
  console.log(`🔄 Guest Suite: Loop ${newLoopCount} completed`);
  
  // If first loop completion, unlock Phase 2
  if (newLoopCount === 1) {
    unlockGuestSuitePhase2();
  }
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent("guestProgressUpdate", {
    detail: { action: "loopCompleted", loopCount: newLoopCount }
  }));
}

/**
 * Check if soft nudge should be shown (at loop 3)
 */
export function shouldShowSoftNudge(): boolean {
  return getGuestLoopCount() >= SOFT_NUDGE_LOOP;
}

/**
 * Check if hard gate should be shown (at loop 4)
 */
export function shouldShowHardGate(): boolean {
  // Dev space bypass - never show hard gate for testing
  if (isDevSpace()) return false;
  return getGuestLoopCount() >= MAX_GUEST_LOOPS;
}

/**
 * Check if biometrics is revealed (Phase 2)
 */
export function isBiometricsRevealed(): boolean {
  return getGuestSuitePhase() === 2;
}

// ============================================
// ROUTE ACCESS
// ============================================

// Pages guests CAN access (initial)
export const GUEST_ALLOWED_ROUTES = [
  "/welcome",
  "/guest-builder",
  "/guest-suite",
  "/macro-counter",
  "/weekly-meal-board",
  "/craving-creator",
  "/fridge-rescue",
  "/my-biometrics",
  "/shopping-list",
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
