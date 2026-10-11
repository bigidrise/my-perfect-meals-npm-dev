---
name: PostgreSQL catalog array decoding
description: Catalog identifier arrays need a supported driver result type during database verification.
---

Cast catalog column names to text before constructing arrays consumed by
node-postgres. PostgreSQL name[] results may arrive as raw PostgreSQL array
strings rather than JavaScript arrays.

**Why:** A post-COMMIT catalog verification helper failed when it called join on
a name[] string. Installation had succeeded; only result decoding failed.
Read-only queries returning text[] completed verification correctly.

**How to apply:** Use ARRAY(SELECT attname::text ...) or an equivalent text[]
cast for catalog key-column lists. Distinguish a helper exception from an actual
SQL/transaction failure. Never rerun committed DDL merely because the client
could not decode subsequent metadata.
