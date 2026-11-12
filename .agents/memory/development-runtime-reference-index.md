---
name: Development runtime references
description: Index for startup evidence, Vite caches, dependencies, provider runtime and migration lifecycle constraints.
---

- [Startup log retention](development-startup-log-retention.md) — preview reloads can displace boot messages; qualify incomplete startup evidence.
- [Vite cache identity](development-vite-cache-identity.md) — warm-browser imports may require module-URL invalidation, not an identical cache rebuild.
- [Production-mode dependencies](production-mode-dev-dependencies.md) — production environment settings can omit declared TypeScript types and create false diagnostic cascades.
- [Process environment types](process-environment-type-contracts.md) — named-key Pick and Partial Pick can reject an index-signature-only environment dictionary.
- [OpenAI server runtime](openai-server-upload-runtime.md) — explicit upload shims and SDK fetch injection; global fetch mocks alone do not prove isolation.
- [Crawler-visible SPA pages](crawler-visible-spa-pages.md) — public HTML snapshots must precede every SPA fallback and remain public after the client mounts.
- [Bounded startup migrations](bounded-startup-migrations.md) — readiness-critical DDL needs PostgreSQL lock and statement timeouts; application timers do not bound blocked queries.
- [Migration CLI lifecycle](migration-cli-lifecycle.md) — one-off commands must own their connection; the application DB keepalive can outlive a closed pool.
