# Google Play Reviewer Account

## Purpose
This is the permanent credential account provided to Google Play reviewers so they can log in and test every feature of My Perfect Meals during app review submissions.

## Account Details
| Field | Value |
|---|---|
| **Email** | `google-review@myperfectmeals.ai` |
| **Password** | Set by the owner (never stored here) — see secure credential store |
| **Access Tier** | Ultimate / Clinical (full access to all features) |
| **Plan Key** | `mpm_contributor` |
| **Billing Bypass** | `is_founder = true` — permanently bypasses billing enforcement regardless of `BILLING_ENFORCED` env var |
| **Expiry** | None — `subscription_expires_at` and `trial_ends_at` are NULL |

## Access Level
The account uses `planLookupKey = mpm_contributor` which maps to the `ultimate` tier in `LOOKUP_KEY_TO_TIER` (`shared/planFeatures.ts`).

Combined with `is_founder = true`, this means:
- `resolveAccessTier()` returns `PAID_FULL` unconditionally — Tier 1 Founder path in `server/lib/accessTier.ts`
- The account never hits a paywall, even when `BILLING_ENFORCED=true`
- No Stripe subscription is required or expected

**Entitlements unlocked:** All Ultimate entitlements including `lab_metrics`, `care_team`, `pregnancy`, `performance_nutrition`, `restaurant_guide`, `grocery_coach`, and all lower-tier features.

## Verification
To confirm the account returns Clinical/Ultimate entitlements after login:
```
GET /api/user/profile
→ tier: "ultimate"
→ accessTier: "PAID_FULL"
→ entitlements: [...all ultimate entitlements...]
```

## Maintenance Notes
- **Password rotation:** Only the account owner should update the password via the app's normal reset flow. Do not store the password in this file or in chat.
- **Inactivity cleanup:** No automated cleanup job removes users with `is_founder = true`. This account will not be pruned.
- **Re-submissions:** Credentials stay the same across all future Play Store review cycles — no need to re-create the account.
- **If entitlements ever appear wrong:** Run `SELECT plan_lookup_key, is_founder, subscription_status, subscription_expires_at FROM users WHERE email = 'google-review@myperfectmeals.ai';` to confirm the DB state is intact.

## DB Setup (for reference — already applied)
```sql
UPDATE users SET
  plan_lookup_key        = 'mpm_contributor',
  subscription_status    = 'active',
  subscription_expires_at = NULL,
  trial_ends_at          = NULL,
  trial_started_at       = NULL,
  is_founder             = true
WHERE email = 'google-review@myperfectmeals.ai';
```
