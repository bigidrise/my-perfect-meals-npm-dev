---
name: Generated meal serving contract
description: Defines serving semantics and the post-image validation boundary for generated meal options.
---

Generated nutrition begins as one-serving values. Response formatting scales nutrition and ingredient quantities to total-recipe values for the requested serving count. Person-specific validation must convert those totals back to per-serving values with the same serving count before applying per-serving limits.

Generated options are independent candidates. Canonical validation removes invalid candidates and preserves valid ones; the batch fails only when no valid candidate remains.

Image generation and storage may add image metadata or URLs but must not mutate food semantics. Do not rerun an independent food validator after this metadata-only boundary.

**Why:** A legacy post-image validator interpreted scaled multi-serving totals as per-serving nutrition and rejected an otherwise validated batch after its images were complete.

**How to apply:** Reuse the canonical serving-aware final validator anywhere nutrition is evaluated, pass serving count explicitly, log privacy-safe reason codes at validation boundaries, and never introduce a second nutrition-rule implementation after image processing.