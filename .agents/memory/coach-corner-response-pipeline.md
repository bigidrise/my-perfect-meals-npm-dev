---
name: Coach's Corner response pipeline layering
description: Internal Intent/Recommendation/Science/Philosophy separation vs. what the user sees
---

Coach's Corner coaching responses (e.g. `progressSlowedEngine.ts`) are internally
assembled from separate layers: Intent -> Recommendation -> Science -> Philosophy
-> optional MPM destination. `science` and `philosophy` are currently hardcoded
placeholder strings per intent, not backed by real libraries/selection logic yet.

**Why:** the user explicitly rejected exposing these as labeled UI sections
("Science" / "Worth remembering" callouts) — the user should experience one
seamless coach talking naturally, never see the internal architecture. Keep the
fields separate in code/types (so a future real Science/Philosophy Library can
slot in without a response-shape change), but always render them merged into
one flowing message in the UI.

**How to apply:** when adding any new Coach's Corner situation/engine, follow
this same pattern — separate fields internally, single merged natural-language
render in the UI, no user-visible "Science"/"Philosophy" labels.
