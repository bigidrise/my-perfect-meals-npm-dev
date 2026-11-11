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

Restore shared actions and prove inheritance before implementing Shopping.
Shopping behavior, transfer APIs and schema changes require the separate Phase 2
review checkpoint. Initial verification uses isolated fixtures or mocked
persistence; shared-Production database migrations need separate approval.

**Why:** The founder explicitly required a stop after Phase 1, rather than treating
the full two-phase brief as permission to implement or activate Shopping.

**How to apply:** Preserve existing bulk shopping and customer list data while
restoring shared action composition. Report the proposed transfer API and durable
repeat-protection schema before beginning that separate implementation.
