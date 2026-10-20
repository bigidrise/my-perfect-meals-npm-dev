# AI Pairing Advisor: approved offline shared-service corrections

## Result

All three corrections are implemented and verified offline. The strict-owner entry
point remains disconnected: no application route, advisor adapter or registrar imports it.
This report supersedes the expected-failure status in the earlier synthetic checkpoint.

## Exact changed files

Shared services:

1. `server/services/myPerfectMenu/developmentNoSave.ts`
2. `server/services/glp1/currentMealAuthority.ts`
3. `server/services/protocolEnvelope.ts`
4. `server/services/dailyNutritionState.ts`
5. `server/services/nutritionStateService.ts`
6. `server/services/prescriptionResolver.ts`

New server-only modules:

7. `server/services/nutritionResolutionContext.ts`
8. `server/services/strictOwnerProtocolResolution.ts`
9. `server/services/strictOwnerRuntime.ts`

Verification:

10. `server/tests/pairingAdvisorSafety/storageStub.cjs`
11. `server/tests/pairingAdvisorSafety/writeIsolation.test.ts`
12. `server/tests/pairingAdvisorSafety/strictOwner.test.ts`

Documentation:

13. This report.
14. `.agents/memory/pairing-foundation-release-boundary.md`
15. `.agents/memory/MEMORY.md`

## Correction 1: callback and promise write accounting

The existing no-save proxy now observes PostgreSQL `25006` before forwarding a
callback. It retains promise observation and counts each invocation at most once.
It copies the forwarding argument array and does not mutate the caller's query config.
Receiver, arguments, callback return, query return and scheduling are covered.

The former expected-failure callback regression now passes as an ordinary test.
Separate attempts, swallowed errors, callback overloads, concurrency, detached work,
rollback and release remain covered.

The public helper does not globally change its completion semantics: its callers
still need `assertNoDevelopmentTestWrites()`. The disconnected strict entry performs
that assertion after awaited resolution.

## Correction 2: explicit strict owner resolution

The new scope is server-created and explicitly opted in. Owner identity and clinical
date are validated through envelope, current GLP-1 sources, both daily-state layers,
and prescription resolution.

Strict GLP-1 resolution ignores the saved household UI selection in an in-memory
projection, reuses one successful activation result per request, and retains the
existing current-source verification query. No household field is persisted.

Normal callers retain their original subject handling. The legacy profile projection
is unchanged; the additional performance-flag read occurs only for strict resolution.
Existing prescription calculations, ordering, clamps, starch settings and defaults
are reused. Prescription materialization is suppressed inside the existing no-save
boundary rather than replacing its calculation.

The runtime gate is a small separate module so tests can emulate Development without
changing environment variables. The entry point refuses execution outside undeployed
Development and has no application binding.

## Correction 3: required-source completeness

The request-local typed recorder distinguishes:

- Successful stored/calculated resolution.
- Established non-applicability.
- Successful empty reads.
- Failed, invalid, unsupported or missing required context.

Required failures are sticky: later defaults or successes cannot erase them.
Unreported required sources prevent completion.

Guardrail outages and applicable performance failures cannot produce a complete
fallback receipt. A successful absence can retain the existing default policy.
Missing required clinical date context cannot become a UTC fallback.
Optional preference failures remain separate and do not block otherwise complete
clinical authority.

The strict entry returns only unavailable metadata on failure, without clinical
values or raw database errors. Complete results and source ledgers remain server-only.

## Final verification

| Suite | Passed | Failed | Expected failures |
|---|---:|---:|---:|
| Existing offline contracts | 114 | 0 | 0 |
| Existing mocked server integration | 96 | 0 | 0 |
| Synthetic safety, write isolation and strict owner | 109 | 0 | 0 |
| Existing current GLP-1 authority unit suite | 8 | 0 | 0 |
| **Total** | **327** | **0** | **0** |

Three focused TypeScript configurations pass: Offline, Integration and Safety.
Root TypeScript still has 121 pre-existing diagnostics, with before/after output
byte-for-byte identical. Initial foreground root checks timed out; the completed
background comparison established the final unchanged diagnostic output.

Coverage includes saved household selections, identity mismatch, current activation
sources and per-request caching, prescription equivalence, legitimate defaults,
required-source failures, optional preference failure, the real daily-state chain,
strict-only performance failure, concurrency, midnight/DST date boundaries, and
callback forwarding/accounting.

Storage is memory-only and installed before real service imports. Network, drivers,
providers and session stores remain guarded. Tolerance and condition-guidance
dependencies are controlled synthetic fixtures in the strict-owner suite; these
tests prove propagation and failure handling, not live clinical interpretation.

## Remaining boundaries and limitations

- Advisor activation and registration of the strict entry remain unauthorized.
- Real customer/profile execution, actual database permissions and live provider
  behavior have not been verified.
- Semantic intent and complete-response model review remain synthetic.
- Active contexts lacking required existing data, including incomplete competition
  context, intentionally remain unavailable rather than being silently omitted.
- No changes were made to clinical formulas, thresholds, activation rules, nutrient
  limits, Phase 1 routes, scanners, frontend, schema or environment configuration.
- No workflow restart, real database access/write, paid call, Production release,
  publishing, deployment, push or merge was performed.

Stopped after the three authorized corrections and verification.
