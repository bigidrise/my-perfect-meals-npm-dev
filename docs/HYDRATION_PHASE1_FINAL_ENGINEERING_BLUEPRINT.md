# Hydration Phase 1 — Final Engineering Blueprint

**Status:** Checkpoint Zero passed. The blueprint is approved in principle for a feature-disabled foundation, but it authorizes no code, schema, route, migration, UI, runtime, or production-behavior change until Task #1472 is explicitly started.

**Product decision already recorded:** Phase 1 is a feature-disabled, nonclinical Hydration Intelligence foundation. It is not an upgrade of the existing Biometrics water tracker.

**Implementation boundary:** Task #1472 remains blocked until this blueprint is explicitly approved and attached to the task. Any later approval authorizes only the checkpoints in this document; it does not activate a hydration target, electrolyte/sodium recommendation, condition rule, professional directive, consumer cutover, or user-facing hydration claim.

## 1. Verified starting point

The audited codebase has one current water ledger, `water_logs`, defined in `shared/schema.ts` and created in `migrations/0000_deep_madrox.sql`:

| Column | Current shape |
| --- | --- |
| `id` | UUID primary key |
| `user_id` | required `users.id` reference |
| `amount_ml` | required integer |
| `unit` | required text, default `ml` |
| `intake_time` | required timestamp without timezone |
| `created_at` | required timestamp, default now |

It has user/time indexes but no idempotency key, correction lineage, event provenance, contribution/electrolyte semantics, timezone/local-date metadata, plan revision, or daily state.

`server/routes/waterLogs.ts` already enforces the important ownership rule: ordinary callers derive their owner from `req.authUser.id`; a body `userId` is ignored; delegated `clientId` access uses `verifyPhysicianClientAccess` and fails closed. This behavior remains in place and unchanged through Phase 1.

The current Biometrics `WaterLog` component uses a browser-local weight × 0.67 goal and an account-keyed daily counter, then posts deltas to `water_logs`. This is not authoritative, has no durable reconciliation when a post fails, and must not be treated as the Hydration Domain model. It is not modified in Phase 1.

## 2. Phase 1 invariants

1. PostgreSQL is authoritative for new hydration-domain data; browser state is not historical truth.
2. The legacy `water_logs` table, routes, and current Biometrics experience remain operational and unchanged.
3. Intake events and plan revisions are append-only. Corrections, voids, and supersession are new lineage records, not silent updates.
4. Raw volume, hydration contribution, and electrolyte accounting are separate. Unknown is stored and projected as unknown, never zero.
5. In Phase 1, every resolver output is `monitor_only`, `needs_review`, or `blocked`. It returns no numeric target, range, floor, ceiling, remaining amount, action brief, or “goal met” status.
6. The server derives a self-service subject from authentication. A caller cannot select another account with a body or query value.
7. No condition-specific adapter is active. GLP-1, pregnancy, performance, POTS/dysautonomia, clinician, restriction, beverage, electrolyte, and professional inputs are representable only as inactive future connection points.
8. Every route and worker is fail-closed behind a server-side foundation flag. A missing, malformed, or false flag permits neither reads nor writes to new hydration APIs.

## 3. Exact proposed database tables, relationships, and Phase 1 persistence design

All new timestamp instants use `timestamptz`. Each user-local hydration day is stored as a PostgreSQL `date` plus the IANA timezone used to derive it. This avoids reinterpreting the legacy timezone-less `water_logs.intake_time` field.

### 3.1 `hydration_policy_versions`

Registry only; it records the resolver algorithm and future policy manifests without activating a clinical policy.

| Column | Type / rule |
| --- | --- |
| `id` | UUID primary key |
| `policy_key` | text, required |
| `version` | text, required |
| `kind` | text check: `foundation_algorithm`, `future_policy_manifest` |
| `status` | text check: `draft`, `withheld`, `retired`; Phase 1 has no `active` status |
| `content_hash` | text, required SHA-256 |
| `manifest` | JSONB, required, must contain no numeric hydration recommendation in Phase 1 |
| `effective_at`, `created_at` | timestamptz, required |
| `retired_at` | timestamptz, nullable |
| `created_by_user_id` | nullable `users.id` reference |

Constraints and indexes:

- unique (`policy_key`, `version`);
- index (`status`, `effective_at desc`);
- one seeded `foundation_algorithm` record is permitted only if its manifest declares `outputMode: "monitor_only"` and no target fields. The resolver rejects any other record.

### 3.2 Inactive future input tables

These tables preserve future extension points but no Phase 1 write endpoint creates active records. Every table uses `id UUID primary key`, `subject_user_id varchar not null references users(id) on delete no action`, `created_at timestamptz not null default now()`, `created_by_user_id varchar nullable references users(id)`, `effective_at timestamptz not null`, `expires_at timestamptz nullable`, `rationale_code text not null`, `source_reference text nullable`, and `status text not null`.

