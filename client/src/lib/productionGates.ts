/**
 * Production Gates - Hide unstable features from end users only
 * 
 * RULE: Gate based on DELIVERY CHANNEL, not build mode or workspace.
 * 
 * - All workspaces (dev, production) → SHOW everything (for testing/verification)
 * - Production public URL (myperfectmeals.com) → HIDE unstable features
 * - iOS app (Capacitor) → HIDE unstable features
 * 
 * This ensures you can always verify deployments in the production workspace
 * before end users see them.
 */

/**
 * Is this being viewed on the public production surface?
 * Returns true ONLY for end-user facing channels that should be curated.
 */
export function isPublicProduction(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  
  // iOS / Android (Capacitor native app)
  if ((window as any).Capacitor?.isNativePlatform?.()) return true;
  
  // Production domain ONLY
  if (hostname === 'myperfectmeals.com' || hostname === 'www.myperfectmeals.com') return true;
  
  return false;
}

const ADMIN_EMAILS = ['admin@myperfectmeals.com'];

/**
 * Feature flags for public production only.
 * These ONLY apply when isPublicProduction() returns true.
 * In all workspaces, all features are always visible.
 */
export const GATED_FEATURES = {
  studioCreators: false,      // Stage 1 - Studios (Craving Studio, Dessert Studio) - HIDDEN on prod/iOS
  chefsKitchen: true,         // Stage 2 - Chef's Kitchen / Prepare with Chef - AVAILABLE everywhere
  handsFreeVoice: false,
  quickCreators: true,
  talkToChef: true,
} as const;

export type GatedFeature = keyof typeof GATED_FEATURES;

/**
 * Should studios be shown?
 * Returns true for all workspaces, false only for public production channels.
 */
export function shouldShowStudios(): boolean {
  // Show everything unless on public production channel
  return !isPublicProduction();
}

export function isDevMode(): boolean {
  return !isPublicProduction();
}

export function isProductionMode(): boolean {
  return isPublicProduction();
}

/**
 * Is a specific feature enabled?
 * - In workspaces: ALL features enabled (for testing)
 * - On public production: Check GATED_FEATURES flag
 * - Admins: Always enabled
 */
export function isFeatureEnabled(feature: GatedFeature, userEmail?: string | null): boolean {
  // All workspaces see everything
  if (!isPublicProduction()) {
    return true;
  }
  
  // Admins always have access
  if (userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return true;
  }
  
  // On public production, check the feature flag
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
