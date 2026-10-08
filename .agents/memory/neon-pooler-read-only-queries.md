---
name: Neon pooler read-only queries
description: The project's pooled Neon connection rejects a PostgreSQL startup option for read-only sessions.
---

The pooled connection rejects `PGOPTIONS` containing `default_transaction_read_only` with an unsupported startup-parameter error.

**Why:** This is a pooler restriction, not a failed SQL query or database permission problem. Repeating the same startup option will not make a diagnostic query safer or succeed.

**How to apply:** For authorized read-only diagnostics through `psql`, issue `BEGIN TRANSACTION READ ONLY` before aggregate `SELECT` statements and `COMMIT` afterward in one connection. Do not print the connection string, expose customer identifiers, or treat the pooler error as evidence about application data.

The startup-option restriction does not prohibit ordinary SQL `SET default_transaction_read_only = on`; the pooled connection accepted it, and `SHOW default_transaction_read_only` returned `on` during controlled runtime validation.

**Why:** An application validation process needs protection on every pooled connection, not only on a standalone diagnostic transaction.

**How to apply:** Keep explicit read-only transactions for standalone audits. For a controlled validation runtime, verify connection-level read-only state and independently block mutation SQL before transmission; pause background work with external side effects as well. Migration-disable flags alone are not a no-mutation boundary.