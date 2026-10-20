# Smart Grocery List — guarded Development restart and runtime verification

## Outcome

The existing guarded Development workflow was restarted once. The metadata-aware
server handler is loaded and passed non-mutating HTTP checks. No application-source,
workflow, environment, or Production changes were needed for this verification.

The ingredient-metadata migration was **not** rerun. No synthetic accounts or
shopping-list records were created in shared Neon. No customer records were
read or written by the shopping-list verification requests.

## Restart-safety findings

The inspected startup path is:

```text
Start application workflow
  DEVELOPMENT_SAFE_RESTART=true SKIP_DEVELOPMENT_ACCOUNT_MAINTENANCE=true npm run dev
    package.json: NODE_ENV=development tsx server/devBootstrap.ts
      initializeDevelopmentStartupMaintenance()
      assertDevelopmentPortAvailable()
      dynamic import("./index")
```

The existing bootstrap initializes its safe-mode policy before application imports.
It refuses a Production/deployed runtime and ambiguous safe-mode settings. Its port
preflight also prevents a second application instance from importing startup code
when the port is occupied.

Inspected automatic launch paths:

| Path | Safe Development behavior |
|---|---|
| `server/index.ts` delayed migration/maintenance blocks | Enclosed by `startupMaintenanceEnabled()` guards |
| Awaited boot migrations | `withBootRetry()` returns before invoking/importing the migration callback |
| Organization seeding, bounded attachment migration, saved-product identity migration, food/menu/clinic migrations | Explicit startup-maintenance guards |
| SMS, reminders, data retention, Studio purge/recovery, support acknowledgement and coaching jobs | Automatic launch sites suppressed by existing guards |
| `server/routes/proTabletRoutes.ts` voice worker | Import-time worker launch is guarded |
| `server/queue/notifyQueue.ts` | Queue/worker initialization is guarded; Redis notifications are also currently disabled |
| `server/db.ts` | Pool construction remains; automatic keepalive is suppressed |
| Warmup | Continues; only calls the local health endpoint |
| Safety-PIN and query-cache expiry timers | In-memory cleanup, not shared-database maintenance |
| Development sessions | Express in-memory store; no database session-table creation/pruning on this path |
| Readiness checks | Existing schema/column assertions and health checks remain read-only; no fallback schema repair was enabled |

Static import/launch-site review was supplemented by the existing startup-policy
tests. No schema synchronization or `db:push` command was invoked.

### Captured boot evidence

The first log capture recorded:

```text
[development-startup] SAFE: automatic database maintenance suppressed; mode initialized before application imports.
```

A subsequent workflow status capture recorded:

```text
[development-safe-restart] Skipped startup maintenance: Critical column pre-flight migrations
[guard] 17 critical column(s) confirmed present
Server running on 0.0.0.0:5000 (startup: 2281ms)
```

The workflow is running on port 5000. Browser asset reloads displaced part of the
intermediate boot output, so this is not an assertion that a complete startup log
was retained. Safety evidence consists of the reviewed guarded launch paths, passing
policy tests, and the captured positive safe-mode/skip messages—not merely absence
of migration messages in the remaining log.

## Runtime checks

Requests targeted only the Development preview origin. No authenticated user, bearer
credential, synthetic shared-database account, or Production API was used.

| Check | Result |
|---|---|
| `GET /api/_ping` | 200; new process responsive |
| Synthetic `POST /api/shopping-list-v2/preview` | 200; metadata version 1 returned, confirming the new handler is loaded |
| Original qualifiers | Low-sodium soy sauce, reduced-sugar jam, gluten-free bread and vegan cream cheese retained |
| Compatible recipe contributions | Two `1/2 tbsp` low-sodium-sauce contributions retained while the preview quantity consolidated to 1 |
| Incompatible identity separation | Plain sauce remained separate; generic gluten-free bread and two exact product variants remained three rows |
| Structured products | Product key, brand, variant, UPC, package/serving details, sourced nutrition evidence, unresolved review status and evaluation context retained |
| Recipe versus retail quantities | Original recipe quantity of 2 slices remained separate from retail quantity of 1 |
| JSON transport/restoration | Replayed preview response retained metadata and contribution arrays exactly |
| Input without metadata | Broccoli input remained accepted with its name and quantity |
| Anonymous classic/V2 list reads | Both returned expected 401 responses, without exposing lists |

These comprise **8 passing non-mutating live checks**. The two successful preview
responses are confirmed in Development workflow logs.

JSON preview replay is **not** database hydration. The live requests did not exercise
authenticated save, PATCH or refresh against shared Neon.

## Isolated persistence verification

**48 tests passed in this verification stage:**

- 17 tests across `developmentStripeSafeStartup.test.ts` and
  `developmentStartupPresentation.test.ts`.
- 31 tests across `shoppingMetadataFoundation.test.ts`,
  `shoppingMetadataStore.test.ts` and `savedGroceries.route.test.ts`.

The persistence suites use mocked database/request implementations and synthetic
fixtures. They cover save/update/hydration/refresh, original contributions, exact
product identity, qualifier-aware consolidation, legacy stored rows, account
isolation, late responses, duplicate routes, Saved Grocery restoration, and refusal
to send metadata to an older API.

Those results establish fixture-level persistence behavior, not a live authenticated
Neon round trip. Expected error logging from the atomic-failure fixture is not a
test failure.

## Data-safety result and limitations

- The verification issued no shared-database DML, backfill or schema changes.
  Startup still performed its permitted read-only readiness checks.
- No shared-database fixtures were created; consequently there was no cleanup
  operation and no possibility of an overbroad fixture-deletion query.
- No customer shopping lists were read, annotated or updated by these checks.
- No Production API request was used to test the new metadata contract. Refusal of
  an older API response was verified in isolated client tests.
- This is not a global database audit: it does not claim that other independently
  running clients or Production made no concurrent changes.
- Real authenticated Neon save/update/refresh remains unverified. A future live-write
  check would first need a separately established isolated identity and reliable,
  narrowly scoped cleanup plan.
- Production's existing `replace_scope` metadata-loss limitation remains unchanged.
- A public login screenshot rendered successfully after restart. Expected anonymous
  401s and transient preview WebSocket reconnect errors appeared in browser logs;
  live HTTP checks passed. No unrelated browser behavior was changed.
- Existing full-project TypeScript diagnostics were neither repaired nor rerun;
  application source did not change in this stage.

## Changes and stop boundary

Only documentation/project-memory changes were made:

- Added this runtime verification report.
- Updated `docs/smart-grocery-list-foundation-development.md` to replace its pending
  restart status with the completed guarded-restart result.
- Recorded the user's conditional restart and non-mutating verification boundary in
  `.agents/memory/smart-grocery-persistence-boundary.md`.

No workflow configuration, environment settings, application code or Production
deployment was modified. No GitHub push or publication was performed. Grocery Coach
recommendations, clinical ranking and product-selection UI were not activated.

Stopped after the authorized verification stage. Further work requires approval.
