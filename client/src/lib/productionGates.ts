/**
 * Production Gates - Hide unstable features from Apple/clients
 * 
 * ARCHITECTURE:
 * - Dev URL (Replit dev space) → Studios ALWAYS visible (bypass gates)
 * - Production URL (myperfectmeals.com) → Studios obey gate settings
 * - iOS App → Studios obey gate settings
 * 
 * This ensures you can ALWAYS test in dev, while production stays protected.
 * 
 * HOW TO USE:
 * 1. Import: import { isFeatureEnabled, GATED_FEATURES } from '@/lib/productionGates'
 * 2. Check: if (isFeatureEnabled('studioCreators')) { ... }
 * 3. Or conditionally render: {isFeatureEnabled('studioCreators') && <Component />}
 */

/**
 * Environment Detection
 * 
 * Production is ONLY:
 * - import.meta.env.MODE === 'production' (Vite build mode)
 * - OR the published domain (myperfectmeals.com)
 * 
 * Everything else is dev (including Replit dev URLs, localhost, etc.)
 */
const isProductionBuild = import.meta.env.MODE === 'production';

const isProductionDomain = 
  typeof window !== 'undefined' && (
    window.location.hostname === 'myperfectmeals.com' ||
    window.location.hostname === 'www.myperfectmeals.com' ||
    window.location.hostname.endsWith('.myperfectmeals.com')
  );

// Production = production build OR production domain
// Dev = everything else (Replit dev URLs, localhost, staging, etc.)
const isProduction = isProductionBuild || isProductionDomain;
const isDevelopment = !isProduction;

const ADMIN_EMAILS = [
  'admin@myperfectmeals.com',
  // Add your email here to see gated features in production
];

/**
 * Gated Features Configuration
 * 
 * These settings ONLY apply in production.
 * In dev, ALL features are always visible regardless of these settings.
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
 * Check if a specific feature is enabled
 * 
 * KEY RULE: Dev ALWAYS bypasses gates. Production respects gate settings.
 */
export function isFeatureEnabled(feature: GatedFeature, userEmail?: string | null): boolean {
  // DEV: Always show all features - this is your testing playground
  if (isDevelopment) {
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
