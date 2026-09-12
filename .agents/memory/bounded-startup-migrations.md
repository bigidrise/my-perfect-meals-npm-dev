---
name: Bounded startup migrations
description: Safety boundary for readiness-critical Production DDL that can block on PostgreSQL locks.
---

Readiness-critical startup migrations must execute on a scoped database connection with finite PostgreSQL `lock_timeout` and `statement_timeout`. An application `Promise.race` warning is observability only and must never be treated as query cancellation.

**Why:** JavaScript timers do not cancel PostgreSQL work. Awaiting the original promise after a warning prevents duplicate DDL but can still leave deployment readiness blocked indefinitely on a database lock.

**How to apply:** Run each required startup sequence once through the bounded connection wrapper, keep its DDL idempotent, propagate timeout and migration failures so readiness stays false, and reset connection-local settings before returning the connection to the pool. Do not change normal application query timeouts globally.