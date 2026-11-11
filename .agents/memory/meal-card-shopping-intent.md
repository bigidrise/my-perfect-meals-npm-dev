---
name: Individual meal-card shopping intent
description: Product intent for shopping from chosen recipes rather than only an entire generated menu.
---

The user wants a Shopping action on every eligible individual ingredient-backed
meal card, including Create a Dish, Gatherings and pediatric recipes. Meal
builders may hide that card action and keep their bulk shopping bars.

**Why:** A member may keep only some Gathering courses, choose a different
dessert, or reopen one recipe without wanting the whole generated menu.

**How to apply:** Preserve selection of individual finalized recipes and
compatible ingredient aggregation into the existing shopping list. Individual
and whole-menu actions must not double-count the same selection. Do not change
the original meal, macro calculations or existing safety authority.

The user suggested Shopping could occupy the Translate button's primary slot.
That suggestion is not permission to remove translated recipe content.

**Why:** The supplied requirements explicitly require equivalent ingredient and
instruction translation before removing the existing functionality.

**How to apply:** Separate a button-placement change from removal of translation;
preserve a secondary translation action until content parity is established.

The founder's intended architecture is that modifying shared meal-card actions
automatically updates every feature using the standardized card. Verify actual
consumer inheritance before Shopping implementation; do not introduce another
meal-card system.

**Why:** The founder explicitly requested architecture verification and minimum
restoration of one-source-of-truth behavior before changing Shopping.

**How to apply:** Prefer reconnecting eligible feature footers to the existing
shared action owner over creating another universal renderer. Keep existing
Add to Plan and Add to Macros behavior and retain necessary feature-specific
content and safety controls.

The founder accepted Phase 1 and authorized Phase 2 implementation in Development
only. Additive migration files may be written, but migrations must not run against
the Development/Production-shared database. Do not modify live customer shopping
lists or test persistence with real customer accounts.

**Why:** The Phase 2 authorization explicitly permits implementation while
reserving shared-database execution and release for review.

**How to apply:** Use isolated persistence and mocked requests until migration
review and approval. Preserve existing bulk shopping, clinical calculations and
safety controls. Do not push, create a PR, merge, publish or deploy before review.
