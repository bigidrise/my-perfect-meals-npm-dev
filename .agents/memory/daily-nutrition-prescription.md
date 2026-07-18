---
name: DailyNutritionPrescription Architecture
description: Shared contract + server resolver for the nutrition prescription system. Key rules for extension and integration.
---

# DailyNutritionPrescription Architecture

## The contract
`shared/dailyNutritionPrescription.ts` — the single output type every builder and tracker must consume.

Key design rules:
- `starchMealsAllowed` is an **integer** — never a "one"/"flex" string. All callers use this.
- `rationaleCodes` carry machine-readable reasons for every non-fallback decision.
- Fields that can't be determined are `undefined`, never `null` or `0`.
- The contract is additive — only add fields, never remove without migration.

## Server resolver
`server/services/prescriptionResolver.ts`

Uses only **real DB columns** — no `(user as any)` for fields that don't exist:
- `dailyCalorieTarget`, `dailyProteinTarget`, `dailyCarbsTarget`, `dailyFatTarget`
- `dailyStarchyCarbsTarget`, `dailyFibrousCarbsTarget`
- `weeklyTrainingSchedule`, `performanceProtocolConfig`
- `starchPlanDefined` (boolean) — used to infer "one" vs "flex" baseline strategy
- `planLookupKey` — for clinical tier check

Clinical precision status uses:
- `clinical_labs` table count (hasLabs)
- `companion_profiles.medications` JSONB array (hasMedications)

**Why:** These are the only columns that actually exist. Earlier designs referenced `starchStrategy`, `hasLabResults`, `reportedMedications`, `medicalProfile` as standalone columns — they do not exist.

## API route
`server/routes/prescriptionRoutes.ts` — mounted at `/api/prescription/:dateISO`

Must be mounted in **both** `server/routes.ts` AND `server/prod.ts` (prod parity rule).

## Client hook
`client/src/hooks/useDailyPrescription.ts`

Falls back to `buildFallbackPrescription()` on server error — never crashes.
Pass `disabled=true` for ProCare professional views.

## Weekly Meal Board integration
`WeeklyMealBoard.tsx` computes `activeDayConsumed` (starchyCarbs + starchMealsUsed)
from the board state, feeds them into `useDailyPrescription`, passes `prescription`
to `DailyStarchIndicator`.

`DailyStarchIndicator` accepts `prescription` prop (preferred) OR legacy
`strategyOverride`+`bodyFatSlotDelta` (backward compat). Both paths work.

## Priority hierarchy (server)
1. Performance Hub (weeklyTrainingSchedule + performanceProtocolConfig)
2. User baseline (DB macro target columns)
3. Fallback (returns zeros with rationaleCodes: ["fallback_no_targets"])

ProCare professional overrides are handled upstream, not in this resolver.

## Critical import path
`users` must be imported from `../../shared/schema` (not `../db/schema` which doesn't export it).
`clinicalLabs` and `companionProfiles` come from `../db/schema/clinicalLabs` etc.

## DB columns added
- `default_starch_meals_per_day` integer on users — saved via PATCH /api/prescription/starch-preferences
- `starch_distribution_strategy` text on users — valid values: even|workout|morning|evening|ai

## Tests
Run: `npx tsx scripts/test-prescription-pure-functions.ts` — 38 cases, all pure functions.
`deriveClinicalStatus` lives in shared/dailyNutritionPrescription.ts (importable without DB).

## Next phases
- Phase 2: Adaptive starch gram tracking (gramsPerRemainingStarchMeal already in contract)
- Phase 3: Medication/clinical gate inside Macro Calculator
- Phase 4: Clinical Precision Active confirmation card
