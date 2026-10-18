---
name: Pediatric image product policy
description: Prepared-food realism and cost boundaries for Perfect Beginnings image generation.
---

Perfect Beginnings images should depict the actual prepared recipe at the child's developmental texture and serving size, not merely use an age-group label. A generic illustration is a genuine-failure fallback, not a successful recipe photograph.

**Why:** The user rejected an illustrated bowl shown for preschool pancakes, but explicitly wanted genuine-failure fallbacks retained and duplicate paid image requests prevented.

**How to apply:** Keep shared image generation, recipe validation, and storage as the owners. Carry visual preparation context through initial generation and saved-recipe restoration. Distinguish legacy noncontextual placeholders from failures after a fully contextual attempt; repairing the former must not create automatic retry loops for the latter. Use mocked providers and storage for automated verification, not paid image generation.

## Explicitly authorized single-image checks

A one-image authorization needs both provider-SDK retry suppression and an external one-shot guard before network I/O. Do not change application safety validation to make the check pass.

**Why:** The shared pipeline can request another image after a visual rejection, and the provider SDK has its own retry policy. A raw photograph returned by the provider is not a successful application image when the shared validator rejects it.

**How to apply:** Use only synthetic fixtures, preserve the first generated source image as clearly labeled diagnostic evidence, and stop paid generation after the authorized attempt. If validation rejects that image, report display and successful-photo save/restore as unverified rather than bypassing validation or promoting the rejected source.
