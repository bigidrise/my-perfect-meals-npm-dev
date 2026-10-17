---
name: Non-persisting food diagnostics
description: Why no-save food tests need read-only context resolution, not just a skipped final save.
---

Controlled no-save food diagnostics must use the normal generation and validation pipeline while preventing persistence throughout context resolution as well as at the final save.

**Why:** The user authorized a narrowly bounded Development test with no persistent user-data changes. Nutrition context reads can materialize prescriptions, so merely skipping the meal or preference save does not meet that boundary.

**How to apply:** Keep calculations and protections identical, suppress only derived-cache materialization, enforce a request-isolated read-only database boundary, and keep the diagnostic unavailable in deployed runtimes. Never treat this diagnostic path as a relaxed generator.
