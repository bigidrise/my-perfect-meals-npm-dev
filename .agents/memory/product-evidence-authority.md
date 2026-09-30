---
name: Product evidence authority
description: Authority boundary for internal packaged-product discovery before customer-facing integration.
---

**Rule:** Treat subject resolution, reviewed product-rule policy, and exact source evidence as separate gates. A condition name, support toggle, legacy provider prompt, or evidence template cannot itself create an executable clinical packaged-product restriction. Unknown product-source freshness and rule-specific thresholds remain unresolved rather than receiving convenience defaults.

**Why:** MPM's established food rules are spread across the envelope, daily planning, Human Food, and shadow clinical authority. A correct evidence reducer can still produce incorrect safety claims if its caller invents who the subject is or what threshold applies. Development and Production share clinical data, so isolated tests must not be mistaken for live policy approval.

**How to apply:** Keep product discovery disconnected from live customer recommendations until exact subject/household authority and reviewed rule-specific evidence are reconciled. Product records must preserve original statements, serving basis, market/variant, source, observation and retrieval dates; AI suggestions and the legacy barcode `verified` boolean do not count as proof. Search past rejected or unverifiable candidates within a bounded budget, and never call an unresolved case eligible.