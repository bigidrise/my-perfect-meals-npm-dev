---
name: Therapeutic Nutrition Intelligence — Phase 1 Architecture
description: How Sprint 4 Phase 1 was built; key integration points and patterns to follow for Phase 2+3.
---

## Architecture

- **DB column**: `therapeutic_support_context jsonb` on users table. Boot-migrated in both server/index.ts and server/prod.ts.
- **Specialty condition slug**: `"therapeutic-support"` — added to specialtyConditions array when context is non-empty; removed when cleared.
- **Protocol Envelope fields**: `therapeuticSupport: boolean` + `therapeuticSupportContext: {peptides, hormones, medications, therapies, recoveryGoals} | null` — added at end of UserProtocolEnvelope interface.
- **Guidance injection**: `buildTherapeuticGuidanceBlocks()` in `server/services/therapeuticGuidance.ts` called from `buildUniversalConditionGuidance()` in universalMedicalGuidance.ts. Appended to `conditionGuidanceBlocks[]`. No builder-specific changes needed.
- **Tier position**: Tier 3 (Therapeutic Support) — below Clinical Safety & Medical Hard Limits, above Performance and Preferences.

## Key design principle (intersection-aware modal)
The modal must NOT say "you selected BPC-157." It must say "because you selected BPC-157, AND Diabetes Support and Power Training are also active, your meals will prioritize blood sugar management, protein preservation, and connective tissue recovery."
This is computed by `buildTherapeuticModalContent()` in therapeuticGuidance.ts — reads specialtyConditions and healthConditions from the user row at save time.

## Files
- `server/services/therapeuticGuidance.ts` — guidance blocks + modal builder
- `server/routes/therapeuticSetup.ts` — GET /api/therapeutic/context + POST /api/therapeutic/setup
- `client/src/components/biometrics/TherapeuticNutritionCard.tsx` — biometrics panel
- `client/src/components/biometrics/TherapeuticProtocolModal.tsx` — intersection modal

## Phase 2 targets (visibility)
- Feed therapeuticSupportContext into NutritionPersonalizationSummaryCard via buildNutritionSummary.ts
- Add "Therapeutic Support" chips to ProtocolVisibilityPanel
- Update NutritionSummary DTO to expose therapeuticSupport and therapeuticSupportContext

## Smoke test gate (Phase 1)
Per the Sprint 4 plan: TRT saves correctly, context persists, protocol envelope receives data, Create a Dish and Fridge Rescue honor protocol, no regressions on diabetes/thyroid/pregnancy/performance.

**Why:** Clinical safety always wins. Therapeutic is additive — it never overrides medicalHardLimits or medicalOptimization. The conditionGuidanceBlocks[] injection pattern is the correct one; do not add a separate prompt layer.
