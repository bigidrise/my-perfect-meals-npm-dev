---
name: Clinical cutover verification
description: How to verify shadow clinical reconciliation and authenticated safety context before any food-read cutover.
---

Treat the real additive schema constraints and every nested required clinical resolver as part of the cutover contract; a passing mocked service test or fail-closed top-level loader is insufficient.

**Why:** A review path initially passed mocked tests but conflicted with a pre-existing unique source constraint. Separately, nested household, diabetes, intervention, and medication-tolerance reads could fail while the outer envelope still appeared successful. A safe top-level error handler cannot catch an error that a nested resolver has already converted into missing evidence.

**How to apply:** Before any cutover, compare review transactions against the actual schema and confirm each required subread distinguishes an absent record from a failed query. Exercise legacy reviews against schema-accurate constraints and verify that authority cannot become incomplete while generation continues. Keep the new shadow authority separate from existing food reads until this and subject-specific clinical review are complete.