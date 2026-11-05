---
name: PostgreSQL query contracts
description: Pointers to non-obvious parameter, array and pooled-read behavior.
---

- [Drizzle arrays](ace-drizzle-array-rule.md) — per-value conditions rather than accidental SQL-template expansion.
- [Parameter gaps](postgres-parameter-gaps.md) — mocked writes may miss unused leading PostgreSQL parameters.
- [Pooled read-only queries](neon-pooler-read-only-queries.md) — explicit read-only transactions rather than startup options.
- [Catalog array decoding](postgres-catalog-array-decoding.md) — identifier arrays may require text-array casts.