The migration constrains status to non-activating values only: `draft`, `withheld`, `expired`, `superseded`. A later, separately approved migration would be required before any active input can exist.

| Table | Additional exact fields | Required indexes |
| --- | --- | --- |
| `hydration_baselines` | `revision integer not null`, `mode text`, `target_ml`, `minimum_ml`, `maximum_ml` nullable integers, `timezone text`, `formula_id`, `formula_version`, `explanation_key`; all amount fields must be null in Phase 1 | unique (`subject_user_id`, `revision`); (`subject_user_id`, `effective_at desc`) |
| `hydration_modifiers` | `modifier_type text`, `timing_scope text`, `delta_ml`, `minimum_delta_ml`, `maximum_delta_ml`, `target_floor_ml`, `target_ceiling_ml` nullable integers, `condition_key`, `conflict_group`, `policy_version_id UUID references hydration_policy_versions(id)`, `evidence_reference`, `explanation_key`; all amount fields must be null in Phase 1 | (`subject_user_id`, `effective_at desc`); (`policy_version_id`) |
| `hydration_restrictions` | `restriction_kind text`, `metric text`, `scope text`, `minimum_value`, `maximum_value` nullable numeric values, `unit text`, `hard_stop boolean`, `severity text`, `policy_version_id UUID`, `explanation_key`; all numeric values must be null and `hard_stop` false in Phase 1 | (`subject_user_id`, `effective_at desc`); (`policy_version_id`) |
| `hydration_clinician_directives` | `organization_id`, `author_user_id`, `directive_kind`, `target_kind`, `target_ml`, `minimum_ml`, `maximum_ml` nullable integers, `review_at`, `reason_code`, `consent_reference`, `policy_version_id UUID`; all target values null and no authoring route in Phase 1 | (`subject_user_id`, `effective_at desc`); (`organization_id`, `subject_user_id`) |

The schema does not make a professional authorized. The future clinician table is only a typed, deny-by-default representation. Existing relationship, organization, consent, and role checks are still required before any future query or mutation can expose it.

### 3.3 `hydration_intake_events`

This is the canonical immutable factual intake ledger. It is the only future source for hydration event history; it does not replace `water_logs` during Phase 1.

| Column | Type / rule |
| --- | --- |
| `id` | UUID primary key |
| `subject_user_id` | required `users.id` reference |
| `occurred_at` | required timestamptz |
| `occurred_timezone` | required IANA timezone text, validated in application code |
| `local_date` | required date, server-derived from `occurred_at` and `occurred_timezone` |
| `volume_ml` | required positive integer; canonical factual volume |
| `original_amount` | required numeric(12,3), positive |
| `original_unit` | required text check: `ml`, `l`, `oz`, `fl_oz`, `cup` |
| `beverage_class` | required text check: `water`, `oral_rehydration`, `electrolyte_drink`, `coffee`, `tea`, `juice`, `milk`, `alcohol`, `other`, `unknown` |
| `source` | required text check: `manual`, `import`, `beverage_recipe`, `wearable`, `clinician_entry`, `legacy_manual` |
| `source_event_id` | nullable text; legacy source ID or external source reference |
| `idempotency_key` | required UUID |
| `payload_hash` | required text; detects incompatible reuse of an idempotency key |
| `entered_at` | required timestamptz, default now |
| `entered_by_user_id` | required `users.id` reference |
| `client_instance_id` | nullable UUID |
| `observed_plan_revision_id` | nullable UUID reference to `hydration_plan_revisions` |
| `note` | nullable text, max length enforced in request schema |
| `declared_nutrients` | nullable JSONB with only explicitly declared nutrients and `{source, confidence}` metadata |

Constraints and indexes:

- unique (`subject_user_id`, `idempotency_key`);
- unique partial (`source`, `source_event_id`) where `source_event_id is not null`; legacy backfill uses this to remain repeatable;
- check `volume_ml > 0`, `original_amount > 0`;
- index (`subject_user_id`, `local_date`, `occurred_at desc`, `id desc`);
- index (`subject_user_id`, `occurred_at desc`, `id desc`);
- index (`observed_plan_revision_id`);
- no `status`, `updated_at`, or mutable correction field lives on the row.

### 3.4 `hydration_event_supersessions` and `hydration_audit_log`

`hydration_event_supersessions` makes correction and void history explicit without changing an intake row.

| Column | Rule |
| --- | --- |
| `id` | UUID primary key |
| `subject_user_id` | required owner reference |
| `prior_event_id` | required unique reference to `hydration_intake_events` |
| `successor_event_id` | nullable reference to `hydration_intake_events`; null means void |
| `kind` | `correction` or `void` |
| `reason_code` | required text |
| `created_at`, `created_by_user_id`, `correlation_id` | required audit context |

