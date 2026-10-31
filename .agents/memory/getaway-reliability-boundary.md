---
name: Getaway location and menu evidence
description: Separate destination identity from menu evidence, with a Development-only release boundary.
---

**Rule:** A genuine venue match does not establish current restaurants, dishes, ingredients, preparation, availability, or nutrition. Preserve useful personalized guidance, but label meal ideas as illustrative whenever actual menu evidence is missing. Unknown or ambiguous locations must remain correctable uncertainty, never unrelated curated defaults. These reliability corrections are approved for Development only; Production activation needs separate explicit approval.

**Why:** The user reported Heathrow being replaced by DFW and plausible resort/restaurant dishes being presented without established menu evidence. They requested correction without a redesign, new services, extra AI calls, or Production changes.

**How to apply:** Keep destination evidence and menu evidence separate across discovery, generated responses, UI labels, and restored suggestions. Do not treat model knowledge or a place-directory match as verified menu information. Preserve dietary and clinical protections; no evidence label grants safety clearance.
