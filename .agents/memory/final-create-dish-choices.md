---
name: Final Create a Dish choices
description: Why three choices means three fully released, materially distinct recipes.
---

Create a Dish aims for three materially distinct recipes, but only after each has passed the complete applicable person-specific food, clinical, dish-intent, and final formatted-payload checks. Replacements use the same fixed request authority and a bounded generation budget. Never pad with an unverified candidate or relax a user's explicit request or protections to fill a card; return fewer verified choices if needed.

**Why:** Protocol-safe model output can still fail later dish-intent or post-format checks. Counting an earlier stage produced inconsistent one-, two-, and three-card outcomes even when all runs began with three generated candidates.

**How to apply:** Replenish only from the final accepted set, give replacements the same release gates, and keep avoidance/prompt-compliance investigation separate from downstream safety enforcement.