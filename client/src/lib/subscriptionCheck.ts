const PAID_PLAN_KEYS = [
  "mpm_basic",
  "mpm_premium",
  "mpm_ultimate",
  "mpm_family_base",
  "mpm_family_premium",
  "mpm_family_ultimate",
  "mpm_trainer_5",
  "mpm_trainer_10",
  "mpm_trainer_25",
  "mpm_trainer_50",
  "mpm_physician_50",
  "mpm_physician_150",
  "mpm_guidance",
  "mpm_basic_monthly",
  "mpm_upgrade_monthly",
  "mpm_upgrade_beta_monthly",
  "mpm_ultimate_monthly",
  "mpm_premium_monthly",
  "mpm_premium_beta_monthly",
  "mpm_family_base_monthly",
  "mpm_family_all_upgrade_monthly",
  "mpm_family_all_premium_monthly",
  "mpm_family_all_ultimate_monthly",
  "mpm_procare_monthly",
  "mpm_basic_plan_999",
  "mpm_premium_plan_1999",
  "mpm_ultimate_plan_2999",
];

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
  // Explicit paid plan key (Stripe webhook confirmed)
  if (user.planLookupKey && PAID_PLAN_KEYS.includes(user.planLookupKey)) return true;
  // Active 7-day trial window
  if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) return true;
  return false;
}

export function isFreeTier(user: UserForSubscriptionCheck | null | undefined): boolean {
  return !hasActivePaidSubscription(user);
}

// Returns true only for users on an actual paid plan (not trial, not free, not founder).
// Use this to suppress upsell UI for confirmed paying customers.
export function hasPaidPlan(user: UserForSubscriptionCheck | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  if (user.accessTier === "PAID_FULL") return true;
  if (user.planLookupKey && PAID_PLAN_KEYS.includes(user.planLookupKey)) return true;
  return false;
}
