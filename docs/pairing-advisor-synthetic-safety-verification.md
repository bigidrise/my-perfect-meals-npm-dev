# AI Pairing Advisor: synthetic safety integration verification

## Status

The three approved tasks are complete: advisor-specific deterministic bridges,
synthetic write-isolation verification, and a strict owner-resolution proposal.
**This is not runtime activation or proof of complete live clinical authority.**

Phase 1 and shared services are unchanged. Increment 2's application binding remains
unactivated. No frontend or Increment 3 work was performed.

## Files changed

New:

- `server/services/pairingAdvisor/deterministicSafetyBridge.ts`
- `server/tests/pairingAdvisorSafety/jest.config.cjs`
- `server/tests/pairingAdvisorSafety/storageStub.cjs`
- `server/tests/pairingAdvisorSafety/tsconfig.json`
- `server/tests/pairingAdvisorSafety/scanners.test.ts`
- `server/tests/pairingAdvisorSafety/writeIsolation.test.ts`
- `docs/pairing-advisor-strict-owner-resolution-proposal.md`
- This verification report.

Updated:

- `.agents/memory/pairing-foundation-release-boundary.md`: record the approved synthetic
  verification scope and continuing shared-service/live-activation restrictions.

No existing scanner, pairing route, clinical resolver, no-save helper, application
registration, package, root test configuration, or environment configuration was changed.

## Final test results

| Suite | Ordinary passing tests | Expected-failure regressions | Unexpected failures |
|---|---:|---:|---:|
| Existing offline contracts | 114 | 0 | 0 |
| Existing mocked server integration | 96 | 0 | 0 |
| New synthetic safety/write isolation | 69 | 1 | 0 |
| **Total** | **279** | **1** | **0** |

Jest reports all 280 cases as accepted/passed because `test.failing` accepts the
known failing assertion. **That does not mean the callback safety guarantee passes.**
The explicitly named `KNOWN GAP` regression is described below and remains a blocker.

Commands:

```sh
./node_modules/.bin/jest --config server/tests/pairingAdvisorOffline/jest.config.cjs --runInBand --silent
./node_modules/.bin/jest --config server/tests/pairingAdvisorIntegration/jest.config.cjs --runInBand --silent
./node_modules/.bin/jest --config server/tests/pairingAdvisorSafety/jest.config.cjs --runInBand --silent
```

The initial new-suite run completed its assertions but the process failed to exit
because importing the unchanged override service creates a housekeeping interval.
The test now virtualizes interval scheduling only and clears it at teardown.
Final suites exit normally; no `--forceExit` workaround is used.

## Deterministic scanner evidence

The new bridge has no runtime imports of database-backed scanner modules. The guarded
test harness supplies the actual unchanged functions:

- `requiresVerifiedIngredientEvidence`
- `enforceSafetyProfileSync`
- `scanGeneratedOutput`
- `containsAlcoholContent`

Actual protocol and alcohol calls are wrapped with recording spies, not replaced
with permissive verdicts. The baseline envelope comes from the real guest-envelope
constructor and receives only synthetic owner identity and synthetic profile data.
The authority receipt is still a fixture, not a claim about the live loader.

Verified:

- Allergy, alpha-gal and pregnancy ingredient requirements stop consumption before generation.
- Restricted profiles can receive educational explanations under a separately reviewed
  education outcome; examples do not become personal consumption clearance.
- An already-resolved complete synthetic unrestricted profile passes real input/output checks.
- Explicit vegan conflicts are rejected by the existing pure input check.
- Missing identity, missing arrays and missing/invalid nested context never become a pass.
- The bridge does not invoke the asynchronous SAFE-on-profile-load-failure path.
- Cards, alternatives, explanations, serving instructions, narrative and follow-ups
  reach the applicable real protocol scan. Unsafe results withhold the entire recommendation,
  including related prose and references.
- Actual alcohol detection returns true for alcohol found; the bridge reverses that
  to a failed safety result under the existing Halal prohibition.
- Separate field checks prevent a safe-variant phrase from masking unsafe advice elsewhere.
- Alcohol detection is not converted into a new blanket prohibition for unrestricted profiles.
- A newly resolved ingredient restriction stops a later conversation turn.
- Passing term scans does not authorize invented product evidence or bypass semantic review.

