---
name: Beverage safeguard alternative parity
description: Safety rules for offering validated Beverage Creator alternatives after a rejected result.
---

**User-directed pause:** Do not continue Beverage Creator development. Preserve unfinished work separately without deleting or overwriting it, and do not mix it into grocery changes. Do not commit, push, merge, deploy, publish or discard unfinished changes without approval.

**Why:** The user explicitly prioritized unified grocery product-recommendation safeguards, then Spanish localization; Beverage Creator is separate.

**How to apply:** Wait for explicit instructions before starting another queued task. Before an authorized grocery commit or release, inspect the source diff for paused Beverage changes, including shared language files; a backup patch alone does not exclude changes already present in source. Do not mark the unfinished Beverage task complete.

Any Beverage Creator alternative shown after a safeguard rejection must traverse the full original-output validation surface, including named-drink identity and every scanned recipe field such as preparation instructions. Rejection classification must use the same safe-variant-aware alcohol detection across those fields.

**Why:** Partial validation can surface an unrelated named drink or provide alcohol-permissive guidance for a recipe rejected because alcohol appeared only in its instructions.

**How to apply:** Keep the alternative flow explicitly development-only until it is deliberately released. When validator or scanner coverage expands, update alternative validation and rejection classification in lockstep rather than introducing parallel safety logic.