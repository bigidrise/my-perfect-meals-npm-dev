# Production workspace diagnostic startup

## Scope and inventory (before implementation)

The Production entrypoint, its main route registrar, and their local import
graph were inspected without importing the application or opening a database
connection. The graph scan included static and string-literal dynamic local
imports, module-scope calls, singleton constructors, and worker/timer launch sites.

| Automatic side effect | Existing location | Diagnostic handling |
| --- | --- | --- |
| Release schema migrations, clinical/LMS/organization/Stripe compatibility work, ownership reconciliation, readiness repairs | `server/prod.ts`, `runReleaseMigrations` | Maintenance policy takes precedence over the release flag. |
| Grandfather/certification backfills and eligible-provider Studio backfill | `runGrandfatherMigrations`, queued after schema migration | Suppressed with release migrations. |
| Daily reminder cron and reminder scheduler | Production background-services timer | No timer or worker starts. |
| Studio video purge, migration/retry timer, and destructive media cleanup | Production purge initialization | No initialization or retries. |
| Studio voice processing | Module-scope launch in `routes/proTabletRoutes.ts` | Existing shared maintenance guard now recognizes diagnostic mode. |
| Warmup self-pings | Production warmup timer | Suppressed. |
| Deferred release maintenance: ProCare invite tokens; business/partner/marketing tables; relationship deduplication; client notes and read-marker schema; media asset/image validation; bug report/support tables; coaching knowledge, nutrition memory, coaching engine/phases, groceries, safety-correlation and critical-column work; meal snapshot migration | Production `RUN_DEFERRED_RELEASE_MAINTENANCE` block and its nested timers/retries | Entire post-initialization maintenance region is skipped, regardless of inherited release flags. |
| Pending meal-image recovery | Production recovery timer | Suppressed. |
| Support acknowledgement outbox worker | Production acknowledgement timer | Suppressed. |
| Coach follow-up cron | Production follow-up timer | Suppressed. |
| Expired PostgreSQL session deletion | `connect-pg-simple` store pruning interval | Pruning disabled only in diagnostic mode; durable request-driven sessions retained, table auto-creation remains disabled. |
| Database keepalive interval (`SELECT 1` only) | `server/db.ts` module scope | No automatic timer in suppressed startup. |
| BullMQ notification queue/worker constructors | `server/queue/notifyQueue.ts` | Already inactive because Redis is explicitly null; additionally maintenance-gated. |
| Legacy reminder, concierge, learning, cache, coaching and hydration singleton construction | Imported modules | Constructors do not start persistent jobs or database writes; legacy reminder loading is not invoked by Production registration. |
| PIN expiry and query-cache eviction timers | Security/cache services | Retained: in-memory only, no persistent writes or delivery jobs; do not weaken security cleanup. |
| PostgreSQL pool creation, schema/security readiness assertions, route registration, HTTP listener, telemetry setup | Production boot | Retained. Missing required schema fails closed; diagnostic startup never repairs it. |

The main `registerRoutes` path registers handlers; its request-handler timers and
writes are not automatic startup work. Security middleware and interactive
handlers must not be gated by maintenance policy.

## Runtime boundary

- Explicit switch: `PRODUCTION_PREVIEW_SAFE_START=true`.
- Dedicated pre-import launcher: `server/prodPreviewBootstrap.ts`.
- Requires `NODE_ENV=production`, a hostname ending in `.replit.dev` supplied
  through `REPLIT_DEV_DOMAIN`, and no nonempty `REPLIT_DEPLOYMENT`.
- The normal published entrypoint always keeps maintenance enabled. A published
  runtime ignores this diagnostic switch; the dedicated diagnostic launcher
  refuses to import the app there.
- The existing Development-only bootstrap remains Development-only.
- Port availability is checked before importing any application module.

## Proposed command (not executed)

```bash
NODE_ENV=production PRODUCTION_PREVIEW_SAFE_START=true npx --no-install tsx server/prodPreviewBootstrap.ts
```

Keep the existing configured `PORT`; do not run alongside an existing process on
that port. Stop/restart requires separate approval. Do not change the published
run command or republish the public website for a workspace-preview test.

## Verification boundary

Tests use injected port probes, isolated module state, fake side effects, and
source/AST coverage of real launch sites. They do not boot the application,
perform migrations, or connect to the shared database. Real process readiness,
browser cookie acceptance, MFA, and workspace access require a separately
approved controlled preview restart and authenticated browser verification.
