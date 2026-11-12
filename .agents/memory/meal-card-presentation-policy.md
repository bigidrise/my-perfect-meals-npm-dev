---
name: Meal-card presentation policy
description: Founder-required delete appearance and expanded Create a Dish header hierarchy.
---

Existing meal-delete controls use a compact dark or transparent outlined appearance
with a subtle gray border and a red trash icon visible before hover. Keep an
accessible touch target without making the visible outline bulky. Hover may
emphasize red but must not be necessary to reveal it.

**Why:** The founder explicitly rejected large solid-red meal-delete buttons and
required mobile users to see a red icon without hover.

**How to apply:** Share one appearance across existing eligible meal-card deletion
sites, including Saved Meals, expanded recipes and creator cards. Keep the
appearance scoped to meal deletion: unrelated controls, including Shopping, must
not change automatically. Do not add deletion actions or alter existing
confirmation requirements, callbacks or permissions.

The expanded Create a Dish header places Favorites left and Create New right in
its first row, with the complete left-aligned wrapping recipe title below.

**Why:** The founder found the title-above-controls header crowded and explicitly
specified this order.

**How to apply:** Preserve subsequent description, image, serving, nutrition and
recipe content. Reuse the established card architecture; do not create another
meal-card renderer or force specialized child, clinical, beverage or pet layouts
into an unrelated header arrangement.
