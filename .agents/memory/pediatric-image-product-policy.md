---
name: Pediatric image product policy
description: Prepared-food realism and cost boundaries for Perfect Beginnings image generation.
---

Perfect Beginnings images should depict the actual prepared recipe at the child's developmental texture and serving size, not merely use an age-group label. A generic illustration is a genuine-failure fallback, not a successful recipe photograph.

**Why:** The user rejected an illustrated bowl shown for preschool pancakes, but explicitly wanted genuine-failure fallbacks retained and duplicate paid image requests prevented.

**How to apply:** Keep shared image generation, recipe validation, and storage as the owners. Carry visual preparation context through initial generation and saved-recipe restoration. Distinguish legacy noncontextual placeholders from failures after a fully contextual attempt; repairing the former must not create automatic retry loops for the latter. Use mocked providers and storage for automated verification, not paid image generation.

Failed saved images may have a controlled manual recovery action, but never automatically regenerate all previously failed images. Initial investigation and regression verification must not trigger paid image calls; report evidence and the proposed correction before seeking approval for a live paid test.

**Why:** The user explicitly requested manual recovery with duplicate-request/charge protection while preserving recipes, age-specific safeguards and working image generation.

**How to apply:** Keep recovery user-initiated and bound to the exact saved meal and child. Treat provider model metadata as availability evidence only, not proof a paid generation succeeds. Do not assign an original provider failure cause when only a saved fallback survives.
