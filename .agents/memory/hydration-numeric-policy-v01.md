---
name: Hydration numeric policy v0.1
description: Durable authorization and activation rules for Hydration numeric output.
---

Hydration numeric v0.1 permits only clinician-defined point, range, floor, or ceiling directives. Planning eligibility alone never authorizes a number, and unavailable governed modifier/context provenance must fail closed to review.

**Why:** The product owner approved clinician-defined numeric v0.1 on 2026-08-27, but explicitly did not approve automatic baselines, weight formulas, context deltas, or production activation. An empty modifier set can look safe while hiding a restriction, so missing governed context cannot be treated as neutral.

**How to apply:** Keep `water_logs` as the only editable intake ledger. Require a current, provenance-complete, nonconflicting clinician directive after eligibility and resolver checks. Preserve point/range/floor/ceiling semantics exactly. Keep UI, routes, evidence, and knowledge development-gated until all production activation approvals are recorded.