/**
 * Production Gates - Hide unstable features from Apple/clients
 * 
 * ARCHITECTURE:
 * - Studios are HIDDEN by default everywhere
 * - Studios are ONLY shown when VITE_FORCE_SHOW_STUDIOS=true is explicitly set
 * - This env var should ONLY be set in the main dev workspace
 * 
 * RESULT:
 * - Main dev workspace (with env var) → All studios visible
 * - All other environments (iOS, production, other dev spaces) → Only Fridge Rescue visible
 * 
 * HOW TO USE:
 * 1. Import: import { isFeatureEnabled, GATED_FEATURES } from '@/lib/productionGates'
 * 2. Check: if (isFeatureEnabled('studioCreators')) { ... }
 * 3. Or conditionally render: {isFeatureEnabled('studioCreators') && <Component />}
 */

/**
 * FORCE OVERRIDE - Set VITE_FORCE_SHOW_STUDIOS=true ONLY in main dev workspace
 * This is the ONLY way to enable gated studios
 */
const FORCE_SHOW_STUDIOS = import.meta.env.VITE_FORCE_SHOW_STUDIOS === 'true';

/**
 * Domain check (for reference, but not used for gating anymore)
 */
const isProductionDomain = 
  typeof window !== 'undefined' && (
    window.location.hostname === 'myperfectmeals.com' ||
    window.location.hostname === 'www.myperfectmeals.com' ||
    window.location.hostname.endsWith('.myperfectmeals.com')
  );

const ADMIN_EMAILS = [
  'admin@myperfectmeals.com',
  // Add your email here to see gated features in production
];

/**
 * Gated Features Configuration
 * 
 * These features are HIDDEN everywhere EXCEPT when VITE_FORCE_SHOW_STUDIOS=true
 * 
 * Set to `false` to HIDE from production (and all non-dev-workspace environments)
 * Set to `true` to SHOW everywhere (use for stable features)
 */
export const GATED_FEATURES = {
  // Studios - HIDDEN everywhere except main dev workspace
  studioCreators: false,      // Craving Studio, Dessert Studio (Fridge Rescue is NOT gated)
  chefsKitchen: false,        // Chef's Kitchen page
  
  // Voice - HIDDEN everywhere except main dev workspace
  handsFreeVoice: false,      // Hands-free voice mode (walkie-talkie)
  
  // These are stable and shown everywhere
  quickCreators: true,        // Quick Create forms (stable)
  talkToChef: true,           // Tap-to-talk voice (stable)
} as const;

export type GatedFeature = keyof typeof GATED_FEATURES;

/**
 * Check if we're in the main dev workspace (force flag is set)
 */
export function isDevMode(): boolean {
  return FORCE_SHOW_STUDIOS;
}

/**
 * Check if we're in production mode (no force flag)
 */
export function isProductionMode(): boolean {
  return !FORCE_SHOW_STUDIOS;
}

/**
 * Check if studios should be shown
 * ONLY returns true when VITE_FORCE_SHOW_STUDIOS=true
 */
export function shouldShowStudios(): boolean {
  return FORCE_SHOW_STUDIOS;
}

/**
 * Check if a specific feature is enabled
 * 
 * STRICT RULE: Features are ONLY enabled when:
 * 1. VITE_FORCE_SHOW_STUDIOS=true (main dev workspace), OR
 * 2. The feature is marked as `true` in GATED_FEATURES (stable features), OR
 * 3. User is an admin (for production debugging)
 */
export function isFeatureEnabled(feature: GatedFeature, userEmail?: string | null): boolean {
  // FORCE OVERRIDE: Main dev workspace shows all features
  if (FORCE_SHOW_STUDIOS) {
    return true;
  }
  
  // Admin override for debugging in any environment
  if (userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return true;
  }
  
  // All other environments: respect the gate setting
  // If GATED_FEATURES[feature] is false, feature is hidden
  // If GATED_FEATURES[feature] is true, feature is shown (stable)
  return GATED_FEATURES[feature];
}

/**
 * Get the message to show when a feature is gated
 */
export function getGatedMessage(feature: GatedFeature): string {
  const messages: Record<GatedFeature, string> = {
    studioCreators: "Chef is warming up — this experience is temporarily paused while we finalize the next upgrade.",
    chefsKitchen: "Chef's Kitchen is being upgraded. Check back soon!",
    handsFreeVoice: "Hands-free mode is coming soon. Use tap-to-talk for now.",
    quickCreators: "",
    talkToChef: "",
  };
  return messages[feature];
}
