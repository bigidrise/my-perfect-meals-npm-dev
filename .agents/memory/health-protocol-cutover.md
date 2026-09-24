---
name: Health protocol cutover boundary
description: Why source-aware clinical protocol reads need an all-surface, review-gated cutover.
---

Do not treat ambiguous legacy health entries as verified current medication or silently let a partially migrated food tool make a weaker decision. Keep the existing protections in place until reviewed source/status records, explicit deactivation paths, and every relevant food surface are ready for a coordinated cutover. An unresolved claim must not quietly become an unguarded meal.

**Why:** The same clinical behavior can currently originate from Builder choice, profile arrays, lab decisions, or provider assignment. Disabling only one source or switching only one tool can silently change what food the platform permits, while old data cannot establish whether a medication is still current.

**How to apply:** Use additive, reversible migration stages and compare old/new decisions before enabling authoritative reads. Preserve source-specific history and require an explicit review outcome for ambiguous or ended-owner claims; do not use a Builder as the master medical switch.