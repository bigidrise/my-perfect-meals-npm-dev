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
The founder later confirmed the smaller red trash icon was an improvement and
explicitly asked to retain its styling.

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

Saved Meals/Favorites uses source and calories-per-serving metadata at the left
of its first row, with chevron and trash grouped at the right. The full wrapping
recipe title gets its own full-width second row; images and expanded content
follow beneath the header.

**Why:** The founder explicitly rejected a title competing with controls, a
disconnected chevron and metadata squeezed beneath the title. They requested
the same coordinated hierarchy as Create a Dish, not a separate redesign.

**How to apply:** Refine the existing shared Saved Meals renderer. Preserve
header/title/image expansion, keyboard-accessible toggling, independent trash
behavior, canonical image fallbacks and translated titles. Header styling must
not change persistence, Shopping, quantities, nutrition or existing actions.