The service validates that both events belong to the same subject, a successor occurs only once for a prior event, and a correction cannot form a cycle. Effective-event queries walk the lineage and include only current terminal events.

`hydration_audit_log` is append-only and records event acceptance/rejection/deduplication, correction/void, backfill, plan-resolution, state projection, privileged access attempt, and denied access:

`id`, `occurred_at`, `actor_user_id`, `subject_user_id`, `action`, `resource_type`, `resource_id`, `outcome`, `correlation_id`, `policy_version_id`, `plan_revision_id`, `metadata_redacted JSONB`.

Indexes: (`subject_user_id`, `occurred_at desc`), (`actor_user_id`, `occurred_at desc`), (`resource_type`, `resource_id`), and (`correlation_id`). Generic logs must store codes, IDs, and hashes only; they must not store notes, symptoms, full event payloads, or explanation prose.

### 3.5 `hydration_plan_revisions`, supersession, and input provenance

`hydration_plan_revisions` stores an immutable answer to “what plan-status applied to this person at this point on this local day?” It does not store an active plan in Phase 1.

| Column | Type / rule |
| --- | --- |
| `id` | UUID primary key |
| `subject_user_id` | required owner reference |
| `local_date`, `timezone` | required date and IANA timezone |
| `revision` | required positive integer |
| `status` | required check: `monitor_only`, `needs_review`, `blocked` |
| `target_kind` | required `monitor_only` in Phase 1 |
| `target_ml`, `minimum_ml`, `maximum_ml`, `remaining_ml` | all nullable and constrained to null in Phase 1 |
| `calculation_policy_version_id` | required policy-version reference |
| `input_snapshot_hash` | required hash |
| `policy_version_manifest` | required JSONB |
| `missing_data_codes`, `rationale_codes` | required text arrays |
| `explanation_keys` | required text array; no generated clinical text |
| `effective_at`, `created_at` | required timestamptz |

Constraints and indexes:

- unique (`subject_user_id`, `local_date`, `revision`);
- index (`subject_user_id`, `local_date`, `effective_at desc`);
- check `target_kind = 'monitor_only'`;
- check every numeric target column is null.

`hydration_plan_supersessions` is separate so revision rows never change: `id`, `prior_plan_revision_id unique`, `successor_plan_revision_id unique`, `subject_user_id`, `created_at`, `created_by_user_id`, `reason_code`, `correlation_id`. Both referenced revisions must belong to the same subject and local date.

`hydration_plan_revision_input_refs` records exactly which inactive inputs were considered: `plan_revision_id`, `input_kind`, `input_id`, `input_revision`, `input_hash`, `disposition` (`used`, `withheld`, `missing`, `conflicted`), and `reason_code`. It has a composite primary key (`plan_revision_id`, `input_kind`, `input_id`) and an index by (`input_kind`, `input_id`). The service validates polymorphic references before insert.

### 3.6 Derived contribution, electrolyte, and state records

`hydration_event_contributions` holds a plan-versioned derivation rather than overwriting factual volume:

`id`, `event_id`, `plan_revision_id`, `contribution_ml nullable`, `method` (`unknown`, `direct_water`, `declared_beverage`, `recipe_derived`, `estimated`), `confidence` (`not_available`, `low`, `medium`, `high`), `assumption_codes text[]`, `excluded_reason`, `algorithm_version`, `created_at`.

Phase 1 permits only `method='unknown'`, `contribution_ml is null`, and `confidence='not_available'`. A later approved method requires a policy/version migration and tests.

`hydration_electrolyte_ledgers` holds one plan-revision-derived coverage record:

`id`, `subject_user_id`, `local_date`, `timezone`, `plan_revision_id unique`, `coverage` (`not_tracked`, `water_only`, `partial`, `complete`), nullable `sodium_mg`, `potassium_mg`, `magnesium_mg`, `source_count`, `warning_codes text[]`, `policy_version_id nullable`, `computed_at`.

Phase 1 accepts only `not_tracked` or `water_only`, with all nutrient totals null.

`hydration_daily_states` is an append-only, recomputable read model:

`id`, `subject_user_id`, `local_date`, `timezone`, `state_version`, `effective_plan_revision_id`, `input_watermark`, `active_event_count`, `total_declared_volume_ml`, `known_contribution_ml nullable`, `unknown_contribution_event_count`, `last_event_at`, `electrolyte_ledger_id`, `plan_status`, `progress_status`, `computed_at`, `calculation_policy_version_id`, `projection_hash`.

Constraints:

- unique (`subject_user_id`, `local_date`, `state_version`);
- `progress_status='unknown'` in Phase 1;
- `known_contribution_ml is null`;
- no `remaining_ml` column;
- index (`subject_user_id`, `local_date`, `state_version desc`).

