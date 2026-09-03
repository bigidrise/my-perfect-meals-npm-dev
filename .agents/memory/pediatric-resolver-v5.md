---
name: Pediatric Resolver Adapter — v5 complete
description: Architecture decisions and non-obvious patterns in the scenario-runner adapter appended to pediatricResolver.ts
---

## Status
All 110 scenarios pass: 7/7 hard stops (100%), 103/103 soft (100%).
Adapter lives in `server/services/pediatric/pediatricResolver.ts` after line 1884 (original resolver ends there).

## Non-obvious adapter rules

### mealType derivation
- Only `birthday_party` mealContext early-returns `"any"`. `family_meal` and `pantry_only` fall through so foodRequest keywords still drive the meal type.
- `"meal"` as a standalone word in the foodRequest maps to `"dinner"` as a fallback (before the final `"any"`).
- Regex must use `pancakes?` not `pancake` to match plural form.

### top8-maximum-exclusion threshold
- Celiac disease counts as +1 toward the compound-exclusion threshold. Rule: `confirmedAllergies.length + (celiac ? 1 : 0) >= 4`.

### Family meal — language flag propagation
- Family member condition language flags AND behavioral flag language flags MUST be merged into the anchor child's `languageFlagSet`. Without this, scenarios where the anchor child has no conditions never produce the correct warning flags.

### Family meal — wellness rule
- `MPB-LANGUAGE-WELLNESS` fires when ANY family member has `pediatric_obesity` or `type2_diabetes`, not just the anchor child.

### Family meal — individual-portion-adaptation
- `"individual-portion-adaptation"` protocol fires when `familyHasFtt && familyHasObesity` (FTT and obesity co-exist across any family members).

### Family member allergen expansion
- Family member allergens with severity `clinician_elimination` MUST be included in the allergen expansion loop (same treatment as `confirmed_allergy`). Omitting this caused flour tortillas to be missing for celiac + wheat clinician_elimination family members.

### sensory_texture_restriction behavioral flag
- Maps to `MPB-BEH005` (same ruleId as `limited_food_repertoire`).
- Language flags: `["tricked", "hidden vegetables", "hide vegetables", "hide"]`.
- No protocols of its own — autism_spectrum condition already adds the texture exclusions (AUTISM_EXCLUSIONS).

### food_exposure_tracking behavioral flag
- Maps to `MPB-BEH002` (same ruleId as `food_neophobia`).
- Protocols: `["food-exposure-strategy", "repeated-exposure-approach", "low-pressure-introduction", "safe-food-alongside-new", "division-of-responsibility"]`.
- Language flags include `"bribe"` (shared with picky_eater flags).

### requiresSchoolSafe
- Always fires `MPB-CTX001` and `"nut-free-school-zone"` (when nut allergy present), regardless of `mealContext`. So birthday_party + requiresSchoolSafe fires BOTH MPB-CTX003 and MPB-CTX001.

### picky_eater protocols
- Include `"sensory-similarity-bridging"` (for bridging from familiar to new via sensory similarity).

## What comes next (per agreed sequence)
1. Resolver Inspector review — 3 profiles: healthy preschooler, celiac+sesame+iron+texture restriction, PKU hard stop.
2. Connect Create a Dish to the adapter (do not do this before Inspector review).
