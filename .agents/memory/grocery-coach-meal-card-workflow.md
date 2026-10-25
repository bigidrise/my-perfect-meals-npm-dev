---
name: Grocery Coach meal-card workflow
description: Automatic Favorites/card continuity and the limited packaged-product discovery boundary.
---

Grocery Coach must automatically turn a recommendation into a complete meal card with recipe, ingredients, instructions, and nutrition, save it to Favorites, and preserve the card reference and generation status when reopening.

**Why:** The user confirmed that losing the card connection while retaining the recommendation is a regression, not the intended workflow. A missing UI reference does not prove the underlying Favorite was never saved.

**How to apply:** Restore recommendation and card state together. Interrupted generation needs a safe recovery action without duplicate Favorites. Refinement may remain secondary, but must not replace the primary card workflow. Keep this repair separate from the Chef macro correction; do not rebuild Grocery Coach or change its recommendation engine.

## Packaged-product discovery boundary

Build a Meal's sourced catalog discovery remains user-initiated for eligible ingredients to buy, not automatic across the recipe or owned ingredients. Ordinary ingredients do not need brand recommendations. This improvement is Development-only until separately approved for release.

**Why:** The user requested useful packaged-product choices within the existing meal experience without rebuilding generation, weakening profile restrictions, changing servings, or implying that choosing a brand medically revalidates the finished meal.

**How to apply:** Preserve the original ingredient amount, unit, servings, and meal/card workflow. Display evidence and unresolved review needs with each choice, keep lookup errors local, and retain exact product identity and review qualifications when carrying a choice into shopping.

## Find a Product and Product Scan

Find a Product reuses the existing Product Scan by-name intelligence and results, not a new catalog, provider, AI engine, interface, or safety framework. Preserve Grocery Coach's tabs and text/voice submission. Human Product Scan opens with Choose Photo and Camera; its underlying text capability remains available to Grocery Coach. These changes are Development-only until separately approved.

**Why:** The user clarified that missing verification should not automatically mean missing guidance. Find a Product helps customers discover options; Product Scan evaluates a specific photographed product.

**How to apply:** Allow qualified knowledge-based suggestions without claiming verified ingredients, allergen absence, or medical safety. Explain current-label checks and do not invent products, nutrition values, availability, or grades to reach three options. Preserve known restrictions and the photo-analysis behavior; no broad redesign or nutrition-rule changes.

## Smart Grocery List foundation approval boundary

The user approved Development-only shopping-list foundation work: preserve original ingredient qualifications and recipe quantities, persist optional structured product choices, and prevent incompatible qualifiers or different selected products from merging. Preserve generic shopping behavior and account isolation.

**Why:** The user wants reliable transfer, consolidation, saving, and restoration before connecting product-selection UI.

**How to apply:** No new selection UI, AI/catalog lookups, recommendation algorithms, prompts, clinical rules, or ranking changes. Inspect persistence first and stop for separate approval before any required migration or destructive change. No real customer data changes, GitHub push, or Production deployment. Use focused synthetic tests for transfer, identity, qualifiers, persistence, hydration, and consolidation.
