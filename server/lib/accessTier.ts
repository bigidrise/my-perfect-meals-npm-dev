export type AccessTier = "PAID_FULL" | "TRIAL_FULL" | "FREE";

interface UserForAccess {
  planLookupKey?: string | null;
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  isTester?: boolean | null;
  isFounder?: boolean | null;
}

const PAID_PLAN_KEYS = [
  "mpm_basic_monthly",
  "mpm_upgrade_monthly",
  "mpm_upgrade_beta_monthly",
  "mpm_ultimate_monthly",
  "mpm_family_base_monthly",
  "mpm_family_premium",
  "mpm_family_all_upgrade_monthly",
  "mpm_family_all_premium_monthly",
  "mpm_family_all_ultimate_monthly",
  "mpm_procare_monthly",
  "mpm_basic_plan_999",
  "mpm_premium_plan_1999",
  "mpm_ultimate_plan_2999",
];

// BILLING_ENFORCED=true in env means real paywalls are live.
// While false (or unset), everyone gets PAID_FULL (pre-launch mode).
// Flip this env var to go live — no code deploy required.
const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";

export function resolveAccessTier(user: UserForAccess, now: Date = new Date()): AccessTier {
  // Pre-launch bypass: remove by setting BILLING_ENFORCED=true in env
  if (!BILLING_ENFORCED) return "PAID_FULL";

  // Tier 1: Founders — permanent free access (core family, business partners, contributors)
  if (user.isFounder) return "PAID_FULL";

  // Tier 2: Active paid subscription
  if (user.planLookupKey && PAID_PLAN_KEYS.includes(user.planLookupKey)) {
    return "PAID_FULL";
  }

  // Tier 3: Active trial window
  if (user.trialEndsAt && now < user.trialEndsAt) {
    return "TRIAL_FULL";
  }

  // Tier 4: Free tier
  return "FREE";
}

export function getTrialDaysRemaining(user: UserForAccess, now: Date = new Date()): number | null {
  if (!user.trialEndsAt) return null;
  const diff = user.trialEndsAt.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isTrialExpired(user: UserForAccess, now: Date = new Date()): boolean {
  if (!user.trialEndsAt) return false;
  return now >= user.trialEndsAt;
}