The current state is `max(state_version)` for a subject/date. It can always be recomputed from immutable inputs, plan revisions, and effective terminal events.

### 3.7 Legacy mapping and migration ledger

`hydration_legacy_event_mappings` is the non-destructive backfill map:

`legacy_water_log_id UUID primary key references water_logs(id) on delete no action`, `hydration_event_id UUID unique references hydration_intake_events(id)`, `source_row_hash text`, `backfill_version text`, `mapped_at timestamptz`, `backfill_run_id UUID`.

`hydration_backfill_runs` records each controlled batch: `id`, `backfill_version unique`, `status` (`started`, `completed`, `failed`, `rolled_back`), `started_at`, `completed_at`, `source_count`, `mapped_count`, `mismatch_count`, `source_checksum`, `canonical_checksum`, `watermark`, `error_code`.

No legacy row is deleted, updated, renamed, or treated as a historical clinical plan. A legacy water row maps only to `source='legacy_manual'`, `beverage_class='water'`, original amount/unit, existing amount in mL, existing timestamp, and an explicitly recorded legacy-timezone interpretation.

## 4. Migration and schema-readiness strategy

The current project has generated migrations plus independent delayed boot migration blocks. For Hydration Phase 1, use neither `db:push` nor a new delayed fire-and-forget migration.

1. Add a reviewed, idempotent SQL migration, `migrations/0010_hydration_foundation.sql`, containing only additive `CREATE TABLE IF NOT EXISTS`, additive indexes, and safe checks.
2. Add `server/db/migrations/runHydrationFoundationMigration.ts`. It takes a PostgreSQL advisory transaction lock, writes a completion record, runs the migration in one transaction, validates the expected tables/indexes/checks, and returns only after readiness is known.
3. Invoke that same runner in both `server/index.ts` and `server/prod.ts` before hydration routes are registered or the server reports hydration readiness. Do not put it in a `setTimeout`.
4. The normal application can still start if the foundation flag is false and the migration is intentionally absent only in development fixtures; any enabled hydration foundation route must return `503 HYDRATION_SCHEMA_NOT_READY` until preflight succeeds.
5. Do not refactor all project migrations as part of #1472. The narrow requirement is to make this new foundation atomic, versioned, and identically executed in development and production.

## 5. Services and responsibility boundaries

| Service | Responsibilities | Must not do |
| --- | --- | --- |
| `HydrationEventService` | authenticated owner resolution, strict unit/date/timezone validation, conversion to mL, idempotency, append-only event creation, correction/void lineage, audit records | calculate a target or accept `userId` as authority |
| `HydrationInputService` | load inactive baselines/modifiers/restrictions/directives and policy manifests, validate effective intervals and status | choose clinical precedence or activate an input |
| `HydrationPlanResolver` | normalize inputs, verify no activatable input exists, create a `monitor_only`/`needs_review`/`blocked` immutable revision with provenance | return a numeric plan or silently average conflict claims |
| `HydrationStateProjector` | select terminal events, produce contribution/electrolyte coverage projections and append a state version | use browser totals, infer beverage/food contribution, or write recommendations |
| `HydrationProjectionService` | shape least-privilege self, future coach/generator, and future professional projections | expose raw history or inactive directive data to unauthorized audiences |
| `HydrationBackfillService` | map legacy rows repeatably, verify counts/checksums, emit audit/backfill records | read browser local storage or change legacy records |
| `HydrationFeatureGate` | server-only flag parsing, schema readiness, hard invariant that activated output is impossible | rely on a Vite/client flag or default to enabled |

The GLP-1 tolerance resolver, coaching hydration observer, performance/pregnancy context, Protocol Envelope, Beverage Creator, and ProCare access services remain separate owners. In a later activation task they may implement a typed `HydrationPolicyAdapter`, but none may calculate an effective hydration plan directly.

## 6. Phase 1 API contracts

All endpoints live in a new dedicated router. They require `requireAuth`, then `HydrationFeatureGate.requireFoundation`, then schema readiness. They do not share a generic route that accepts body/query `userId`.

