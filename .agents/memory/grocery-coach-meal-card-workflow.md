---
name: Grocery Coach meal-card workflow
description: User-defined automatic Favorites workflow and focused repair boundary.
---

Grocery Coach must automatically turn a recommendation into a complete meal card with recipe, ingredients, instructions, and nutrition, save it to Favorites, and preserve the card reference and generation status when reopening.

**Why:** The user confirmed that losing the card connection while retaining the recommendation is a regression, not the intended workflow. A missing UI reference does not prove the underlying Favorite was never saved.

**How to apply:** Restore recommendation and card state together. Interrupted generation needs a safe recovery action without duplicate Favorites. Refinement may remain secondary, but must not replace the primary card workflow. Keep this repair separate from the Chef macro correction; do not rebuild Grocery Coach or change its recommendation engine.
