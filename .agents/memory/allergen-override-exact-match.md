---
name: Allergen override exact-key matching
description: PIN allergen overrides must match stored allergies by exact canonical key, never substring.
---

# Allergen override exact-key matching

**Rule:** Anywhere a Safety-PIN `overriddenAllergens` list is compared against stored allergies (prompt-block filtering, post-gen scan suppression, dish-adaptation guardrail contexts, fallback allergy blocks), use `allergenKeysMatch()` / `canonicalAllergenKey()` from `allergyGuardrails` — never substring matching.

**Why:** Bidirectional substring matching (`a.includes(b) || b.includes(a)`) let a "fish" override silently unlock the distinct "shellfish" allergy ("shellfish" contains "fish") — a medical-safety regression caught in code review. Aliases that truly denote the same allergy (milk↔dairy, singular/plural, alpha-gal spellings) live in a deliberate alias map; singular/plural is the only fuzzy rule.

**How to apply:** When threading a PIN override to a new generation surface, filter the prompt envelope's allergies AND pass `overriddenAllergens` into the scan context, both via `allergenKeysMatch`. Regression pattern: profile with both fish and shellfish — overriding one must never suppress the other.
