# AI Pairing Advisor — offline integration-readiness A–C

## Result and release boundary

The approved offline A–C adapter/control implementation is complete. This is a
synthetic reliability checkpoint, **not customer readiness, clinical validation or
activation of real conversational intelligence**.

The existing synthetic prototype is unchanged. No customer screen, existing pairing
route, application registration, authentication/billing middleware, scanner rule,
clinical calculation, schema, dependency or environment configuration was changed.
The existing advisor application binding remains denied. No D–F implementation,
workflow restart/application startup, live account/database execution, paid call,
publishing, deployment, push or merge was performed.

## Increment A — contracts and transport

- A closed typed turn contract separates session identity, conversation identity,
  idempotency/request identity and expected server context revision.
- The disconnected controller returns server context acknowledgements and controlled
  error codes. Proposed HTTP status mappings exist as data only; no HTTP endpoint
  was mounted or changed.
- Every method requires a caller-supplied authenticated owner/login identity,
  active access and Pro access. Both undeployed Development checks and an explicit
  offline-only controller mode are required. These are injection boundaries, not
  new proof of the existing real authentication stack.
- Existing account limits are reused: five accepted submissions per minute and
  one in-flight operation per account, including across login sessions.
- Preferences and context can change without starting over. No mandatory questions
  were added. Unknown subjects, missing referents and unclear intent require
  clarification rather than fabricated personalization.
- Resetting history rotates conversation identity and cancels pending work;
  replacing a list or reopening the same supported session cannot clear retained risks.

### Exactly what risk continuity guarantees

The server-owned, memory-only session is keyed by an opaque generated identifier and
bound to the authenticated account and login session. Opening it again returns the
same live session. Accepted explicit risk fields and successfully interpreted new
disclosures are retained independently of client history, preferences and supplied lists.
The client cannot delete those retained risks.

An accepted turn sets an unresolved-input latch before authority or provider work.
Failure/cancellation before interpretation leaves the latch set. Subsequent successful
interpretation does not erase an earlier unresolved input. Affected personal
recommendations remain withheld; separately reviewed education can still proceed.
This is deliberately conservative, not an automatic clinical resolution mechanism.

Session bounds:

- Fixed 30-minute lifetime, not silently extended by activity.
- At most 100 live sessions per controller instance.
- At most 128 request identities and 20 deduplicated risk descriptions per session.
- Capacity exhaustion fails explicitly. Risk/request overflow seals the session;
  older restrictions/replay identities are not silently discarded.
- An expired, missing or foreign session fails explicitly; submit never creates a
  clean replacement automatically.

**Not guaranteed:** continuity across expiration, logout/login changes, process restart,
multiple server processes or independently constructed controllers. An explicit new
session after expiration starts without the previous session's disclosures. No
database, browser medical-data storage, durable health record or cross-process
continuity has been implemented. Model misses in identifying disclosures remain
unproven: fixture classifications cannot establish real semantic accuracy.

## Increment B — authority, unchanged rules and evidence

- A separately typed strict-owner port consumes the structural result of the
  established strict resolver, never a synthetic-only authority contract. Its
  resolver import/binding is absent from readiness runtime code.
- Owner, subject, envelope identity, source completeness and no-persistence evidence
  must agree. Required missing/failed sources fail closed, even for education.
  Optional preference failures remain separate.
- Established successful non-applicability remains valid, including healthy owners
  without a date-sensitive prescription. A required date cannot become a UTC
  fallback or a non-applicability exemption.
- Contract-consumer tests exercise the actual strict resolver with guarded mocked
  storage, including healthy-owner non-applicability and GLP-1 owner/prescription
  resolution despite a saved household selection. No live database is contacted.
- Deterministic validation calls explicitly supplied unchanged ingredient-evidence,
  synchronous input-safety, output-protocol and beverage-alcohol functions.
  No scanner, limit, formula, nutrient target or activation policy is changed.
