---
name: Grocery Coach meal-card workflow
description: Automatic Favorites/card continuity and the limited packaged-product discovery boundary.
---

Grocery Coach must automatically turn a recommendation into a complete meal card with recipe, ingredients, instructions, and nutrition, save it to Favorites, and preserve the card reference and generation status when reopening.

**Why:** The user confirmed that losing the card connection while retaining the recommendation is a regression, not the intended workflow. A missing UI reference does not prove the underlying Favorite was never saved.

**How to apply:** Restore recommendation and card state together. Interrupted generation needs a safe recovery action without duplicate Favorites. Refinement may remain secondary, but must not replace the primary card workflow. Keep this repair separate from the Chef macro correction; do not rebuild Grocery Coach or change its recommendation engine.

## Packaged-product discovery boundary

Build a Meal and Find a Product share sourced catalog discovery, but ordinary ingredients do not need brand recommendations. Meal-row lookups must be user-initiated for eligible ingredients to buy, not automatic across the recipe or owned ingredients. This improvement is Development-only until separately approved for release; Product Scan remains outside its scope.

**Why:** The user requested useful packaged-product choices within the existing meal experience without rebuilding generation, weakening profile restrictions, changing servings, or implying that choosing a brand medically revalidates the finished meal.

**How to apply:** Preserve the original ingredient amount, unit, servings, and meal/card workflow. Display evidence and unresolved review needs with each choice, keep lookup errors local, and retain exact product identity and review qualifications when carrying a choice into shopping.

## Smart Grocery List foundation approval boundary

The user approved Development-only shopping-list foundation work: preserve original ingredient qualifications and recipe quantities, persist optional structured product choices, and prevent incompatible qualifiers or different selected products from merging. Preserve generic shopping behavior and account isolation.

**Why:** The user wants reliable transfer, consolidation, saving, and restoration before connecting product-selection UI.

**How to apply:** No new selection UI, AI/catalog lookups, recommendation algorithms, prompts, clinical rules, or ranking changes. Inspect persistence first and stop for separate approval before any required migration or destructive change. No real customer data changes, GitHub push, or Production deployment. Use focused synthetic tests for transfer, identity, qualifiers, persistence, hydration, and consolidation.
