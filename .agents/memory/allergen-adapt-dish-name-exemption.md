---
name: ALLERGEN_ADAPT dish-name exemption
description: Why the post-adaptation allergen scan must exempt the requested dish's own name, and the strict rules for the exemption.
---

**Rule:** ALLERGEN_EXPANSION mixes ingredient terms with dish-name terms ("gumbo", "pad thai"). Dish-name terms exist so the pre-check can trigger the AllergyConflictModal — but the ALLERGEN_ADAPT post-scan must not condemn the adapted dish for keeping its own name (identity preservation is a requirement of adaptation).

**Why:** Before the fix, a shellfish-allergic "Make it safe for me" gumbo request always 422'd (`allergen_adaptation_failed`) because the scan flagged the word "gumbo" in the adapted meal's name/description.

**How to apply:** Use `getRequestedDishExemptTerms(requestedDish, allergens)` in allergyGuardrails.ts. A term is exempt ONLY when it is in the curated `ADAPTABLE_DISH_NAME_TERMS` allowlist (pure dish labels — never allergen-bearing preparations like frangipane/gambas/scampi/surimi, never terms embedding an allergen word like "peanut stew") AND appears word-bounded in the user's actual request. All ingredient/derivative terms stay scanned across name, ingredients, instructions, and description. When adding a dish name to ALLERGEN_EXPANSION, decide whether it belongs in the allowlist too; the Jest suite `server/tests/allergenAdaptDishNameExemption.test.ts` enforces the inclusion rules.
