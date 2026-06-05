---
name: Diabetic Meal Memory System
description: Architecture decisions for BGL-stamped favorites and the diabetic meal playbook feature.
---

## What shipped (Phase 0 + Phase 1)

**Phase 0 — Security:**
- `/api/diabetes/*` routes now require `requireAuth` at the mount point in `routes.ts`.
- All four diabetes route handlers (GET/PUT profile, GET/POST glucose) use `authUser.id` from session — client-supplied `userId` is ignored entirely.
- `studioAccess.ts` `getUserId()` returns `string | null`; removed `x-user-id` header trust and hardcoded UUID fallback; all three callers null-guarded.

**Phase 1 — Diabetic Meal Memory Foundation:**
- `saved_meals` table has 5 new nullable columns: `generated_bgl_mgdl`, `glucose_context`, `protocol_type`, `bgl_bucket`, `saved_from_diabetic_builder`.
- `mealSignature()` accepts optional `bglBucket`; same meal at different BGL buckets produces different hashes → separate favorites entries (not a toggle collision).
- `diabeticMemory` JSONB stamp travels in `mealData` from generation → FavoriteButton → server → DB columns.
- `client/src/lib/diabeticMemory.ts` is the canonical utility for bucket/label/range computation.
- `MealCard` accepts `diabeticMemoryContext` prop; renders lime-accented "Diabetes Protocol" badge.
- `DiabeticMenuBuilder` fetches latest glucose via `useGlucoseLogs` (own user only), computes `diabeticMemoryCtx` via `useMemo`, passes to all 3 `MealCard` instances.
- ProCare context (coach viewing client builder): BGL stamp deliberately skipped (`proClientId` guard) — deferred to a later phase.

## Phases held

**Why:**
- Phase 2 (outcome tracking) and Phase 3 (recommendation engine): held until real users prove they save and use diabetic favorites. Build the recommendations when there's a library to recommend from.

## Key rules to stay consistent with

- BGL buckets: low < 70, in-range 70–140, elevated 141–200, high > 200.
- `recommendedBglRange` is always the bucket's full bounds (e.g. "141–200 mg/dL"), not ±N around the exact value.
- The hash includes `bglBucket` only when diabeticMemory is present; legacy (non-diabetic) saves use the original hash with empty bglBucket suffix.
- Never stamp BGL context when `proClientId` is set — the session user is the coach, not the client.
