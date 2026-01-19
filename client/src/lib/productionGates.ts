/**
 * Production Gates - Hide unstable features from Apple/clients
 * 
 * ARCHITECTURE:
 * - Studios shown on: Main dev workspace OR Main dev URL (*.replit.dev)
 * - Studios hidden on: Production URL (myperfectmeals.com), iOS app
 * 
 * IMPORTANT: Check order matters!
 * 1. FIRST check if we should ALLOW (dev URL or force flag)
 * 2. THEN check if we should BLOCK (production or iOS)
 */

/**
 * Build-time override (works in dev workspace with Vite dev server)
 */
const FORCE_SHOW_STUDIOS = import.meta.env.VITE_FORCE_SHOW_STUDIOS === 'true';

/**
 * Check if running on a Replit dev URL (runtime check)
 * This catches the published dev URL which uses a production build
 */
function isReplitDevUrl(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  
  // Replit dev URL patterns - these should SHOW studios
  return (
    hostname.endsWith('.replit.dev') ||
    hostname.endsWith('.repl.co') ||
    hostname.includes('.picard.') ||
    hostname === 'localhost'
  );
}

/**
 * Check if running on production domain - should HIDE studios
 */
function isProductionDomain(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  
  // Only exact production domains
  return (
    hostname === 'myperfectmeals.com' ||
    hostname === 'www.myperfectmeals.com'
  );
}

/**
 * Check if running in iOS/Capacitor native app - should HIDE studios
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
 * ORDER MATTERS:
 * 1. FIRST: Check ALLOW conditions (dev URL, force flag) - return true
 * 2. THEN: Check BLOCK conditions (production, iOS) - return false
 * 3. DEFAULT: false (hide if unknown)
 */
export function shouldShowStudios(): boolean {
  // === ALLOW CONDITIONS (check these FIRST) ===
  
  // Force override from env var (dev workspace)
  if (FORCE_SHOW_STUDIOS) {
    return true;
  }
  
  // Replit dev URLs should show studios
  if (isReplitDevUrl()) {
    return true;
  }
  
  // === BLOCK CONDITIONS (check these SECOND) ===
  
  // Production domain hides studios
  if (isProductionDomain()) {
    return false;
  }
  
  // iOS native app hides studios
  if (isNativeApp()) {
    return false;
  }
  
  // === DEFAULT: Hide studios (unknown environment) ===
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