| Endpoint | Request | Response / Phase 1 behavior |
| --- | --- | --- |
| `POST /api/hydration/events` | `{originalAmount, originalUnit, occurredAt, occurredTimezone, beverageClass, note?, idempotencyKey, clientInstanceId?}` | Creates factual event only. Returns `{event, stateVersion, inputWatermark}`; no goal/remaining field. Identical idempotency key and payload returns prior result; same key with different hash returns `409 IDEMPOTENCY_KEY_REUSED`. |
| `GET /api/hydration/events` | `from`, `to`, `limit`, opaque `cursor` | Returns `{items, nextCursor, inputWatermark}` in stable `(occurred_at desc, id desc)` order. ISO dates, limit, and cursor are strict-schema validated. |
| `POST /api/hydration/events/:eventId/correction` | `{replacement?, void?, reasonCode, idempotencyKey}` | Appends a successor event or void supersession; returns new effective event/state version. No PATCH or DELETE route exists. |
| `GET /api/hydration/plan` | `date=YYYY-MM-DD`, optional validated timezone only if user profile policy permits it | Returns a self projection of the immutable revision. Phase 1 output includes status/provenance only; numeric plan fields are absent. |
| `GET /api/hydration/state` | `date=YYYY-MM-DD` | Returns `{planStatus, stateVersion, totalDeclaredVolumeMl, unknownContributionEventCount, electrolyteCoverage, inputWatermark, computedAt}`. It never returns a target, remaining amount, progress, or advice. |
| `GET /api/hydration/history` | `from`, `to`, opaque cursor | Returns historical state revisions and factual events only; no cross-user selector. |

No public professional route, directive write route, policy write route, plan preview route, consumer projection route, or action-brief route is enabled in Phase 1. Those contracts remain server-internal types until the relevant activation approvals exist.

For every route:

- malformed units, invalid dates, unrecognized timezones, negative/zero amounts, non-UUID idempotency keys, and invalid cursors return a typed `400`;
- the server stores canonical mL but retains original amount/unit;
- self-service routes ignore any supplied `userId`, `subjectUserId`, `organizationId`, or professional selector;
- error responses contain a correlation ID and safe code, never sensitive event or clinical details;
- cache responses carry `stateVersion`, `inputWatermark`, and `Cache-Control: no-store`.

## 7. Cross-device synchronization, client-cache isolation, and client boundary

Phase 1 does not change React screens or client APIs. It does define the required cutover contract:

1. Every successful event write returns the authoritative state watermark. A client re-fetches if its local watermark is older.
2. Client retries reuse the original idempotency key. A new user action gets a new key. There is no best-effort silent retry.
3. Future cursors encode `{occurredAt,id}` and are signed/validated as opaque values; timestamp-only pagination is prohibited.
4. Future React Query keys include local account identity and delegated-client identity where applicable, for example `['hydrationState', viewerId, subjectScope, localDate]`. The request still contains no self-service subject identity.
5. Logout, session expiry, and viewer switch remove all hydration queries. A subject switch clears state before a new fetch; in-flight requests use cancellation and a viewer/subject equality guard before rendering.
6. Any future local cache uses an account-scoped key and includes the server `stateVersion`; a cached value never overwrites a newer server state.
7. `mpm_bio_water:${userId}`, global `latestWeight`, and unauthenticated macro fallback values are not imported during Phase 1. Their later cutover is a separate UI/migration task with explicit confirmation for a same-day adjustment.

## 8. Existing-component classification

| Current asset | Classification | Phase 1 disposition |
| --- | --- | --- |
| `water_logs` table | **KEEP** | Retain unchanged as legacy factual history and backfill source. |
| `server/routes/waterLogs.ts` ownership/delegation guard | **REUSE** | Reuse its server-derived owner and fail-closed delegated-access pattern in the new event router. Do not change its public behavior. |
| Duplicate/late migration and route wiring in `server/index.ts` / `server/prod.ts` | **REMOVE LATER** | Do not copy this pattern. Hydration uses one shared readiness runner and one shared router-registration function; remove any temporary duplicate hydration wiring after parity tests prove the shared path. |
| Current water-log conversion/date parser | **ADAPT** | Use only after strict unit/date/timezone validation; unknown units must no longer fall through as mL. |
| Biometrics `WaterLog` UI | **KEEP** | Leave untouched in Phase 1; it is not the domain UI. |
| `mpm_bio_water:${userId}` and local goal formula | **DEPRECATE** | Keep current behavior temporarily; contain it from server truth and remove only in an approved future UI cutover. |
| `client/src/lib/waterLogsApi.ts` | **KEEP** | Maintain legacy API compatibility. Add a separate hydration-domain client later, not in Phase 1. |
| `useWaterLogsInfinite` | **ADAPT** | Future history hook must use opaque composite cursors, cancellation, and cache invalidation; no Phase 1 consumer change. |
| GLP-1 daily tolerance and `water_ml_logged` snapshot | **KEEP** | Remain condition-specific history; do not repurpose as canonical events or alter current escalation behavior. |
| GLP-1 resolver’s water aggregation | **MIGRATE LATER** | Consume a Hydration Domain projection only after GLP-1 parity and clinical activation review. |
| Hydration/coaching observers | **REUSE** | Keep as evidence/trend observers; their 2,000 mL comparator is not a prescription and must not seed a plan. |
| Performance/pregnancy services | **REUSE** | Future structured-context contributors only; no hydration modifier now. |
| Protocol Envelope | **ADAPT LATER** | Future distribution path for a constrained hydration projection; no Phase 1 payload change. |
| Beverage Creator and Athletic Beverage Creator | **KEEP** | No new target, electrolyte, or action-brief behavior. |
| Nutrition Life Plan and meal builders | **KEEP** | No direct event aggregation or hydration calculations added. |
| ProCare/client dashboards | **KEEP** | No professional hydration visibility, directive, or client selector is enabled. |

