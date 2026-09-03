---
name: Override propagation invariant — meal generation
description: A Safety PIN allergen override must survive from pre-gen enforcement to every post-gen scan, or the scan re-blocks the meal the PIN just authorized.
---

**Rule:** Whatever authorizes an allergen override before generation must hand the authorized allergen(s) to every post-generation safety scan for that same request. Any new builder/generator branch added to the unified pipeline must accept and thread `overriddenAllergens` to its post-gen scan — cached results and inline sub-generators (beverages, snacks, fridge) included.

**Why:** Pre-gen enforcement and post-gen scanning are separate layers. If the override is validated but dropped between them, the post-gen scan re-blocks the meal on the exact allergen the user's PIN authorized — the user sees a failure after a successful PIN entry. This shipped as a real bug and was rejected twice in review for branches that were missed.

**How to apply:** When adding a generation branch or cache-return path, ask "which scan runs on this output, and does it receive the request's override context?" Matching must be exact canonical-key (see allergen-override-exact-match.md), never substring.
