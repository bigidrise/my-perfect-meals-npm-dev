/**
 * Production Gates - Hide unstable features from Apple/clients
 * 
 * ARCHITECTURE:
 * - Dev URL (Replit dev space) → Studios ALWAYS visible (use VITE_FORCE_SHOW_STUDIOS=true)
 * - Production URL (myperfectmeals.com) → Studios obey gate settings
 * - iOS App → Studios obey gate settings
 * 
 * IMPORTANT: import.meta.env.MODE is set at BUILD TIME, not runtime.
 * When you publish your dev space with `npm run build`, MODE === "production"
 * even though you're on a dev URL. Use VITE_FORCE_SHOW_STUDIOS to override.
 * 
 * HOW TO USE:
 * 1. Import: import { isFeatureEnabled, GATED_FEATURES } from '@/lib/productionGates'
 * 2. Check: if (isFeatureEnabled('studioCreators')) { ... }
 * 3. Or conditionally render: {isFeatureEnabled('studioCreators') && <Component />}
 */

/**
 * FORCE OVERRIDE - Set VITE_FORCE_SHOW_STUDIOS=true in dev space secrets
 * This bypasses ALL gates regardless of build mode or hostname
 */
const FORCE_SHOW_STUDIOS = import.meta.env.VITE_FORCE_SHOW_STUDIOS === 'true';

/**
 * Domain-based detection (most reliable for runtime)
 * Production is ONLY myperfectmeals.com - everything else is dev
 */
const isProductionDomain = 
  typeof window !== 'undefined' && (
    window.location.hostname === 'myperfectmeals.com' ||
    window.location.hostname === 'www.myperfectmeals.com' ||
    window.location.hostname.endsWith('.myperfectmeals.com')
  );

/**
 * Final production check:
 * - If FORCE_SHOW_STUDIOS is set, we're in dev mode (override)
 * - Otherwise, check if we're on the production domain
 */
const isProduction = !FORCE_SHOW_STUDIOS && isProductionDomain;
const isDevelopment = !isProduction;

const ADMIN_EMAILS = [
  'admin@myperfectmeals.com',
  // Add your email here to see gated features in production
];

/**
 * Gated Features Configuration
 * 
 * These settings ONLY apply in production.
 * In dev (including dev published URLs with VITE_FORCE_SHOW_STUDIOS=true), 
 * ALL features are always visible regardless of these settings.
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
 * Check if we're in dev mode (always shows all features)
 */
export function isDevMode(): boolean {
  return isDevelopment;
}

/**
 * Check if we're in production mode
 */
export function isProductionMode(): boolean {
  return isProduction;
}

/**
 * Check if studios should be shown (centralized gate)
 * Use this for any studio-related visibility check
 */
export function shouldShowStudios(): boolean {
  // Force override set in dev space
  if (FORCE_SHOW_STUDIOS) {
    return true;
  }
  
  // Not on production domain = dev = show studios
  if (!isProductionDomain) {
    return true;
  }
  
  // On production domain = hide studios (gated)
  return false;
}

/**
 * Check if a specific feature is enabled
 * 
 * KEY RULE: Dev ALWAYS bypasses gates. Production respects gate settings.
 */
export function isFeatureEnabled(feature: GatedFeature, userEmail?: string | null): boolean {
  // FORCE OVERRIDE: Always show all features when override is set
  if (FORCE_SHOW_STUDIOS) {
    return true;
  }
  
  // DEV: Not on production domain = show all features
  if (!isProductionDomain) {
    return true;
  }
  
  // PRODUCTION: Admin override for debugging
  if (userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return true;
  }
  
  // PRODUCTION: Respect the gate setting
  return GATED_FEATURES[feature];
}

/**
 * Get the message to show when a feature is gated (production only)
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
