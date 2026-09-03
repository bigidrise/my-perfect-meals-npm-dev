---
name: Alpha-gal Syndrome — Architecture
description: Clinical allergy protocol for Alpha-gal Syndrome (Mammalian Meat Allergy) — data model, detection pattern, rule registry, and onboarding modal.
---

# Alpha-gal Syndrome — Architecture

## The Rule

Alpha-gal is a **clinical allergy protocol**, NOT a dietary identity. It must never appear beside Vegan/Vegetarian. It sits in the clinical-allergy tier of the envelope, above all generators.

**Why:** The IgE-mediated reaction can be anaphylactic. Fail-closed defaults are mandatory.

## Data Model

- `alpha_gal_profile JSONB` column on `users` table
- Boot migration in BOTH `server/index.ts` AND `server/prod.ts`
- Schema type in `shared/schema.ts` as `users.alphaGalProfile`
- Profile shape: `{ diagnosisStatus, dairyTolerance, gelatinRestriction, severeReactionHistory, profileComplete, activatedAt, updatedAt }`

## Detection Pattern (protocolEnvelope.ts)

Detects from EITHER `specialtyConditions` OR `healthConditions` (via `mergedHealthConditions`). Keys: `"alpha-gal-syndrome"`, `"alpha-gal syndrome"`, `"alpha gal syndrome"`, `"alpha-gal"`, `"alpha gal"`.

## Fail-Closed Rule (ALPHAGAL-EMERGENCY-001)

When `alphaGalProfile` is absent or `profileComplete: false`, conservative defaults apply:
- Core mammalian blocks: ACTIVE
- Dairy: FLAGGED (unsure)
- Gelatin: FLAGGED (unsure)

## Dairy Is Never Universally Blocked

**Why:** Many Alpha-gal patients tolerate dairy. Only block dairy when `dairyTolerance === "no"`.

## Governed Rule Registry

- `ALPHAGAL-CORE-001`: Mammalian meats hard blocked
- `ALPHAGAL-CORE-002`: Mammalian organ meats hard blocked
- `ALPHAGAL-CORE-003`: Mammalian fats (lard, tallow, suet) hard blocked
- `ALPHAGAL-CORE-004`: Mammalian stocks/broths hard blocked
- `ALPHAGAL-COND-001`: Dairy blocked when `dairyTolerance === "no"`
- `ALPHAGAL-COND-002`: Dairy flagged when `dairyTolerance === "unsure"`
- `ALPHAGAL-COND-003`: Gelatin flagged when `gelatinRestriction !== "no"`
- `ALPHAGAL-EMERGENCY-001`: Conservative defaults when profile incomplete

## Key Files

- `server/services/alphaGal/resolveAlphaGalRestrictions.ts` — resolver + `ALPHA_GAL_CORE_HARD_BLOCKS` export
- `server/services/allergyGuardrails.ts` — `ALLERGEN_EXPANSION["alpha-gal"]` + aliases for hard-block propagation
- `server/services/universalMedicalGuidance.ts` — `buildAlphaGalGuidance()` + `alphaGalContext` field in `UniversalGuidanceInput`
- `server/services/protocolEnvelope.ts` — detection block + `alphaGalProfile` in SELECT + pass to guidance
- `server/services/onboardingMergeService.ts` — saves `alphaGalProfile` JSONB from `standalone-profile` step
- `client/src/pages/onboarding-standalone.tsx` — `AlphaGalProfileData` type, modal state, bottom-sheet modal with 4 questions, incomplete warning

## Onboarding Modal Pattern

- Alpha-gal entry in `medicalConditionsList` has `requiresSubModal: true`
- Checking it opens a bottom-sheet modal inline (no page navigation)
- Modal has 4 questions: diagnosisStatus, dairyTolerance, gelatinRestriction, severeReactionHistory
- If modal closed without saving → incomplete warning badge shown → modal can be re-opened
- `alphaGalProfile` state is separate from `data` (like `safetyPin`)
- Profile included in onboarding submission payload alongside `medicalConditions`

## Future Work Flagged

- Restaurant intelligence third state ("Verify With Restaurant") — for mammalian-ambiguous dishes
- Coach's Corner medication/supplement informational note — needs explicit integration
