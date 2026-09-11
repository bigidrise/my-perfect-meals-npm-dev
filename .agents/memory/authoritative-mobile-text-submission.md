---
name: Authoritative mobile text submission
description: Submission rule for food-creator fields affected by predictive keyboards and composition events.
---

For food-generation text fields, synchronize native input and composition completion, then capture the mounted field's visible value once when the action starts. Carry that single captured value through recognition, governance, generation, validation, and result metadata.

**Why:** Mobile predictive keyboards and autocorrect can update the visible control before controlled React state catches up. Reading state independently at each stage can process an older partial word or apply safety checks to text different from what generation receives.

**How to apply:** Keep fields controlled and preserve their limits and voice updates. At submission, prefer the mounted control value over state, synchronize state for the UI, and pass the captured value explicitly rather than setting state and immediately reading it.