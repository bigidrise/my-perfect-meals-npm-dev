import { getTierForLookupKey } from "@shared/planFeatures";

interface UserForSubscriptionCheck {
  planLookupKey?: string | null;
  accessTier?: string;
  isTester?: boolean;
  isFounder?: boolean;
  trialEndsAt?: string | null;
  [key: string]: any;
}

export function hasActivePaidSubscription(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  // Founders: permanent free access (tiny group — core family, partners, contributors)
  if (user.isFounder) return true;
  // accessTier is the server's authoritative resolution — trust it first
  if (user.accessTier === "PAID_FULL" || user.accessTier === "TRIAL_FULL") return true;
  // Derive from planLookupKey via the single source of truth in planFeatures.ts
  if (user.planLookupKey && getTierForLookupKey(user.planLookupKey) !== "free") return true;
  // Active 7-day trial window
  if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) return true;
  return false;
}

export function isFreeTier(user: UserForSubscriptionCheck | null | undefined): boolean {
  return !hasActivePaidSubscription(user);
}

export function isEssentialOrAbove(user: UserForSubscriptionCheck | null | undefined): boolean {
  return hasActivePaidSubscription(user);
}

export function isProOrAbove(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) return true;
  if (!hasActivePaidSubscription(user)) return false;
  const tier = getTierForLookupKey(user.planLookupKey);
  if (tier === "free" && (user.accessTier === "PAID_FULL" || user.accessTier === "TRIAL_FULL")) return true;
  return tier === "premium" || tier === "ultimate";
}

export function isClinicalOrAbove(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) return true;
  if (!hasActivePaidSubscription(user)) return false;
  const tier = getTierForLookupKey(user.planLookupKey);
  if (tier === "free" && (user.accessTier === "PAID_FULL" || user.accessTier === "TRIAL_FULL")) return true;
  return tier === "ultimate";
}

/**
 * canAccessStrictClinical — shared logic for Clinical features that explicitly
 * exclude trial users: Lab Values, Therapeutic Nutrition Intelligence, etc.
 * Founders always pass. Pre-launch (BILLING_ENFORCED=false) → server sends
 * PAID_FULL for everyone, so the PAID_FULL + free-tier-key fallback returns true.
 */
function canAccessStrictClinical(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  // Trial users are explicitly excluded from strict Clinical features
  if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date() && user.accessTier === "TRIAL_FULL") return false;
  if (!hasActivePaidSubscription(user)) return false;
  const tier = getTierForLookupKey(user.planLookupKey);
  // Internal/sandbox: PAID_FULL with no planLookupKey → grant access
  if (tier === "free" && user.accessTier === "PAID_FULL") return true;
  return tier === "ultimate";
}

/** Lab Values — Clinical plan only, trial excluded. */
export function canAccessClinicalLabs(user: UserForSubscriptionCheck | null | undefined): boolean {
  return canAccessStrictClinical(user);
}

/** Therapeutic Nutrition Intelligence — Clinical plan only, trial excluded. */
export function canAccessTherapeuticNutrition(user: UserForSubscriptionCheck | null | undefined): boolean {
  return canAccessStrictClinical(user);
}

// Returns true only for users on an actual paid plan (not trial, not free, not founder).
// Use this to suppress upsell UI for confirmed paying customers.
export function hasPaidPlan(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  if (user.accessTier === "PAID_FULL") return true;
  if (user.planLookupKey && getTierForLookupKey(user.planLookupKey) !== "free") return true;
  return false;
}
