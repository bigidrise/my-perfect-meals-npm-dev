/**
 * computeTrialDays
 *
 * Returns the number of days in a user's trial window so the onboarding welcome
 * modal can display the correct duration regardless of whether the trial was
 * granted via standard signup (7 days) or an admin/clinic override (e.g. 30 days).
 *
 * Priority chain (mirrors the modal IIFE in OnboardingV3.tsx):
 *   1. trialStartedAt → trialEndsAt diff  — most accurate for any grant length
 *   2. daysRemaining from server context   — for accounts without a start stamp
 *   3. trialEndsAt − now (ceiling)         — raw end-from-now fallback
 *   4. 7                                   — safe last-resort fallback
 */
export function computeTrialDays(opts: {
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  daysRemaining?: number;
  /** Override "now" for deterministic tests. Defaults to Date.now(). */
  now?: Date;
}): number {
  const { trialStartedAt, trialEndsAt, daysRemaining, now = new Date() } = opts;

  // 1. Exact grant window derived from the start → end timestamps
  if (trialStartedAt && trialEndsAt) {
    const ms = new Date(trialEndsAt).getTime() - new Date(trialStartedAt).getTime();
    const d = Math.round(ms / (1000 * 60 * 60 * 24));
    if (d > 0) return d;
  }

  // 2. Server-provided days-remaining (e.g. from /api/user/profile)
  if (typeof daysRemaining === "number" && daysRemaining > 0) {
    return daysRemaining;
  }

  // 3. Days remaining until the end date, computed from now
  if (trialEndsAt) {
    const ms = new Date(trialEndsAt).getTime() - now.getTime();
    const d = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (d > 0) return d;
  }

  // 4. Safe fallback — should only fire for legacy accounts with no trial stamps
  return 7;
}
