// client/src/lib/guestSuiteNavigator.ts
// Guest Suite Navigation Control - Centralized Routing for Marketing Funnel
// This ensures guests follow the exact path: Guest Suite → Macro Calculator → Weekly Meal Builder → Shopping → Biometrics → Guest Suite

import {
  isGuestMode,
  getGuestProgress,
  markStepCompleted,
  GuestCompletedStep,
} from "./guestMode";

const GUEST_FIRST_LOOP_KEY = "mpm_guest_first_loop_complete";

// ============================================
// GUEST SUITE NAVIGATION PAGES
// ============================================

export type GuestSuitePage =
  | "guest-suite"
  | "macro-calculator"
  | "weekly-meal-builder"
  | "shopping-list"
  | "biometrics"
  | "fridge-rescue"
  | "craving-creator";

// Map routes to Guest Suite pages
const ROUTE_TO_PAGE: Record<string, GuestSuitePage> = {
  "/guest-builder": "guest-suite",
  "/guest-suite": "guest-suite",
  "/macro-counter": "macro-calculator",
  "/weekly-meal-board": "weekly-meal-builder",
  "/shopping-list": "shopping-list",
  "/my-biometrics": "biometrics",
  "/fridge-rescue": "fridge-rescue",
  "/craving-creator": "craving-creator",
};

// ============================================
// FIRST LOOP COMPLETION STATE
// ============================================

/**
 * Check if guest has completed their first loop (Shopping → Biometrics transition)
 */
