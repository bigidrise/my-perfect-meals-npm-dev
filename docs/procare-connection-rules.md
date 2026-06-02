# ProCare Connection Rules

**Status:** Enforced server-side as of June 2026  
**Enforcement point:** `POST /api/care-team/connect` in `server/routes/careTeamRoutes.ts`

---

## Official Connection Requirements

All five of the following must be true for a coaching relationship to activate:

1. **Client must have an active Clinical plan** (`mpm_ultimate`, `mpm_ultimate_monthly`, `mpm_ultimate_plan_2999` — or an active trial on any of those). Free, Essential, and Pro clients are blocked with `CLINICAL_REQUIRED`.

2. **Coach must have an active ProCare subscription** (`mpm_procare_monthly`, `mpm_trainer_5/10/25/50`, `mpm_physician_50/150`). Coaches whose ProCare subscription has lapsed or was never purchased are blocked with `COACH_NOT_SUBSCRIBED`.

3. **A valid, non-expired access code is required.** Codes live in `care_access_code` and are issued by the coach from the Pro Portal. Expired or non-existent codes are rejected with `Invalid code`.

4. **Legal documents must be accepted.** Client-side ProCare legal agreements must be signed before activation completes. Missing acceptance returns `LEGAL_REACCEPT_REQUIRED` and the client is shown the legal modal.

5. **No self-connection.** A coach cannot connect to themselves as a client (`SELF_ACTIVATION`).

---

## Subscription Cancellation Behavior

When a **client's** Clinical subscription is canceled (Stripe `customer.subscription.deleted`):
- All active `care_team_member` rows for that client are deactivated immediately.
- No grace period.

When a **coach's** ProCare subscription is canceled (Stripe `customer.subscription.deleted`):
- All active `care_team_member` rows where that coach is the `pro_user_id` are deactivated immediately via `terminateProCareRelationships()` in `server/routes/stripeWebhook.ts`.
- No grace period.

---

## Error Codes Returned by the API

| Code | Meaning | Frontend behavior |
|---|---|---|
| `CLINICAL_REQUIRED` | Client is below Clinical tier | Opens TierUpgradeModal (clinical config) |
| `COACH_NOT_SUBSCRIBED` | Coach has no active ProCare plan | Generic error toast |
| `LEGAL_REACCEPT_REQUIRED` | Legal docs not signed | Opens client legal modal |
| `SELF_ACTIVATION` | Client and coach are the same user | Generic error toast |
| `Invalid code` | Code missing or expired | Generic error toast |

---

## Verified Test Matrix (June 2026)

| Client tier | Coach ProCare | Expected | Actual |
|---|---|---|---|
| Free | Active | `CLINICAL_REQUIRED` | ✅ |
| Essential | Active | `CLINICAL_REQUIRED` | ✅ |
| Pro | Active | `CLINICAL_REQUIRED` | ✅ |
| Clinical | None / lapsed | `COACH_NOT_SUBSCRIBED` | ✅ |
| Clinical | Active | Passes to legal gate | ✅ |
| Any | Bogus code | `Invalid code` | ✅ |

---

## Key Files

| Purpose | File |
|---|---|
| Connection gate logic | `server/routes/careTeamRoutes.ts` |
| Cancellation termination | `server/routes/stripeWebhook.ts` → `terminateProCareRelationships()` |
| Client deactivation helper | `server/services/procareActivation.ts` → `deactivateProCareClient()` |
| Frontend upgrade modal trigger | `client/src/pages/More.tsx` → `connectWithCode()` |
| Tier upgrade modal | `client/src/components/modals/TierUpgradeModal.tsx` |
| Plan/tier definitions | `shared/planFeatures.ts` |

---

## What This Does Not Cover

- The **MPM platform coach** flow (`POST /api/notify-coach`) does not yet enforce a client-side Clinical check. That path is for users connecting to official MPM coaches (Monica, Jen, etc.) and may warrant a separate gate review.
- Relationship **reactivation** on re-subscribe is not implemented. A canceled client or coach must reconnect manually after resubscribing.
