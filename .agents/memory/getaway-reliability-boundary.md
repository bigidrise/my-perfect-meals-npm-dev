---
name: Getaway location and menu evidence
description: Separate destination identity from menu evidence, with a Development-only release boundary.
---

**Rule:** A genuine venue match does not establish current restaurants, dishes, ingredients, preparation, availability, or nutrition. Preserve useful personalized guidance, but label meal ideas as illustrative whenever actual menu evidence is missing. Unknown or ambiguous locations must remain correctable uncertainty, never unrelated curated defaults. These reliability corrections are approved for Development only; Production activation needs separate explicit approval.

**Why:** The user reported Heathrow being replaced by DFW and plausible resort/restaurant dishes being presented without established menu evidence. They requested correction without a redesign, new services, extra AI calls, or Production changes.

**How to apply:** Keep destination evidence and menu evidence separate across discovery, generated responses, UI labels, and restored suggestions. Do not treat model knowledge or a place-directory match as verified menu information. Preserve dietary and clinical protections; no evidence label grants safety clearance.

**Rule:** Preserve cuisine-based recommendations without a current menu when the member's existing ingredient-evidence requirements permit them. A verified menu is not universally required. Connect an explicitly selected dining venue to existing restaurant intelligence, not the entire destination to a guessed cuisine. Keep advice-only content separate from validated, actionable meal cards.

**Why:** The user explicitly approved Development restaurant/Getaway alignment to reuse existing cuisine intelligence and meal actions, not replace it with a menu-only system or rebuild the platform.

**How to apply:** Reject unvalidated legacy fallback meals, inferred nearby business locations, and guest/missing clinical authority. Preserve current dietary and cuisine profile settings without new override controls. A selected-venue request may reuse the existing recommendation call; do not add chained coaching, destination-wide generation, images, paid services, or extra AI stages without approval. Production activation still requires separate approval.
