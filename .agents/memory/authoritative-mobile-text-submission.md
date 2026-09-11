---
name: Authoritative mobile text submission
description: Visible-value authority and explicit classification boundaries for mobile food-creator inputs.
---

For food-generation text fields affected by predictive keyboards, the mounted control's visible value is authoritative. When classification controls later UI, prefer an explicit user action that captures the finished value over recognition that runs while the user is still typing.

**Why:** Mobile predictive keyboards and autocorrect can update the visible control without the expected mirrored React state transition. Event-driven live recognition can remain stuck on a partial word even when final submission receives the full value.

**How to apply:** Preserve limits and programmatic updates. On Continue or submission, capture the visible value once, associate classification with that source, reject mismatched responses, and carry the captured value through later stages. Do not add polling or keyboard-specific delays.