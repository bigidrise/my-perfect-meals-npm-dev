---
name: Allergy Adaptation Decision Layer
description: Architecture and implementation of the 3-phase allergy conflict system — conflict classification, AllergyConflictModal, post-adaptation scan
---

# Allergy Adaptation Decision Layer — Phase 1/2/3 Complete

## Problem
An allergy pre-check was binary: any match → hard block. Requesting "gumbo" with shellfish allergy blocked the dish entirely, even though shellfish-free gumbo is a real dish. The system had no way to offer adaptation.

## Architecture (3-phase)

### Phase 1: Conflict Classification (Backend)
- `classifyAllergyConflict()` in `server/services/allergyGuardrails.ts`
- Returns `conflict_adaptable` (dish can exist without allergen) or `conflict_identity_collapse` (allergen IS the dish)
- `ALLERGEN_DISH_EXPANSIONS` set: dish names where allergen is incidental (gumbo, paella, kung pao)
- `IDENTITY_COLLAPSE_DISH_TERMS` set: dishes where allergen defines identity (shrimp cocktail, crab cakes)
- Default: `conflict_adaptable` — fail-open; Phase 3 scan is the safety net
- `buildForbiddenTermsFromAllergens()`: expands allergen categories to full term list for Phase 3

### Phase 1 API changes:
- `SafetyAssessment.allergyConflict?: AllergyConflict` added to interface
- `SafetyMode` type extended with `"ALLERGEN_ADAPT"` (safetyPinService.ts)
- `/api/safety-check` response now includes `allergyConflict` field
- `/api/meals/craving-creator`: skips allergen pre-check when `safetyMode === "ALLERGEN_ADAPT"`
- `/api/meals/craving-creator` BLOCKED response includes `allergyConflict` field

### Phase 2: AllergyConflictModal (Frontend)
- `client/src/components/AllergyConflictModal.tsx` — three-way choice modal
  - "Make it safe for me" — DAL adapt path, NO Safety PIN required
  - "Make the original" — restores SafetyGuardBanner → user enters Safety PIN
  - "Cancel"
- For `conflict_identity_collapse`: no "Make it safe" button shown
- `useSafetyGuardPrecheck.ts`:
  - New `allergyConflictPayload` MutableRef — set instead of showing SafetyGuardBanner
  - New `restoreBlockedAlert()` — restores BLOCKED banner state for "Make original" flow
  - When BLOCKED + allergyConflict → intercept silently, let page show modal
- `CreateDishPage.tsx`:
  - `allergyConflict` state, `allergenSafeModeRef` ref
  - After `checkSafety()` returns false, checks `allergyConflictPayload.current`
  - If conflict present → shows AllergyConflictModal
  - "Make it safe" → sets `allergenSafeModeRef.current = true`, re-generates with `safetyMode: "ALLERGEN_ADAPT"`, resets ref in finally
- `CreateWithChefModal.tsx`: same pattern

### Phase 3: Post-Adaptation Allergen Scan (Backend)
- In `/api/meals/craving-creator` route, after `scannedOptions` is set
- When `safetyMode === "ALLERGEN_ADAPT"`, scans each generated option against expanded allergen term list
- Options with allergen traces (shrimp paste, fish sauce, etc.) are filtered out
- If ALL options fail → returns 422 with `allergen_adapt_failed` reasonCode
- Non-fatal scan errors don't block — logged but meal served

## Key Rules
- "Make it safe" NEVER requires Safety PIN — it's the safe path
- "Make original" always requires Safety PIN — that's the risky override
- Default classification = `conflict_adaptable` — always offer the safe path; Phase 3 catches failures
- `allergenSafeModeRef.current` is reset in `finally` block after generation
- The `restoreBlockedAlert()` function preserves the BLOCKED state so the PIN flow works after modal dismiss

## Files Modified
- `server/services/allergyGuardrails.ts` — +95 lines: classification constants + functions
- `server/services/safetyProfileService.ts` — adds `allergyConflict` to both async + sync BLOCKED returns
- `server/services/safetyPinService.ts` — `SafetyMode` type includes "ALLERGEN_ADAPT"
- `server/routes.ts` — craving-creator: ALLERGEN_ADAPT bypass + BLOCKED allergyConflict + Phase 3 scan
- `client/src/components/AllergyConflictModal.tsx` — new component
- `client/src/hooks/useSafetyGuardPrecheck.ts` — allergyConflictPayload + restoreBlockedAlert
- `client/src/hooks/useCreateWithChefRequest.ts` — SafetyMode type includes "ALLERGEN_ADAPT"
- `client/src/pages/lifestyle/CreateDishPage.tsx` — modal integration
- `client/src/components/CreateWithChefModal.tsx` — modal integration

**Why:** An allergy should block the dangerous ingredient, not automatically block every dish that traditionally contains it. "Shellfish-free gumbo" is a real dish; blocking it entirely is hostile UX.
