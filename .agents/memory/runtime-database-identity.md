---
name: Shared Neon and workspace release boundary
description: Development and Production are separate workspaces sharing external Neon; publishing Development does not release Production.
---

Development and production use the same external Neon database; this project does not use Replit's managed database. Do not suggest proving database isolation between the two or raise it as a blocker or follow-up.

**Why:** The user explicitly confirmed the shared Neon arrangement and asked us to stop revisiting the database question.

**How to apply:** Treat the arrangement as settled project context. Do not initiate database investigation or changes unless a future request explicitly requires them.

A normal application restart is not necessarily migration-free. Account-maintenance suppression covers only part of boot mutations, not the entire startup sequence.

**Why:** The Development entrypoint schedules migration hooks on startup; restarting it can conflict with an explicit no-migrations request.

**How to apply:** Use a verified migration-free launch path, or obtain approval for a Development-only startup skip before restarting under that constraint.

Do not treat a skipped migration as a successful schema prerequisite for a destructive worker, and do not remove read-only readiness checks along with migration writes.

**Why:** Studio purge initialization couples migration success to worker startup; a naive skip can weaken its safety gate.

**How to apply:** Separate mutation jobs from readiness checks and preserve explicit schema assurance before starting dependent workers.

Safe startup must suppress automatic launch sites, not globally block database writes or bypass request security. Published-deployment authority always overrides suppression; inherited client branding does not establish runtime identity. The Development bootstrap still refuses Production mode; an explicit, unpublished Production-workspace diagnostic uses a separate pre-import boundary.

**Why:** Shared Neon requires stopping automatic maintenance without breaking authentication, interactive recipe generation, or clinical enforcement. A safe-start opt-in was silently ignored because Development inherited client Production branding; tests with minimal synthetic environments missed it. Static imports can launch workers before the entrypoint body runs. A workspace preview can use the same Production entrypoint as the published app, so NODE_ENV alone cannot distinguish those contexts.

**How to apply:** Initialize an immutable decision before importing the application. An ambiguous or uninitialized workspace safe opt-in must abort, never fall back to normal maintenance; normal published startup must retain workers despite inherited preview switches. Audit import-time workers, singleton initialization, session pruning, deferred jobs and awaited startup work together. Keep read-only prerequisites fail-closed; test inherited branding and occupied ports without loading database dependencies. Maintenance suppression is not a read-only sandbox: intentional login/session and other request writes remain real.

Do not attribute cumulative database mutation counters or current schema presence to a single failed startup without a before-state or operation-specific evidence.

**Why:** Concurrent applications share Neon, some account mutations have no modified timestamp, and PostgreSQL commit timestamp tracking may be disabled. A clean recent timestamp query cannot exclude updates, deletes, or DDL.

**How to apply:** Separate confirmed invocation, observed current data, and proven changes. Request the failed process's redacted logs when they are not captured by the managed workflow; do not claim no changes from aggregate counters alone.

Signal delivery alone does not establish that the Development server stopped gracefully.

**Why:** An observed SIGTERM was intercepted by notification cleanup while both HTTP and Vite listeners remained open beyond the shutdown wait.

**How to apply:** Confirm process exit and release of both ports before launching a replacement. Do not assume a shutdown hook terminates the server, or substitute forced termination without approval.

Request-wiring verification need not wait for a migration-free application startup.

**Why:** Startup mutations are unrelated to checking how a saved handler consumes a request; isolated fixtures can verify that contract without changing startup protections.

**How to apply:** Execute the saved handler and route binding with allowlisted fixture dependencies. Clearly distinguish wiring checks from real authentication, database-backed policy, and model compliance.

An isolated validation HTTP port does not authorize live account creation on shared Neon. Routine authentication validation must remain credential-free; live account lifecycle testing requires a separately approved cleanup strategy.

**Why:** Live validation left temporary accounts behind because the Development billing safeguard deliberately rejects parent-user deletion to protect financial cascades. Passing login checks must not conceal failed cleanup, and the safeguard must not be relaxed for test convenience.

**How to apply:** Use mocked requests and blocked database/network transports for routine checks. Treat cleanup failure as failure, retain sanitized evidence, and never describe fixture success as live authentication coverage.

For explicitly approved additive, Development-only clinical storage, "Development-only" gates the migration command and application access, not the physical schema: new tables exist on shared Neon while food reads remain unchanged. Do not substitute a requirement for a separate Development database after that approval.

**Why:** Requiring independent branch isolation contradicted the confirmed shared-database arrangement and delayed an approved additive migration.

**How to apply:** State the shared-schema consequence before the write, keep changes additive and runtime-gated, and require separate approval before any food-read cutover or destructive data operation.

Development and Production are separate Replit workspaces. Publishing this Development workspace does not update the Production workspace; approved code must be promoted through GitHub, synced into the Production workspace, verified there, and only then published there.

**Why:** An incorrect suggestion to publish Development during an urgent billing incident would not have delivered the repair action to the separate Production workspace.

**How to apply:** Inspect branch and release scope before proposing a GitHub promotion; never describe this workspace's Publish action or deployment URL as the live Production release. The shared Neon data can be inspected read-only here, but Production runtime failures require evidence from the Production workspace.

The user identifies `https://my-perfect-meals-npm-dev-1.replit.app` as the Development workspace's public URL, not the separate Production app.

**Why:** The user clarified this distinction after initially calling a screenshot from that URL a Production issue.

**How to apply:** Distinguish the published Development app from the Development preview and the separate Production workspace. Verify current deployment metadata rather than inferring workspace scope from a public `.replit.app` URL.