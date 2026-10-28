import { getTierForLookupKey, PLAN_FEATURES } from "@shared/planFeatures";

interface UserForSubscriptionCheck {
  planLookupKey?: string | null;
  accessTier?: string;
  isTester?: boolean;
  isFounder?: boolean;
  [key: string]: any;
}

export function hasActivePaidSubscription(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  if (user.accessTier === "PAID_FULL") return true;
  if (user.planLookupKey && getTierForLookupKey(user.planLookupKey) !== "free") return true;
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
  if (!hasActivePaidSubscription(user)) return false;
  const tier = getTierForLookupKey(user.planLookupKey);
  if (tier === "free" && user.accessTier === "PAID_FULL") return true;
  return tier === "premium" || tier === "ultimate";
}

export function isClinicalOrAbove(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  if (!hasActivePaidSubscription(user)) return false;
  const tier = getTierForLookupKey(user.planLookupKey);
  if (tier === "free" && user.accessTier === "PAID_FULL") return true;
  return tier === "ultimate";
}

/**
 * canAccessStrictClinical — Clinical plan only.
 * Founders always pass. Internal accounts (PAID_FULL + no planLookupKey) pass.
 */
function canAccessStrictClinical(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  if (!hasActivePaidSubscription(user)) return false;
  const tier = getTierForLookupKey(user.planLookupKey);
  if (tier === "free" && user.accessTier === "PAID_FULL") return true;
  return tier === "ultimate";
}

/** Lab Values — Clinical plan only. */
export function canAccessClinicalLabs(user: UserForSubscriptionCheck | null | undefined): boolean {
  return canAccessStrictClinical(user);
}

/** Therapeutic Nutrition Intelligence — Clinical plan only. */
export function canAccessTherapeuticNutrition(user: UserForSubscriptionCheck | null | undefined): boolean {
  return canAccessStrictClinical(user);
}

/**
 * canAccessMealBuilders — feature-permission check driven by the plan matrix.
 * Answers: "Does this subscription include Meal Builders (smart_menu_builder)?"
 * Source of truth: PLAN_FEATURES entitlements in shared/planFeatures.ts.
 *
 * Free → false. Essential/Pro/Clinical → true.
 * PAID_FULL with no plan key → true (internal/pre-launch account).
 */
export function canAccessMealBuilders(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  if (user.accessTier === "PAID_FULL") {
    const tier = getTierForLookupKey(user.planLookupKey);
    if (tier === "free") return true;
    return PLAN_FEATURES[tier]?.entitlements.includes("smart_menu_builder") ?? false;
  }
  const tier = getTierForLookupKey(user.planLookupKey);
  return PLAN_FEATURES[tier]?.entitlements.includes("smart_menu_builder") ?? false;
}

/**
 * isActualProPlanOrAbove — requires a real paid Pro or Clinical subscription.
 * Pre-launch (BILLING_ENFORCED=false) → server sends PAID_FULL for everyone,
 * so internal/sandbox accounts with no planLookupKey pass through correctly.
 */
export function isActualProPlanOrAbove(user: UserForSubscriptionCheck | null | undefined): boolean {
  return isProOrAbove(user);
}

/**
 * isInTrial — returns true when the user has a trial window that has not yet expired
 * and does NOT have a real paid plan key.
 *
 * We deliberately do NOT call hasActivePaidSubscription() here because trial users
 * also receive accessTier="PAID_FULL" from the server (that is how the trial grants
 * access). Using hasActivePaidSubscription() would therefore always return false for
 * trial users and the banner would never show. Instead we check for a real paid
 * planLookupKey explicitly.
 *
 * trialEndsAt is an ISO string (or Date) from the server.
 */
export function isInTrial(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (!user.trialEndsAt) return false;
  if (new Date(user.trialEndsAt) <= new Date()) return false;
  // Founders and users with a real paid plan are not "in trial"
  if (user.isFounder) return false;
  if (user.planLookupKey && getTierForLookupKey(user.planLookupKey) !== "free") return false;
  return true;
}

export function hasPaidPlan(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  if (user.accessTier === "PAID_FULL") return true;
  if (user.planLookupKey && getTierForLookupKey(user.planLookupKey) !== "free") return true;
  return false;
}