export function hasCompletedFirstLoop(): boolean {
  if (!isGuestMode()) return true; // Non-guests are not restricted
  
  try {
    return localStorage.getItem(GUEST_FIRST_LOOP_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Mark first loop as complete (called when transitioning from Shopping → Biometrics)
 */
export function markFirstLoopComplete(): void {
  if (!isGuestMode()) return;
  
  try {
    localStorage.setItem(GUEST_FIRST_LOOP_KEY, "true");
    console.log("🔓 Guest Suite: First loop completed - Fridge Rescue & Craving Creator unlocked");
    
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent("guestProgressUpdate", {
      detail: { action: "firstLoopComplete" }
    }));
  } catch (e) {
    console.error("Failed to mark first loop complete:", e);
  }
}

/**
 * Reset first loop state (for testing/debugging)
 */
export function resetFirstLoop(): void {
  try {
    localStorage.removeItem(GUEST_FIRST_LOOP_KEY);
    console.log("🔧 Guest Suite: First loop reset");
  } catch {
    // Ignore errors
  }
}

// ============================================
// NAVIGATION OVERRIDES
// ============================================

/**
 * Get the current Guest Suite page from a route path
 */
export function getGuestSuitePage(path: string): GuestSuitePage | null {
  return ROUTE_TO_PAGE[path] || null;
}

/**
 * Check if current route is within Guest Suite
 */
export function isGuestSuiteRoute(path: string): boolean {
  return ROUTE_TO_PAGE[path] !== undefined;
}

/**
 * Get the forced navigation destination for a Guest Suite page
 * This enforces the linear flow: Macro → Meal Builder → Shopping → Biometrics → Guest Suite
 * 
 * @param currentPage - The current Guest Suite page
 * @param intendedDestination - Where the user is trying to navigate (optional)
 * @returns The route they should be sent to, or null if navigation is allowed
 */
export function getGuestNavigationOverride(
  currentPage: GuestSuitePage,
  intendedDestination?: string
): string | null {
  if (!isGuestMode()) return null; // Non-guests navigate freely
  
  switch (currentPage) {
    case "shopping-list":
      // Shopping: ALL exits go to Biometrics (no escape)
      // Only exception: if they're explicitly going to biometrics
      if (intendedDestination === "/my-biometrics") {
        return null; // Allow it
      }
      return "/my-biometrics";
      
    case "biometrics":
      // Biometrics: ALL exits go to Guest Suite (end of loop)
      // Only exception: if they're explicitly going to guest suite
      if (intendedDestination === "/guest-builder" || intendedDestination === "/guest-suite") {
        return null; // Allow it
      }
      return "/guest-builder";
      
    default:
      // Other pages: no override, allow normal navigation
      return null;
  }
}

/**
 * Check if a specific page should have navigation locked
 */
export function isNavigationLocked(currentPage: GuestSuitePage): boolean {
  if (!isGuestMode()) return false;
  
  return currentPage === "shopping-list" || currentPage === "biometrics";
}

/**
 * Get the navigation override message to display
 */
export function getNavigationOverrideMessage(currentPage: GuestSuitePage): string {
  switch (currentPage) {
    case "shopping-list":
      return "Next step: View your nutrition data in Biometrics";
    case "biometrics":
      return "Return to Guest Suite to continue exploring";
    default:
      return "";
  }
}

// ============================================
// STEP TRACKING HELPERS
// ============================================

/**
 * Record progress when entering a Guest Suite page
 */
export function recordGuestPageEntry(page: GuestSuitePage): void {
  if (!isGuestMode()) return;
  
  const stepMap: Partial<Record<GuestSuitePage, GuestCompletedStep>> = {
    "shopping-list": "shopping_viewed",
    "biometrics": "biometrics_viewed",
  };
  
  const step = stepMap[page];
  if (step) {
    markStepCompleted(step);
  }
}

/**
 * Record transition from Shopping to Biometrics
 * NOTE: This does NOT mark first loop complete - only biometrics does that
 * after verifying the session marker to prevent premature unlocks
 */
export function recordShoppingToBiometricsTransition(): void {
  if (!isGuestMode()) return;
  
  markStepCompleted("shopping_viewed");
}

// ============================================
// BUTTON ACTION HELPERS
// ============================================

/**
 * Handle "Save to Biometrics" button - saves data WITHOUT navigation
 * Used in Macro Calculator and Weekly Meal Builder
 * 
 * @param saveFn - The actual save function to execute
 * @param onSuccess - Callback after successful save (for toast, etc.)
 */
export async function handleGuestSaveToBiometrics(
  saveFn: () => Promise<void> | void,
  onSuccess?: () => void
): Promise<void> {
  try {
    await saveFn();
    onSuccess?.();
    console.log("📊 Guest: Data saved to biometrics (no navigation)");
  } catch (error) {
    console.error("Failed to save to biometrics:", error);
    throw error;
  }
}

/**
 * Get the correct destination when "Send to Shopping" is clicked
 * In Guest Mode, this goes to Shopping List
 */
export function getShoppingDestination(): string {
  return "/shopping-list";
}

/**
 * Get the header back button destination based on current page
 */
export function getGuestBackDestination(currentPage: GuestSuitePage): string {
  if (!isGuestMode()) return "/"; // Non-guests use normal back
  
  switch (currentPage) {
    case "macro-calculator":
      return "/guest-builder";
    case "weekly-meal-builder":
      return "/guest-builder";
    case "shopping-list":
      return "/my-biometrics"; // Override: force to biometrics
    case "biometrics":
      return "/guest-builder"; // Override: force to guest suite
    case "fridge-rescue":
      return "/guest-builder";
    case "craving-creator":
      return "/guest-builder";
    default:
      return "/guest-builder";
  }
}

/**
 * Get the CTA button text for the header/footer based on current page
 */
export function getGuestCTAText(currentPage: GuestSuitePage): string {
  switch (currentPage) {
    case "shopping-list":
      return "Continue to Biometrics";
    case "biometrics":
      return "Back to Guest Suite";
    default:
      return "Back to Guest Suite";
  }
}

/**
 * Get the CTA destination based on current page
 */
export function getGuestCTADestination(currentPage: GuestSuitePage): string {
  switch (currentPage) {
    case "shopping-list":
      return "/my-biometrics";
    case "biometrics":
      return "/guest-builder";
    default:
      return "/guest-builder";
  }
}
