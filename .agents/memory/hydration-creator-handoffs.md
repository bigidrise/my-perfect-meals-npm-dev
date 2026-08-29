---
name: Hydration Creator handoffs
description: Trust and safety boundary between Hydration Hub and beverage-generation surfaces.
---

Hydration Hub may issue short-lived, account-bound handoffs to a Creator, but the handoff represents user intent only. The Creator must re-resolve current nutrition, medical, GLP-1, performance, and temporary Liquid Nutrition context before generation and revalidate the result afterward.

**Why:** Query-string descriptions can be stale or modified, while clinical and dietary context may change after the user leaves Hydration Hub.

**How to apply:** Any new Hydration-to-Creator flow must use the signed handoff boundary, reject expired or cross-account tokens, and never treat handoff text as authorization for numeric or clinical guidance.