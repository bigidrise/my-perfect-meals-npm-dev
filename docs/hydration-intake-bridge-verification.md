# Legacy Hydration Intake Bridge Verification

## Boundary and source of truth

The existing read-through bridge was audited rather than replaced. `water_logs`
remains the only editable legacy intake ledger. Every bridge read queries the
current source; no copied events, cache, backfill, dual writes, new routes, tables,
or migration execution were introduced. The protected water routes, storage,
schema, and UI were not modified.

Canonical projection identity is deterministic for the owner and legacy record.
The original legacy record ID remains available separately as source evidence.
Replays preserve identity, corrections change the current projection and its
fingerprint, and deletions remove it on the next read.

## Evidence and authorization

- Normalized integer milliliters and occurrence/creation instants remain exact.
- Legacy units remain explicit. Reverse-converted display amounts are labeled
  reconstructed; unsupported units preserve normalized mL and raw unit evidence.
- The exact originally typed amount was not stored and cannot be recovered.
- The original entering actor is unknown. The canonical subject placeholder is
  explicitly labeled as such; provenance retains a null legacy actor.
- Historical timezone handling remains explicitly labeled as UTC interpretation;
  this work does not invent the original timezone or alter local-day policy.
- Recognized stored beverage classes are preserved; unsupported classes retain
  raw evidence and map to unknown, without nutrients or clinical inference.
- Authentication is required. Delegated access uses the existing organization/
  care-relationship verifier on every read. Denied, unavailable, or ambiguous
  authorization fails closed. Mismatched-owner source rows are rejected.

## Verification

- Seven focused suites: **85 tests passed**, covering projection, canonical
  service, protected water routes, identity isolation, foundation schemas,
  modifier resolution, and planning eligibility.
- Strict Hydration contract TypeScript check: **passed**.
- Full server TypeScript check: **passed**, zero diagnostics.
- Production client and server builds: **passed**.
- Development workflow restarted in its existing safe-start configuration:
  startup succeeded and `/api/health` returned HTTP 200 with `ok: true`.
- `NODE_ENV=development npm run validate -- --no-start`: **failed** at the
  repository-wide navigation audit with 72 flagged targets, matching the
  pre-existing blocker observed before this task. Later validation stages did
  not run through that command. The gate was not modified or bypassed.

## Disabled capabilities and approval

The bridge exposes intake facts and provenance only. It adds no numeric targets,
minimums, maximums, remaining amounts, numeric progress, recommendations,
electrolyte calculations, or clinical decisions. Existing downstream policies
were not changed or newly activated.

No live water records were created, corrected, deleted, or backfilled for tests;
fixtures use in-memory/mocked stores and authorization. No production workspace
configuration, migration, deployment, publishing, pushing, or merging occurred.

Rollback is source-only: restore the previous bridge and tests. There is no
data rollback. Any UI integration, protected-logger evidence capture, persistence
change, or Production promotion needs separate approval. Repository-wide
validation remains a release blocker; this report is not release clearance.
