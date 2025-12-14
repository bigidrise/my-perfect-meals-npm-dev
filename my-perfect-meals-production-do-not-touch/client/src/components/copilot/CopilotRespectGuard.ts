/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                     COPILOT RESPECT GUARD - PROTECTED INVARIANT               ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                               ║
 * ║  THIS FILE ENFORCES USER MODE PREFERENCES FOR COPILOT AUTO-BEHAVIORS         ║
 * ║                                                                               ║
 * ║  INVARIANT: Copilot MUST NEVER auto-open or auto-activate when:              ║
 * ║    1. User chose "Do-It-Yourself" mode (coachMode === "self")                ║
 * ║    2. User disabled the Guide toggle (isGuidedModeEnabled === false)         ║
 * ║                                                                               ║
 * ║  ALL auto-trigger code paths MUST call shouldAllowAutoOpen() before          ║
 * ║  opening Copilot. This includes:                                             ║
 * ║    - Page explanations (useCopilotPageExplanation)                           ║
 * ║    - Walkthrough launchers                                                   ║
 * ║    - Intro flows                                                             ║
 * ║    - Any future auto-trigger feature                                         ║
 * ║                                                                               ║
 * ║  ⚠️  DO NOT BYPASS THIS GUARD                                                ║
 * ║  ⚠️  DO NOT ADD EXCEPTIONS WITHOUT EXPLICIT USER APPROVAL                    ║
 * ║  ⚠️  ANY VIOLATION WILL CAUSE REGRESSION BUGS                                ║
 * ║                                                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

const COACH_MODE_KEY = "coachMode";
const GUIDED_MODE_KEY = "copilot_guided_mode";

/**
 * Check if user chose "Do-It-Yourself" mode at welcome gate
 * Returns true if user wants DIY (no auto-open), false if guided mode
 */
export function isDoItYourselfMode(): boolean {
  try {
    const coachMode = localStorage.getItem(COACH_MODE_KEY);
    return coachMode === "self";
  } catch {
    return false; // Default to allowing auto-open if storage fails
  }
}

/**
 * Check if user has the Guide toggle enabled
 * Returns true if guided mode is enabled, false if disabled
 */
export function isGuidedModeEnabled(): boolean {
  try {
    const saved = localStorage.getItem(GUIDED_MODE_KEY);
    // Default to true if not set (first-time users get guided experience)
    return saved !== "false";
  } catch {
    return true; // Default to enabled if storage fails
  }
}

/**
 * ╔═════════════════════════════════════════════════════════════════════════════╗
 * ║  MAIN GUARD FUNCTION - USE THIS BEFORE ANY AUTO-OPEN/AUTO-TRIGGER ACTION   ║
 * ╚═════════════════════════════════════════════════════════════════════════════╝
 * 
 * Returns TRUE if Copilot is allowed to auto-open
 * Returns FALSE if user preferences should block auto-open
 * 
 * Usage:
 *   if (!shouldAllowAutoOpen()) return; // Early exit, respect user choice
 *   open(); // Only reaches here if user allows auto-open
 */
export function shouldAllowAutoOpen(): boolean {
  // Check 1: Did user choose "Do-It-Yourself" at welcome gate?
  if (isDoItYourselfMode()) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "🛑 [CopilotRespectGuard] Auto-open BLOCKED: User chose Do-It-Yourself mode"
      );
    }
    return false;
  }

  // Check 2: Did user disable the Guide toggle?
  if (!isGuidedModeEnabled()) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "🛑 [CopilotRespectGuard] Auto-open BLOCKED: User disabled guided mode toggle"
      );
    }
    return false;
  }

  // User allows auto-open
  return true;
}

/**
 * React hook version for components that need reactive updates
 * Use this when you need to respond to toggle changes in real-time
 */
export function useCopilotRespectGuard(): {
  shouldAllowAutoOpen: boolean;
  isDoItYourselfMode: boolean;
  isGuidedModeEnabled: boolean;
} {
  // Read current state (for initial render)
  const diyMode = isDoItYourselfMode();
  const guidedEnabled = isGuidedModeEnabled();

  return {
    shouldAllowAutoOpen: !diyMode && guidedEnabled,
    isDoItYourselfMode: diyMode,
    isGuidedModeEnabled: guidedEnabled,
  };
}