The model generation, intent assessment and complete-response semantic review remain
synthetic. Their correctness with real models is not established by these tests.

## Write-isolation evidence

All application database imports resolve to an in-memory fixture before the real
functions are imported. Mock query projections return only selected fields, and
unconfigured reads fail instead of falling back to a real database.

Verified with the real no-save and prescription functions:

- Normal calculation with recorded mock materialization equals no-save calculation.
- The synthetic GLP-1 clamps, saved starch count and timing remain intact.
- No-save calculation invokes the suppression hook and performs zero prescription inserts.
- Observed reads route through the synthetic `BEGIN READ ONLY` transaction and end in rollback.
- Unexpected INSERT/UPDATE/DELETE, writable CTE, COPY/CALL and transaction-escape SQL
  are rejected before reaching the synthetic client.
- Caught promise-based write errors, raw callback write rejection, and a simulated
  promise-based PostgreSQL `25006` cannot pass the explicit completion assertion.
- Real audit and override audit functions cannot persist through the boundary.
- Deferred work cannot use the original pool or released transaction after completion.
- Ordinary concurrent requests retain their own route and suppression behavior.
- Concurrent no-save operations receive distinct synthetic clients and independent
  transaction/query sequences.
- A closed Development gate rejects before acquiring even a synthetic client.

No PostgreSQL server was contacted. PostgreSQL `25006` behavior was simulated to test
the boundary's handling of the server's error shape, not to audit real database permissions.

### Required caller obligation

`withDevelopmentNoSaveDatabase` does not itself call `assertNoDevelopmentTestWrites`.
A negative-control test confirms that a caller which catches a blocked write can
return an unchecked success. The verified synthetic harness explicitly asserts after
awaited work. Future runtime code must not omit that assertion.

### Confirmed unresolved callback failure

For `pool.query("SELECT ...", callback)`, a server-side `25006` delivered through the
callback is not observed by the helper's promise `.catch` wrapper. If the callback
swallows the error, `blockedWriteCount` stays zero and the completion assertion misses it.

The desired-behavior regression is explicitly marked `test.failing`; the shared helper
was not changed. The simulated write still fails at the read-only client, but the
operation can incorrectly report verified success. Separate shared-service approval
is required to fix callback error observation while preserving pg overload behavior.

## Import and external-I/O isolation

Before runtime module loading, the suite installs:

- A database module mapping to the memory-only fixture.
- Forbidden-module mappings for real drivers, providers and session stores.
- Guards denying network requests, socket connections, DNS and child processes.

Tests verify driver/provider/session module denial and forbidden network operations.
Scanner tests assert zero storage reads, writes, connections or client queries.
Write-isolation tests create only their recorded synthetic clients.
No application startup, workflow restart, real session store, real database connection,
provider instance or paid AI call was initiated for this work.

## TypeScript evidence

All three focused configurations pass:

```sh
./node_modules/.bin/tsc -p server/tests/pairingAdvisorOffline/tsconfig.json --pretty false
./node_modules/.bin/tsc -p server/tests/pairingAdvisorIntegration/tsconfig.json --pretty false
./node_modules/.bin/tsc -p server/tests/pairingAdvisorSafety/tsconfig.json --pretty false
```

Root `tsc --noEmit --pretty false` remains failing with **121 pre-existing diagnostics**.
Before/after diagnostic output is **byte-for-byte identical**, not merely equal in count.
No new diagnostic, changed diagnostic or root configuration suppression was introduced.

## Remaining blockers and next approval

1. Strict owner scope is not propagated through the live envelope/prescription GLP-1 chain.
2. Required nested failures/defaults do not yet produce explicit completeness evidence.
3. Callback-delivered server read-only errors are not counted by the shared no-save helper.
4. Runtime authority, import/side-effect isolation beyond the synthetic harness, and real
   semantic interpretation/review remain unproven and disconnected.

The companion strict-owner proposal lists the exact shared-service changes, conditional
alternatives, source outcomes and regression scope. Review and separately approve that
scope before implementation. Live profiles, provider calls, frontend work and activation
remain separate decisions.

Stopped after the three approved tasks. No Production changes, migrations,
environment-variable changes, publishing, deployment, pushes or merges were performed.
