---
name: Daily Prescription Hierarchy
description: The authoritative macro hierarchy in prescriptionResolver.ts — Macro Calculator → GLP-1 → Performance — and which surfaces now read it.
---

## Rule
All macro targets come from one place: `GET /api/prescription/:dateISO` →
`resolveDailyNutritionPrescription()` in `server/services/prescriptionResolver.ts`.

## Hierarchy (strictly ordered)
1. **Macro Calculator baseline** — `caloriesBase`, `proteinBase`, etc. from DB columns
2. **GLP-1 clinical overlay** — applied if `specialtyConditions.includes("glp1")` or
   `medicalConditions` includes `"glp1"/"glp-1"`. Loads `glp1_profile.guardrails` and
   applies a phase multiplier (intro 0.82×, muscle_preserve 1.08×) + daily protein floor
   and fat ceiling. Sets `source = "clinical"`.
3. **Performance training-day modifier** — applied on top of GLP-1-adjusted values, never
   on raw `caloriesBase`. Sets `source = "performance"`.
4. **GLP-1 re-enforcement after Performance** — protein floor and fat ceiling are re-clamped
   post-Performance so Performance can never silently bust clinical limits.

**Why:** Performance was previously bypassing GLP-1 by operating on the raw baseline; now
it must start from the GLP-1-adjusted values, and limits are re-enforced afterward.

## Surfaces that now read the prescription endpoint
- `useDailyPrescription` hook — all 6 builders already used this for starch context; they
  now also read its macro targets via `DailyMacroTotalsRow`.
- `DailyMacroTotalsRow` (`client/src/components/DailyMacroTotalsRow.tsx`) — shared Today
  row component used by all 6 builders. Renders color-coded P/C/F/Cal pills.
- `my-biometrics.tsx` → `refreshTargets()` — replaced dual-source
  (`/api/performance/today` + `/api/users/:id/macro-targets`) with single call to
  `/api/prescription/:dateISO`.

## Source label mapping in Biometrics
`prescription.source` → `targetSource` state:
- `"performance"` → `"performance"`
- `"professional_override"` → `"pro"`
- `"clinical"` → `"self"` (GLP-1 overlay; no separate label in Biometrics UI type)
- everything else → `"self"`

## Things NOT changed
- `useBaselineNutrition` / `usePerformanceNutrition` — still used elsewhere
- `macroResolver.ts` client-side resolver
- `daily_nutrition_prescriptions` table (still unwritten — future persistence layer)
