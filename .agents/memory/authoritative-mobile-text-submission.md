---
name: Authoritative mobile text submission
description: Visible-value authority for food-creator submission and live recognition on mobile keyboards.
---

For food-generation text fields, the mounted control's visible value is authoritative for both live recognition and final submission. Associate each recognition request and result with its exact source text, and never let a result control UI when its source differs from the current visible value.

**Why:** Mobile predictive keyboards and autocorrect can update the visible control without the expected mirrored React state transition. Submission may receive the full DOM value while a state-driven recognition panel remains stuck on a partial word.

**How to apply:** Preserve limits and programmatic updates, observe the actual control value through the smallest bounded DOM-aware bridge, and coordinate debounce, request identity, response acceptance, and rendering around normalized source text. At submission, capture once and carry that value through every stage.