/**
 * Production Gates - Hide unstable features from Apple/clients
 * 
 * SIMPLE LOGIC:
 * 1. If on ALLOWLISTED dev hostname → SHOW studios
 * 2. If on production domain or iOS → HIDE studios
 * 3. Default → HIDE studios
 */

const FORCE_SHOW_STUDIOS = import.meta.env.VITE_FORCE_SHOW_STUDIOS === 'true';

/**
 * ALLOWLIST: Exact hostnames that should show ALL studios
 * Add your main dev URL here
 */
const ALLOWED_DEV_HOSTNAMES = [
  '6ec77f1f-9dac-4f2b-bee5-d2f285813ff1-00-1ejhf7hrpbxz8.picard.replit.dev',
  'localhost',
];

/**
 * BLOCKLIST: Exact hostnames that should HIDE studios
 */
const PRODUCTION_HOSTNAMES = [
  'myperfectmeals.com',
  'www.myperfectmeals.com',
];

function isAllowedDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return ALLOWED_DEV_HOSTNAMES.includes(hostname);
}

function isProductionHost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return PRODUCTION_HOSTNAMES.includes(hostname);
}

function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const hasCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
  const userAgent = navigator.userAgent || '';
  const isIOSWebView = /iPhone|iPad|iPod/.test(userAgent) && !/Safari/.test(userAgent);
  return hasCapacitor || isIOSWebView;
}

const ADMIN_EMAILS = ['admin@myperfectmeals.com'];

export const GATED_FEATURES = {
  studioCreators: false,
  chefsKitchen: false,
  handsFreeVoice: false,
  quickCreators: true,
  talkToChef: true,
} as const;

export type GatedFeature = keyof typeof GATED_FEATURES;

/**
 * Should studios be shown?
 * 
 * Priority order:
 * 1. Allowed dev host → YES
 * 2. Force flag → YES
 * 3. Production host → NO
 * 4. Native app → NO
 * 5. Default → NO
 */
export function shouldShowStudios(): boolean {
  // FIRST: Check allowlist
  if (isAllowedDevHost()) {
    return true;
  }
  
  // Force override
  if (FORCE_SHOW_STUDIOS) {
    return true;
  }
  
  // Block production
  if (isProductionHost()) {
    return false;
  }
  
  // Block iOS
  if (isNativeApp()) {
    return false;
  }
  
  // Default: hide
  return false;
}

export function isDevMode(): boolean {
  return shouldShowStudios();
}

export function isProductionMode(): boolean {
  return !shouldShowStudios();
}

export function isFeatureEnabled(feature: GatedFeature, userEmail?: string | null): boolean {
  if (shouldShowStudios()) {
    return true;
  }
  
  if (userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return true;
  }
  
  return GATED_FEATURES[feature];
}

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
