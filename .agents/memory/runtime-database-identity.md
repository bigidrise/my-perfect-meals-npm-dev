---
name: Shared Neon database boundary
description: Development and production use the same external Neon database, not a Replit-managed database.
---

Development and production use the same external Neon database; this project does not use Replit's managed database. Do not suggest proving database isolation between the two or raise it as a blocker or follow-up.

**Why:** The user explicitly confirmed the shared Neon arrangement and asked us to stop revisiting the database question.

**How to apply:** Treat the arrangement as settled project context. Do not initiate database investigation or changes unless a future request explicitly requires them.

For explicitly approved additive, Development-only clinical storage, "Development-only" gates the migration command and application access, not the physical schema: new tables exist on shared Neon while food reads remain unchanged. Do not substitute a requirement for a separate Development database after that approval.

**Why:** Requiring independent branch isolation contradicted the confirmed shared-database arrangement and delayed an approved additive migration.

**How to apply:** State the shared-schema consequence before the write, keep changes additive and runtime-gated, and require separate approval before any food-read cutover or destructive data operation.