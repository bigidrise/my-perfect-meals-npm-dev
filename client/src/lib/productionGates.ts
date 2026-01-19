/**
 * Production Gates - Hide unstable features from Apple/clients
 * 
 * These gates control visibility of features that are not ready for production.
 * Features gated here are:
 * - Hidden in production (Apple TestFlight, live app)
 * - Visible in development for fixing/testing
 * 
 * HOW TO USE:
 * 1. Import: import { isFeatureEnabled, GATED_FEATURES } from '@/lib/productionGates'
 * 2. Check: if (isFeatureEnabled('studioCreators')) { ... }
 * 3. Or conditionally render: {isFeatureEnabled('studioCreators') && <Component />}
 */

// Production is ONLY the published domain - everything else is dev
const isProduction = 
  window.location.hostname === 'myperfectmeals.com' ||
  window.location.hostname === 'www.myperfectmeals.com' ||
  window.location.hostname.endsWith('.myperfectmeals.com');

const isDevelopment = !isProduction;

const ADMIN_EMAILS = [
  'admin@myperfectmeals.com',
  // Add your email here to see gated features in production
];

/**
 * Gated Features Configuration
 * 
 * Set to `false` to HIDE from production
 * Set to `true` to SHOW in production
 */
export const GATED_FEATURES = {
  // Studios - currently having meal generation issues on published URLs
  studioCreators: false,      // Craving Studio, Dessert Studio, Fridge Rescue Studio
  chefsKitchen: false,        // Chef's Kitchen page
  
  // Voice - hands-free mode has timing/overlap issues
  handsFreeVoice: false,      // Hands-free voice mode (walkie-talkie)
  
  // Keep these enabled
  quickCreators: true,        // Quick Create forms (stable)
  talkToChef: true,           // Tap-to-talk voice (stable)
} as const;

export type GatedFeature = keyof typeof GATED_FEATURES;

/**
 * Check if the current user can see gated features
 */
export function isDevMode(): boolean {
  return isDevelopment;
}

/**
 * Check if a specific feature is enabled
 * In dev: always shows gated features
 * In prod: respects GATED_FEATURES config
 */
export function isFeatureEnabled(feature: GatedFeature, userEmail?: string | null): boolean {
  // Always show in development
  if (isDevelopment) {
    return true;
  }
  
  // Admin override for production debugging
  if (userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return true;
  }
  
  // In production, respect the gate
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
