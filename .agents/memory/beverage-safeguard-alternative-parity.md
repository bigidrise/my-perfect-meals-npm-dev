---
name: Beverage safeguard alternative parity
description: Safety rules for offering validated Beverage Creator alternatives after a rejected result.
---

Any Beverage Creator alternative shown after a safeguard rejection must traverse the full original-output validation surface, including named-drink identity and every scanned recipe field such as preparation instructions. Rejection classification must use the same safe-variant-aware alcohol detection across those fields.

**Why:** Partial validation can surface an unrelated named drink or provide alcohol-permissive guidance for a recipe rejected because alcohol appeared only in its instructions.

**How to apply:** Keep the alternative flow explicitly development-only until it is deliberately released. When validator or scanner coverage expands, update alternative validation and rejection classification in lockstep rather than introducing parallel safety logic.