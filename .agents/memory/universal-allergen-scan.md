---
name: Universal allergen scan in scanGeneratedOutput
description: envelope.allergies is now scanned post-generation at every surface, not only Phase 3
---

`scanGeneratedOutput` (server/services/protocolEnvelope.ts) scans `envelope.allergies` against `ALLERGEN_EXPANSION` in addition to dietaryIdentity + avoidances. Previously only the Phase 3 ALLERGEN_ADAPT scan did this, leaving mealRefinementEngine, restaurantMealGeneratorAI, and unifiedMealPipeline chef/snack paths without a post-generation allergen derivative check.

**Rules:**
- Matching deliberately mirrors `scanMealsForAllergenViolations`: word-bounded, case-insensitive, on RAW meal text (no `normalizeForDietaryScan` masking). Masking plant milks would hide "almond" from tree-nut allergy scans, so the raw-text false positive (e.g. "almond milk" flagging a dairy allergy) is accepted as fail-safe — same as Phase 3.
- `overriddenAllergens` excludes the overridden allergen (bidirectional substring on the allergen key) BEFORE expansion — term-level substring filtering can't map "shrimp"→"shellfish".
- Violations carry category `allergy:<key>`; the existing `exemptDishNameTerms` filter still exempts pure dish names (gumbo) afterward.
- Unknown allergen keys fall back to the literal term.

**Why:** allergen leaks must be caught universally; only Phase 3 caught them before.

**How to apply:** any change to allergen matching semantics must keep this and `scanMealsForAllergenViolations` in lockstep. Tests: server/tests/scanGeneratedOutputAllergenScan.test.ts and server/tests/allergenAdaptUniversalFilterExemption.test.ts.
