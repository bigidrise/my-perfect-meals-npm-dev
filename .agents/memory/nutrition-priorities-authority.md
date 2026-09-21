---
name: Nutrition Priorities authority
description: Durable ownership, semantic, and migration rules for optional food inclusion priorities.
---

Nutrition Priorities belong to the exact authoritative food subject: adult, household profile, or child. They are optional inclusion guidance, never quotas, prescriptions, treatment, required ingredients, or a replacement for nutrition targets. Adult values never flow to children, and one child's values never flow to another child.

**Why:** The approved foundation must preserve subject isolation and existing safety authority while allowing selected culinary preferences to invalidate Human Food Context identity. A separate selections table was rejected in favor of versioned JSONB on authoritative subject rows.

**How to apply:** Resolve and fingerprint the validated subject document in Human Food Context, keep prompt projection bounded and subordinate to safety/diet/protocol/nutrition rules, and do not reuse the Performance DemandProfile field. Development may run the additive migration before readiness; Production DDL runs only through the explicit release-migration gate, while ordinary Production startup fails closed on missing columns.