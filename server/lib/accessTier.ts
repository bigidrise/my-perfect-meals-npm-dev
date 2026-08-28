import { PAID_PLAN_KEYS } from "../../shared/planFeatures";

export type AccessTier = "PAID_FULL" | "FREE";

interface UserForAccess {
  planLookupKey?: string | null;
  isTester?: boolean | null;
  isFounder?: boolean | null;
  isSandbox?: boolean | null;
  trialEndsAt?: Date | string | null;
  hasPilotProCareAccess?: boolean;
}

// PAID_PLAN_KEYS is now the single source of truth: it lives in shared/planFeatures.ts
// and is derived from LOOKUP_KEY_TO_TIER. Adding a key to LOOKUP_KEY_TO_TIER with a
// non-free tier automatically grants server-side PAID_FULL access — no separate list
// to maintain here.

// BILLING_ENFORCED=true in env means real paywalls are live.
// While false (or unset), everyone gets PAID_FULL (pre-launch mode).
// Flip this env var to go live — no code deploy required.
const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";

export function resolveAccessTier(user: UserForAccess, now: Date = new Date()): AccessTier {
  // Pre-launch bypass: remove by setting BILLING_ENFORCED=true in env.
  // While billing is NOT enforced, sandbox and everyone else gets PAID_FULL so
  // the UI can be tested without Stripe. Once billing IS enforced, sandbox
  // accounts use their real plan/trial just like any other user — this lets you
  // test each tier by assigning the appropriate plan_lookup_key to a test account.
  if (!BILLING_ENFORCED) return "PAID_FULL";

  // Tier 1: Founders — permanent full access (core family, business partners, contributors)
  if (user.isFounder) return "PAID_FULL";
  if (user.hasPilotProCareAccess) return "PAID_FULL";

  // Tier 2: Active paid subscription
  if (user.planLookupKey && PAID_PLAN_KEYS.has(user.planLookupKey)) {
    return "PAID_FULL";
  }

  // Tier 2.5: Active trial — grants PAID_FULL until trialEndsAt
  if (user.trialEndsAt) {
    const trialEnd = user.trialEndsAt instanceof Date
      ? user.trialEndsAt
      : new Date(user.trialEndsAt);
    if (now < trialEnd) {
      return "PAID_FULL";
    }
  }

  // Tier 3: Free tier
  return "FREE";
}