## 9. Feature-flag and safety design

Create one server-owned feature gate in `server/services/hydration/hydrationFeatureGate.ts`; do not use either existing client-side feature-flag registry as authority.

| Setting | Default | Effect |
| --- | --- | --- |
| `HYDRATION_FOUNDATION_ENABLED` | `false` | New hydration router returns `404 HYDRATION_FOUNDATION_DISABLED`; no worker/backfill executes. |
| `HYDRATION_FOUNDATION_SHADOW_ENABLED` | `false` | Allows backfill/parity jobs only after a controlled internal enablement; never changes user responses. |
| `HYDRATION_POLICY_ACTIVATION_ENABLED` | hard-coded `false` in Phase 1 | Resolver startup and every resolve call reject activated statuses, numeric outputs, and active policy manifests. It cannot be enabled through environment configuration in this phase. |

The gate is evaluated server-side on every endpoint and worker invocation. It fails closed when configuration is missing or schema readiness is false. The migration may be deployed while `HYDRATION_FOUNDATION_ENABLED=false`; this is the intended safe state.

## 10. Backfill, shadow-read, parity, rollback, and recovery

### Backfill

1. Snapshot the candidate legacy set by UUID and source-row hash; do not lock or alter the legacy table.
2. Map one row at a time through the mapping table with `ON CONFLICT` behavior keyed by `legacy_water_log_id`.
3. Preserve existing `amount_ml`, unit, ID, and timestamp as factual source data. The migration records the legacy timestamp interpretation used for the canonical event timezone; it does not silently claim precise historical timezone knowledge.
4. Reject and report invalid legacy records into a reconciliation report; do not fabricate units or amounts. Backfill does not become complete until every source row is mapped or explicitly accounted for.
5. Verify counts, ID mapping, canonical mL, original unit/value, and stable source checksum. Rerunning the same backfill produces zero new events and the same checksum.

### Shadow reads

When the shadow flag is enabled, the projector creates only internal `monitor_only` state records and parity metrics:

- source row count versus mapping count;
- per-user/date legacy mL total versus canonical declared volume;
- duplicate mapping count;
- invalid/unmapped legacy count;
- projector latency/error rate;
- no consumer reads, no API response changes, and no UI telemetry containing raw history.

There is no “numeric goal parity” because Phase 1 intentionally does not have a server goal.

### Rollback and recovery

- Disable the two environment flags; this immediately removes foundation routes and stops projection/backfill work.
- Preserve all append-only foundation tables, mappings, revisions, and audit records for investigation; never roll back by deleting user data.
- Keep `water_logs` and its legacy route as the operational source throughout the shadow period.
- A failed batch is marked failed with its watermark and error code. Recovery resumes from the last verified mapping, not from an unbounded full replay.
- Before any future consumer cutover, define an owner-approved parity threshold, shadow duration, support runbook, rollback trigger, and user communication plan. None is required for schema-only deployment.

## 11. Observability and audit requirements

Use structured, redacted events:

- `hydration.event.accepted`, `rejected`, `deduplicated`, `corrected`, `voided`;
- `hydration.plan.resolved`, `withheld`, `needs_review`, `blocked`;
- `hydration.state.projected`, `stale`, `failed`;
- `hydration.backfill.started`, `completed`, `mismatch`, `failed`;
- `hydration.access.denied`, `professional_access_attempted`;
- `hydration.schema.ready`, `not_ready`.

Every event includes correlation ID, route/service, safe outcome code, actor/subject IDs only where allowed by the audit store, plan/state version when relevant, and elapsed time. Generic logs must not contain notes, raw intake payloads, clinician rationale, symptom text, electrolyte totals, or user-facing explanations.

Alerts before any future cutover: schema-not-ready when flag is enabled, nonzero backfill mismatch, idempotency-hash conflict, audit write failure, projector failure, and route/middleware parity failure between development and production.

## 12. Automated test matrix

