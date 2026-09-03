---
name: Clinical Translation Controlled Review
description: How the 138 protected clinical strings are translated safely; GATE_07 enforcement layers.
---

The 138 clinical-registry strings are still hardcoded (0 keys migrated to en.json), so GATE_07 protects them in layers:

1. **Source integrity** — every registry string must appear verbatim in its source file; any edit/removal fails the gate until the registry is regenerated with clinical sign-off.
2. **Registry identity** — `proposedKey` is unique per source text; the generator auto-suffixes collisions (`_2`, …) and both generator and gate hard-fail on key/text conflicts. 138 records → 118 unique keys (repeats are the same string on multiple lines).
3. **Locale approval** — once keys land in locale files, a translated value (≠ English source) must match an `approved` entry (reviewer + reviewedAt filled, sourceText fresh) in `docs/localization/clinical-review/<locale>.review.json`. English passthrough is allowed.

**Why:** mistranslation is a patient-safety issue; approvals must never attach to the wrong string, and pre-migration edits must not slip through.

**How to apply:** generate/update manifests one locale at a time with `scripts/i18n-clinical-translate.ts --locale <l>` (`--propose` adds AI candidates via OPENAI_API_KEY). Regenerating preserves decisions; a changed English source resets that key to pending in every locale. The `[clinical-translation]` PR annotation is a human-review governance requirement, not automated. Full guide: `docs/localization/CLINICAL_TRANSLATION_GUIDE.md`.