- Recommendations, alternatives, serving advice, narrative and follow-ups receive
  applicable checks, including individual-field checks against masking.
  General educational content uses complete-response semantic review rather than
  being treated as permission to consume.
- Supplied-list evidence is reconstructed server-side for each turn, frozen and
  checked against exact full identities/revision. Duplicate/ambiguous names,
  wrong vintages, dangling references, off-list selections and unsupported
  structured price/stock/composition/suitability claims are rejected.
- A supplied list is not proof of product composition, inventory or personal safety.
  Unsupported claims in prose require semantic review; term scans alone cannot
  prove their absence.

## Increment C — provider interfaces and execution control

- A schema-bound interpretation interface reclassifies each turn. No real provider
  implementation, client initialization or API credential handling was added.
- Mock-only adapters separate interpretation, generation and complete-response review.
  Model outputs cannot grant authority, change a subject, override restrictions
  or establish supplied-list evidence.
- Each turn permits at most **three physical model-call slots**: one interpretation,
  one generation and one review. No stage retries, automatic repairs or fallbacks
  exist. Failed or interrupted calls still consume their slot.
- The mock port must return a single-physical-attempt receipt and receives an explicit
  zero-retry contract. This verifies the mock interface; it does not prove that a
  future real SDK honors that interface or has retries disabled.
- Offline ceilings are 15 seconds per model attempt and 45 seconds total. The total
  includes authority/scanner work and does not restart per stage. Smaller injected
  limits are exercised with fake timers. These are not activated live settings.
- Cancellation and deadline failure abort the shared signal, return no candidate,
  and ignore late completions. If a dependency ignores abort, transport settlement
  does not mean physical work stopped: the account lease stays held until that
  operation actually settles. A permanently hung dependency deliberately keeps
  that controller's account unavailable; no timed unlock starts overlapping work.
- Review receives the original request, policy decision, current evidence, complete
  immutable candidate and exact serialized candidate. Pass must cover the full
  response, intent boundary, evidence claims, unsafe advice and reference integrity.
  Missing, failed, uncertain, mismatched or mutation-producing review withholds output.
- Final deterministic validation and runtime/session/revision checks run before
  serialization. There is no streaming or unchecked partial-response path.

## Verification

All verification uses standalone guarded configurations; it does not import/start
application entrypoints or a listening server. Driver/provider imports and external
network/subprocess execution are denied before I/O. The actual strict resolver
contract tests use the existing in-memory storage stub and no-save transaction
boundary; their recorded transactions are synthetic, not real database connections.

| Suite | Passed | Failed |
|---|---:|---:|
| Existing offline advisor contracts | 114 | 0 |
| Existing mocked server integration | 96 | 0 |
| Existing safety/write-isolation/strict-owner regressions | 109 | 0 |
| Existing current GLP-1 authority regressions | 8 | 0 |
| **Preserved pairing regression subtotal** | **327** | **0** |
| New offline A–C readiness checks | 125 | 0 |
| Unchanged synthetic prototype checks | 78 | 0 |
| **Total** | **530** | **0** |

The existing GLP-1 authority tests alter only their Jest worker's temporary runtime
snapshot and restore it; no workspace environment setting or Production process is changed.

Four focused TypeScript configurations pass: Offline, Integration, Safety and Readiness.
The root remains at **121 existing TypeScript diagnostics**, and the sandbox remains
at **16 existing diagnostics**. Both final outputs are **byte-for-byte identical**
to their pre-change captures; no root/sandbox configuration or debt baseline was altered.

Reproduction (from project root):