| Area | Required tests |
| --- | --- |
| Contract/unit | unit conversion preserving original input; strict invalid-unit/date/timezone rejection; local-date derivation; idempotency replay/mismatch; opaque composite cursor ordering; lineage cycle prevention; only allowed Phase 1 status/fields. |
| Resolver | deterministic `monitor_only` revisions; no numeric output under any inactive input; unknown contribution/electrolyte coverage stays unknown; hard/incompatible future claims yield `needs_review` or `blocked`; revision hash/provenance is stable. |
| Event/history integration | auth before database access; hostile body/query identity ignored; terminal-event selection after correction/void; immutable rows cannot be updated; stable pagination for equal timestamps; state version increment and recomputation. |
| Delegated access | existing self-owner behavior remains; unauthorized or revoked delegated care access returns 403; verifier failure returns 503; no query occurs before authorization. No new professional hydration endpoint is enabled. |
| Migration | migration is idempotent and transactional; dev and prod invoke the same runner; legacy preservation; one-to-one mapping; repeatable backfill; source/canonical checksum parity; malformed legacy row reconciliation; rollback flag behavior. |
| Cache/account isolation | later client helper contract tests for account-scoped query keys, logout eviction, viewer/subject switch cancellation, stale response rejection, and no local hydration import. Existing water-log client tests stay green. |
| Regression | existing WaterLog UI behavior unchanged; water-log identity tests stay green; GLP-1 tolerance and symptom escalation tests remain unchanged; performance, pregnancy, Beverage Creator, Coach, Protocol Envelope, and ProCare behavior have no new hydration response fields. |
| Dev/prod parity | route/middleware manifest test compares `server/index.ts` and `server/prod.ts` registration for the hydration router; foundation readiness before enabled route; no naked router mount. |
| E2E/smoke | feature-disabled route returns expected disabled response; after controlled non-production enablement, one event from Device A appears on Device B after refetch with no target fields; account switch never displays prior state. |

### Pre-publish validation

1. `npm run check`
2. `npm run check:safety-types`
3. targeted Jest hydration, water-log identity, migration, GLP-1, and feature-gate suites
4. `npm run build:client`
5. `npm run build:server`
6. `npm run validate`
7. `npm run release-check`
8. migration preflight against an anonymized/representative database copy; no use of `db:push` as the hydration migration validation
9. dev/prod route-middleware manifest comparison
10. flag-off smoke proving no current endpoint, UI, target, or consumer behavior changes.

### Post-publish production acceptance

Use dedicated non-customer test accounts and explicitly supplied test credentials. Do not hard-code a Replit development URL.

For **both** `https://app.myperfectmeals.com` and `https://app.myperfectmeals.ai`:

1. verify the production health endpoint and schema-readiness telemetry;
2. verify `HYDRATION_FOUNDATION_ENABLED=false` produces the disabled response and no Biometrics behavior change;
3. verify legacy `/api/water-logs` self ownership, hostile `userId` rejection/ignore behavior, and authorized/denied delegated-access behavior remain unchanged;
4. verify no new hydration target, remaining amount, plan recommendation, clinician directive, or consumer action is reachable;
5. after a separately approved shadow enablement on a dedicated test account only, write one idempotent canonical event, refetch it from a second device/session, verify no cross-account visibility, and then disable shadow mode;
6. verify all observations are reviewed without placing raw hydration payloads in shared logs.

## 13. Expected implementation file set

The following is the expected Phase 1 change set after explicit approval. Names may change only if the implementation review documents an equivalent boundary.

### Create

- `shared/hydration/contracts.ts`
- `shared/hydration/schemas.ts`
- `server/db/schema/hydration.ts`
- `migrations/0010_hydration_foundation.sql`
- `server/db/migrations/runHydrationFoundationMigration.ts`
- `server/services/hydration/hydrationFeatureGate.ts`
- `server/services/hydration/HydrationEventService.ts`
- `server/services/hydration/HydrationInputService.ts`
- `server/services/hydration/HydrationPlanResolver.ts`
- `server/services/hydration/HydrationStateProjector.ts`
- `server/services/hydration/HydrationProjectionService.ts`
- `server/services/hydration/HydrationBackfillService.ts`
- `server/routes/hydration.ts`
- focused hydration unit, route, migration, resolver, state, and flag test files under `server/tests/` and `server/services/hydration/__tests__/`
- a route/middleware parity test for development and production registration.

### Modify

- `shared/schema.ts` only to export/register the new hydration schema according to the project’s Drizzle convention.
- `server/index.ts` and `server/prod.ts` only to invoke the same synchronous migration readiness runner and route-registration function.
- `server/routes.ts` only if it is the shared registration location chosen for the hydration router.
- `docs/DAILY_HYDRATION_IMPLEMENTATION_GATE_REVIEW.md` and `docs/HYDRATION_GOVERNANCE_DECISION_MATRIX.md` only to record the approved foundation gate before implementation begins.

### Explicitly not modified in Phase 1

