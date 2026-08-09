---
name: Performance Mode Enabled Flag
description: performanceModeEnabled DB boolean gates all performance macro modifiers; schedule stored ≠ performance active
---

# Performance Mode Enabled Flag

## The Rule
`performanceModeEnabled` (boolean, DEFAULT false) is the ONLY gate that activates performance macro modifiers. A saved `weeklyTrainingSchedule` alone never activates performance — users must explicitly choose it via an entry page button.

**Why:** "Schedule stored" ≠ "performance active." Before this change, any user with a stored schedule got performance-adjusted targets in every builder, silently contaminating macro targets.

## How to Apply
- New builder surfaces: use `useBaselineNutrition` (not `usePerformanceNutrition`) by default. Only `PerformanceCompetitionBuilder` legitimately uses `usePerformanceNutrition`.
- Gates are in two places:
  1. Client: `getPerformanceProtocolTargets()` in `client/src/lib/macroResolver.ts` — reads `enabled` from `localStorage mpm.perfProtocol.{userId}`
  2. Server: `prescriptionResolver.ts` — `if (weeklySchedule && perfConfig && user.performanceModeEnabled)`
- The performance nutrition `/ask` coach endpoint does NOT gate on this flag — it always applies modifiers (it IS the performance coach).

## Entry Page Contract
Every builder entry page (Diabetic, GLP-1, Anti-Inflammatory, General Nutrition) must:
- Button 1 "Continue" → `PATCH /api/performance/mode { enabled: false }` then navigate to builder
- Button 2 "Training Schedule" → `PATCH /api/performance/mode { enabled: true }` then navigate

The `PATCH /api/performance/mode` endpoint is in `server/routes/performanceNutrition.ts`.

## AuthContext Sync
`refreshUser()` maps `performanceModeEnabled` from `/api/user/profile` into the User object AND into the localStorage `mpm.perfProtocol.{uid}` key as `{ schedule, config, enabled }`. Always keep both in sync.

## Status Indicator
`DailyTargetsCard` reads `user.performanceModeEnabled` from `useAuth()` and shows a "⚡ Strength Day" pill when active. This is acceptable — it's a display-only flag read, not a resolver call.

## prescriptionRoutes Auth Pattern
All handlers in `server/routes/prescriptionRoutes.ts` must use `(req as any).authUser?.id || (req.session as any)?.userId` — NOT `(req as any).user?.id`. The `requireAuth` middleware attaches to `req.authUser`, never `req.user`. Using `req.user` silently returns 401, which `useDailyPrescription` was treating as "server unreachable" and falling back to hardcoded defaults. Both read (GET) and write (PATCH) paths were broken.

`useDailyPrescription` now logs auth errors (401/403) as `console.error` with a diagnostic message, distinct from network failures (`console.warn`).

## Pending (Task #539)
Performance Hub / PerformanceCompetitionBuilder entry doesn't yet call `PATCH /mode { enabled: true }` on entry. The coach /ask always applies modifiers regardless of the flag, so numbers may mismatch between surfaces within a session.
