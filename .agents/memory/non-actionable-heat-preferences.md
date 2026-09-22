---
name: Non-actionable heat preferences
description: Defines how saved heat sentinels differ from actionable recipe heat authority.
---

Treat saved `unsure` or legacy `unknown` heat answers as unavailable at the Human Food Context authority boundary while preserving the stored profile value. Keep `none` actionable because it explicitly means no heat. Explicit current-request heat remains authoritative.

**Why:** A saved “unsure” answer means the person has no heat preference; treating it as recipe evidence produced the impossible repair instruction to align a dish’s heat to “unsure.”

**How to apply:** Normalize non-actionable heat sentinels before prompt construction so generation, final validation, and bounded repair all receive the same absence of heat authority. Do not mutate profile data or weaken explicit heat requests.