- `client/src/pages/my-biometrics.tsx`
- `client/src/lib/waterLogsApi.ts`
- `client/src/hooks/useWaterLogsInfinite.ts`
- `server/routes/waterLogs.ts`
- GLP-1, performance, pregnancy, Beverage Creator, Coach, Protocol Envelope, Nutrition Life Plan, ProCare, or meal-builder runtime behavior
- current client feature-flag registries.

## 14. Dependency-ordered implementation checkpoints

| Checkpoint | Work after approval | Exit evidence |
| --- | --- | --- |
| 0 — Gate reconciliation | Record blueprint approval; reconcile the controlling implementation-gate language with the approved scope lock; establish migration/route parity ownership. | Signed scope, explicit #1472 authorization, and no contradiction among governance documents. |
| 1 — Shared contracts | Add types, validators, Phase 1 invariant tests, and server feature gate with all defaults disabled. | Type checks; tests prove numeric output and activated policies are impossible. |
| 2 — Additive schema/readiness | Add the locked migration, transactional runner, and dev/prod synchronous readiness wiring. | Empty-database and existing-database migration tests; no legacy table change. |
| 3 — Immutable factual ledger | Build event, idempotency, correction/void, audit, history pagination, and self-owner API behavior behind disabled gate. | Route and identity-isolation tests; legacy water routes unchanged. |
| 4 — Monitor-only resolver/state | Build inactive-input loader, immutable revisions, state projector, and internal monitor-only projection. | Determinism, provenance, and no-numeric-output tests. |
| 5 — Backfill/shadow harness | Implement mapping ledger, batch runner, parity queries, redacted telemetry, and rollback controls. | Repeatable checksum/count parity on representative data; no consumer output changes. |
| 6 — Release verification | Run all pre-publish checks and flag-off production acceptance on both customer domains. | Review record with test results, disabled-state evidence, and no regression. |

No checkpoint includes UI migration, local-storage import, consumer cutover, clinical policy activation, professional directive use, or POTS work.

## 15. Safety/brittleness findings from the audit

1. **Migration execution is fragmented.** Existing delayed boot migrations can race startup and drift from tracked SQL. Hydration must use the narrow synchronous readiness design above.
2. **Development/production route parity is not guaranteed today.** The audit found different middleware/mount patterns for some clinical and beverage/performance routes. The hydration router must have one shared registration path and a parity test; this should not be copied from divergent patterns.
3. **Legacy history pagination is timestamp-only.** The new domain must use `(occurred_at, id)` composite ordering and opaque cursors.
4. **Legacy API validation is permissive.** Its unknown-unit fallback, date parsing, and limit validation cannot be inherited by the canonical event API.
5. **Current client local hydration behavior can diverge from the server.** Because Phase 1 leaves that UI untouched, it must remain isolated from canonical state; a later cutover needs explicit reconciliation and account-cache work.
6. **Current non-hydration local caches are not uniformly account-partitioned.** Any future Hydration UI must meet the stricter isolation contract rather than copying global keys such as `latestWeight`.
7. **Prior governance-gate wording conflict — resolved at Checkpoint Zero.** The ownership-resolution report, decision matrix, and implementation-gate review now use one staged controlling gate: the Foundation gate is passed in principle, the Activation gate remains closed, and code still requires explicit Task #1472 start authorization.

## 16. Pre-Checkpoint Zero finding — resolved

The blueprint initially identified three required changes before implementation: reconcile the implementation gate, make migration readiness an explicit contract, and require development/production route parity. Checkpoint Zero has now documented those changes in the controlling gate and governance matrix.

The future backfill/shadow owner, parity threshold, and rollback review record remain mandatory before shadow mode is enabled. They do not authorize or require a current schema change.

## 17. Checkpoint Zero closure

### Resolved implementation contract

- **One controlling gate:** `docs/DAILY_HYDRATION_IMPLEMENTATION_GATE_REVIEW.md` defines a passed Foundation gate and a separately closed Activation gate.
- **Migration readiness:** all Phase 1 schema work must be additive, transactional, idempotent, rerunnable, and non-destructive; `water_logs` remains intact; backfill has mapping, tie-safety, duplicate prevention, count/checksum reconciliation, recovery, and shadow requirements.
- **Development/production parity:** one shared hydration registration contract, identical authentication/ownership/flag behavior, build-time route-contract verification, and post-publish checks on both customer-facing domains are mandatory.
- **No activation:** the server foundation can return only `monitor_only`, `needs_review`, or `blocked`; no target, recommendation, professional directive, UI, consumer cutover, or browser-local automatic import is allowed.

## CHECKPOINT ZERO PASSED — READY TO IMPLEMENT PHASE 1

The feature-disabled foundation may begin only after the product owner explicitly starts Task #1472. The Activation gate remains closed for every clinical policy, electrolyte rule, professional authority, user-facing hydration behavior, and consumer cutover.