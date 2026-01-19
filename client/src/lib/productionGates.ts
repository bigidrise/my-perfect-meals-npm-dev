/**
 * Production Gates - Hide unstable features from Apple/clients
 * 
 * ARCHITECTURE:
 * - Studios shown on: Main dev workspace OR Main dev URL (*.picard.replit.dev)
 * - Studios hidden on: Production URL (myperfectmeals.com), iOS app, other workspaces
 * 
 * DETECTION METHODS:
 * 1. VITE_FORCE_SHOW_STUDIOS=true (build-time, for dev workspace)
 * 2. Runtime hostname check for main dev URL pattern
 * 3. iOS/Capacitor detection to ensure gating on native app
 */

/**
 * Build-time override (works in dev workspace with Vite dev server)
 */
const FORCE_SHOW_STUDIOS = import.meta.env.VITE_FORCE_SHOW_STUDIOS === 'true';

/**
 * Check if running on the main dev URL (runtime check)
 * This catches the published dev URL which uses a production build
 */
function isMainDevUrl(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  
  // Main dev workspace published URL patterns
  // Matches: *.picard.replit.dev, *.replit.dev, *.repl.co
  const devUrlPatterns = [
    /\.picard\.replit\.dev$/,
    /\.replit\.dev$/,
    /\.repl\.co$/,
  ];
  
  return devUrlPatterns.some(pattern => pattern.test(hostname));
}

/**
 * Check if running on production domain
 */
function isProductionDomain(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  return (
    hostname === 'myperfectmeals.com' ||
    hostname === 'www.myperfectmeals.com' ||
    hostname.endsWith('.myperfectmeals.com')
  );
}

/**
 * Check if running in iOS/Capacitor native app
 */
function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for Capacitor
  const hasCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
  
  // Check user agent for iOS webview
  const userAgent = navigator.userAgent || '';
  const isIOSWebView = /iPhone|iPad|iPod/.test(userAgent) && !/Safari/.test(userAgent);
  
  return hasCapacitor || isIOSWebView;
}

const ADMIN_EMAILS = [
  'admin@myperfectmeals.com',
];

/**
 * Gated Features Configuration
 * 
 * Set to `false` to hide from production (gated)
 * Set to `true` to show everywhere (stable)
 */
export const GATED_FEATURES = {
  // Studios - Gated (hidden in production/iOS)
  studioCreators: false,      // Craving Studio, Dessert Studio (Fridge Rescue is NOT gated)
  chefsKitchen: false,        // Chef's Kitchen page
  
  // Voice - Gated
  handsFreeVoice: false,      // Hands-free voice mode
  
  // Stable features - Shown everywhere
  quickCreators: true,        // Quick Create forms
  talkToChef: true,           // Tap-to-talk voice
} as const;

export type GatedFeature = keyof typeof GATED_FEATURES;

/**
 * Check if studios should be shown
 * 
 * SHOW studios when:
 * 1. VITE_FORCE_SHOW_STUDIOS=true (dev workspace), OR
 * 2. Running on *.replit.dev URL (main dev published URL)
 * 
 * HIDE studios when:
 * 1. Running on production domain (myperfectmeals.com)
 * 2. Running in iOS/Capacitor native app
 */
export function shouldShowStudios(): boolean {
  // Production domain always hides studios
  if (isProductionDomain()) {
    return false;
  }
  
  // iOS native app always hides studios
  if (isNativeApp()) {
    return false;
  }
  
  // Dev workspace (env var set) shows studios
  if (FORCE_SHOW_STUDIOS) {
    return true;
  }
  
  // Main dev URL shows studios
  if (isMainDevUrl()) {
    return true;
  }
  
  // Default: hide studios
  return false;
}

/**
 * Check if we're in dev mode (workspace or dev URL)
 */
export function isDevMode(): boolean {
  return shouldShowStudios();
}

/**
 * Check if we're in production mode
 */
export function isProductionMode(): boolean {
  return !shouldShowStudios();
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: GatedFeature, userEmail?: string | null): boolean {
  // If studios should show (dev workspace or dev URL), enable all features
  if (shouldShowStudios()) {
    return true;
  }
  
  // Admin override for debugging
  if (userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return true;
  }
  
  // Production/iOS: respect the gate setting
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
