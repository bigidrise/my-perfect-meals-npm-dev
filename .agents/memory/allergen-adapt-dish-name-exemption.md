---
name: ALLERGEN_ADAPT dish-name exemption
description: Requested-dish name exemption for allergy adaptation scans — where it must be applied and what scanGeneratedOutput actually scans
---

## Rule
When `safetyMode === "ALLERGEN_ADAPT"` (user picked "Make it safe for me"), the requested dish's own name ("gumbo", "pad thai") must be exempt from post-generation term matching in BOTH places:
1. Phase 3 allergen scan (`scanMealsForAllergenViolations` with `exemptTerms`), and
2. The universal protocol filter that runs before it — `filterMealsByProtocol` / `scanGeneratedOutput` accept `exemptDishNameTerms?: Set<string>` in context.

The exemption set comes from `getRequestedDishExemptTerms` (curated `ADAPTABLE_DISH_NAME_TERMS` allowlist ∩ word-bounded match in the user's request). It can only ever contain pure dish-name labels — never ingredient/derivative words — so shrimp/crab/shellfish-stock detection stays fully active.

**Why:** Without the exemption in the pre-Phase-3 filter, every adapted meal named after the requested dish is stripped before Phase 3 sees it, the retry dies the same way, and the user gets a spurious `allergen_adaptation_failed`.

**How to apply:** In the craving-creator route the exemption set is computed once (before `filterMealsByProtocol`) and shared with the Phase 3 scan. Any new surface that adds ALLERGEN_ADAPT must thread the same set into both layers.

## Non-obvious finding (verified empirically)
`scanGeneratedOutput` does NOT scan `envelope.allergies` against ALLERGEN_EXPANSION — it only scans dietaryIdentity hidden terms + avoidances. Allergen enforcement in craving-creator relies on the pre-generation safety check and the Phase 3 scan. Follow-up exists to consider adding a universal allergen scan; if that lands, it must honor both `overriddenAllergens` and `exemptDishNameTerms`.

Tests: `server/tests/allergenAdaptUniversalFilterExemption.test.ts`, `server/tests/allergenAdaptDishNameExemption.test.ts`.
