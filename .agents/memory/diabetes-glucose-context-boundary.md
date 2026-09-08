---
name: Diabetes glucose context boundary
description: Defines which food surfaces receive diabetes state preferences versus numeric diabetes targets.
---

Every food-facing recommendation surface must receive and enforce the authenticated user's current glucose-state fruit and vegetable allowlist.

Only the Diabetes Meal Builder may consume diabetes-specific glucose thresholds and numeric meal targets. Other builders and recommendation tools receive the state/preference safety context without inheriting diabetes-specific numbers.

**Why:** The user explicitly distinguished platform-wide food preference enforcement from numeric diabetes meal planning; applying diabetes numbers to unrelated builders would change their product behavior.

**How to apply:** Resolve the shared state allowlist for Grocery Coach, creators, rescue, scan, restaurant, and similar food surfaces. Activate numeric diabetes prescription behavior only for the diabetes builder namespace.