```sh
./node_modules/.bin/jest --config server/tests/pairingAdvisorReadiness/jest.config.cjs --runInBand --silent
./node_modules/.bin/jest --config server/tests/pairingAdvisorOffline/jest.config.cjs --runInBand --silent
./node_modules/.bin/jest --config server/tests/pairingAdvisorIntegration/jest.config.cjs --runInBand --silent
./node_modules/.bin/jest --config server/tests/pairingAdvisorSafety/jest.config.cjs --runInBand --silent
./node_modules/.bin/jest --config server/tests/pairingAdvisorSafety/jest.config.cjs --testMatch '**/server/tests/currentGLP1MealAuthority.test.ts' --runInBand --silent
./node_modules/.bin/jest --config artifacts/mockup-sandbox/tests/jest.config.cjs --runInBand --silent
./node_modules/.bin/tsc -p server/tests/pairingAdvisorOffline/tsconfig.json --pretty false
./node_modules/.bin/tsc -p server/tests/pairingAdvisorIntegration/tsconfig.json --pretty false
./node_modules/.bin/tsc -p server/tests/pairingAdvisorSafety/tsconfig.json --pretty false
./node_modules/.bin/tsc -p server/tests/pairingAdvisorReadiness/tsconfig.json --pretty false
```

## Exact changed files

New contracts:

1. `shared/pairingAdvisor/readiness/transport.ts`

New server-only readiness implementation:

2. `server/services/pairingAdvisor/readiness/authority.ts`
3. `server/services/pairingAdvisor/readiness/controller.ts`
4. `server/services/pairingAdvisor/readiness/deterministic.ts`
5. `server/services/pairingAdvisor/readiness/evidence.ts`
6. `server/services/pairingAdvisor/readiness/execution.ts`
7. `server/services/pairingAdvisor/readiness/immutable.ts`
8. `server/services/pairingAdvisor/readiness/providers.ts`
9. `server/services/pairingAdvisor/readiness/sessions.ts`

Existing advisor-only validator:

10. `server/services/pairingAdvisor/validation.ts` — extracted deterministic candidate
    checks for reuse before review; existing complete-response behavior is preserved
    and covered by the unchanged regressions. No frozen Phase 1 validator was edited.

New standalone verification:

11. `server/tests/pairingAdvisorReadiness/authoritySafety.test.ts`
12. `server/tests/pairingAdvisorReadiness/execution.test.ts`
13. `server/tests/pairingAdvisorReadiness/fixtures.ts`
14. `server/tests/pairingAdvisorReadiness/isolation.test.ts`
15. `server/tests/pairingAdvisorReadiness/jest.config.cjs`
16. `server/tests/pairingAdvisorReadiness/providers.test.ts`
17. `server/tests/pairingAdvisorReadiness/strictResolverContract.test.ts`
18. `server/tests/pairingAdvisorReadiness/transport.test.ts`
19. `server/tests/pairingAdvisorReadiness/tsconfig.json`

Documentation:

20. `docs/pairing-advisor-readiness-offline-ac.md`
21. `.agents/memory/pairing-foundation-release-boundary.md` — approved scope/stop rule.

## Unresolved risks and next approval

The following are **required before any future live/customer activation**, not
demonstrated production regressions and not new authorization:

1. Review this offline checkpoint before approving any D–F scope or live integration.
2. Separately approve exact real-provider adapters, trustworthy physical-attempt
   accounting/SDK retry configuration, semantic-review quality evaluation, live
   execution ceilings and a bounded account/data/cost test matrix.
3. Separately approve real strict-owner/scanner binding and verify real data,
   database permissions, import side effects and source completeness without writes.
   Mock transactions prove control flow, not live database enforcement.
4. Resolve the intended production continuity policy before using session-local risk
   memory across restarts, workers, login changes or expiration. No durable health-data
   storage is assumed or authorized here.
5. Any frontend connection, existing-screen replacement, real authentication journey,
   customer rollout or publishing remains a separate approved milestone.

Real conversational understanding, multilingual accuracy, culinary recommendation
quality, clinical semantic judgment, real cancellation behavior and live latency/cost
remain **unverified**. Prompt contracts and mocked pass/fail verdicts are not proof of
those properties. Stop here for review; the advisor remains unactivated.
