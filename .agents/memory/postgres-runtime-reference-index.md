---
name: PostgreSQL runtime references
description: Index of SQL parameter, array decoding, and pooled transaction lessons.
---

- [Drizzle array columns](ace-drizzle-array-rule.md) — SQL templates expand arrays; use explicit per-value conditions for membership queries.
- [PostgreSQL parameter gaps](postgres-parameter-gaps.md) — mocked writes can pass while live updates fail if SQL leaves unused leading placeholders.
- [Neon pooler read-only queries](neon-pooler-read-only-queries.md) — pooled connection rejects read-only startup options; use an explicit read-only transaction.
- [PostgreSQL catalog array decoding](postgres-catalog-array-decoding.md) — cast catalog identifier arrays to text[] for node-postgres; name[] may arrive as raw strings.
