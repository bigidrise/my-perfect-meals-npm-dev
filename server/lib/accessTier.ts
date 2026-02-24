export type AccessTier = "PAID_FULL" | "TRIAL_FULL" | "FREE";

interface UserForAccess {
  planLookupKey?: string | null;
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  isTester?: boolean | null;
}

const PAID_PLAN_KEYS = [
  "mpm_basic_monthly",
  "mpm_upgrade_monthly",
  "mpm_upgrade_beta_monthly",
  "mpm_ultimate_monthly",
  "mpm_family_base_monthly",
  "mpm_family_all_upgrade_monthly",
  "mpm_family_all_ultimate_monthly",
  "mpm_procare_monthly",
  "mpm_basic_plan_999",
  "mpm_premium_plan_1999",
  "mpm_ultimate_plan_2999",
];

// PRE-LAUNCH: Grant full access to all users for testing & growth.
// When ready to enforce subscriptions, remove the early return below.
const PRE_LAUNCH_FULL_ACCESS = true;

export function resolveAccessTier(user: UserForAccess, now: Date = new Date()): AccessTier {
  if (PRE_LAUNCH_FULL_ACCESS) return "PAID_FULL";

  if (user.isTester) return "PAID_FULL";

  if (user.planLookupKey && PAID_PLAN_KEYS.includes(user.planLookupKey)) {
    return "PAID_FULL";
  }

  if (user.trialEndsAt && now < user.trialEndsAt) {
    return "TRIAL_FULL";
  }

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
