# AI Pairing Advisor: strict account-owner resolution proposal

**Design only. Not implemented or approved for shared-service changes.**

## Current release boundary

Phase 1 pairing routes and scanners remain frozen. Increment 2's application binding
remains unactivated. Synthetic scanner/write-isolation verification does not authorize
live authority, customer records, model calls, frontend work, or Increment 3.

## Required subject invariant

The authenticated account is the advisor's only supported nutrition subject. Resolve
that identity from the existing server authentication result, not chat, request-body
identifiers, household selection, or client-provided completeness assertions.

For an opted-in strict owner request:

1. Owner, subject, and loaded envelope identity must match.
2. No household overlay is selected or queried.
3. A saved `activeHouseholdProfileId` must not suppress owner GLP-1 sources.
4. Every dependent resolver receives that same explicit subject scope.
5. No persisted household selection or clinical record is changed.
6. Existing household requests and existing default callers retain their behavior.

Today `personalSubject: true` satisfies only part of this invariant. The envelope
avoids its household overlay, but `resolveCurrentGLP1MealAuthority` independently
returns no sources for an owner row with `activeHouseholdProfileId`. The prescription
resolver calls the same helper using its own loaded user row. Fixing only the outer
envelope call is insufficient.

## Proposed server-only result contract

Use an explicitly opted-in strict owner entry point, not a change to existing defaults.
API names and types in this section are proposed, not existing exports.

```ts
type SourceOutcome<T> =
  | { status: "resolved"; value: T; basis: "stored" | "calculated" | "approved_default" }
  | { status: "absent"; reason: "successful_empty_read" }
  | { status: "not_applicable"; reason: string }
  | { status: "unavailable"; reason: "read_failed" | "invalid_data" | "unsupported" };

type StrictOwnerResult =
  | { status: "complete"; ownerId: string; subjectId: string;
      scope: "account_owner"; envelope: UserProtocolEnvelope;
      sources: InternalSourceLedger; persistence: "none" }
  | { status: "unavailable"; reasonCode: string; failedSources: SourceKey[] };
```

The ledger is internal server evidence, not a new client DTO or a clinical disclosure.
Its source keys must be a bounded typed set. A non-null envelope, absence of an exception,
or fixture-shaped `required: true` flags cannot construct a real completion receipt.

### Completion rules

- `resolved` requires the existing authoritative calculation or a successful read.
- `absent` requires a successful query that returned no applicable record.
- `not_applicable` requires a positively established source/applicability decision.
- A failed read is never `absent`, `not_applicable`, neutral symptoms, or an empty protocol list.
- An existing legitimate policy default may be `resolved/approved_default` only when its
  applicability is established after a successful read. Catching an outage and choosing
  a default is not equivalent evidence.
- Optional preference failures may remain optional; they never erase required safety failures.
- If a required source cannot be represented faithfully, return unavailable. Do not
  invent a new threshold, disable daily state, or assemble a reduced clinical ruleset.

### Required sources and applicability

| Source | Strict completion requirement |
|---|---|
| Owner identity/profile | Successful exact-owner read; complete allergy, dietary and avoidance inputs. |
| Current GLP-1 activation | Same owner scope regardless of saved household selection; all existing verified-source checks preserved. |
| Personal support choices | Distinguish intentional existing feature gating from a failed read; preserve the support freeze. |
| Provider interventions | Successful owner-scoped read, including a valid empty result; no invented professional authority. |
| Diabetes context | Required where the existing clinical path requires it; preserve attempt identity and glucose boundaries. |
| GLP-1 guardrails | Required for an active applicable overlay; distinguish successful absence/default from database failure. |
| GLP-1 tolerance | All applicable hub, ACE and water reads succeed; preserve existing escalation calculations. |
| Date/timezone | One established owner-local date context for date-sensitive reads; do not conceal a lookup failure as UTC. |
| Competition/performance | Existing calculations retained; applicable derivation errors cannot become omitted context or fallback success. |
| Daily nutrition state | Required where existing resolved policy makes it applicable; preserve ledger and prescription calculations without materialization. |
| Prompt guidance | Existing builders receive the complete resolved context; prompt text itself is not authority evidence. |

These are completeness requirements, not new clinical limits or new product eligibility.

## Exact shared-service change scope for separate approval

| File / function | Proposed narrowly opted-in change |
|---|---|
| `server/services/protocolEnvelope.ts` — `loadUserProtocolEnvelope` | Add strict owner resolution/ledger support; preserve current default signature behavior; distinguish applicable competition/daily-state failure from successful omission. Pass explicit owner/date context to dependencies. |
| Same file — `loadGenerationProtocolEnvelope` | Only if used as the strict entry: forward the new strict context and preserve existing guest/default behavior. Do not add a shortcut that disables required daily authority. |
| `server/services/glp1/currentMealAuthority.ts` — `resolveCurrentGLP1MealAuthority` | Add explicit server-owned scope handling so strict owner mode is not inferred from saved UI selection. Keep existing household suppression and current-source verification for all other calls. |
| `server/services/dailyNutritionState.ts` — `resolveDailyNutritionState` | Carry strict subject/date/completeness context to canonical nutrition-state resolution without changing calculations. |
| `server/services/nutritionStateService.ts` — `resolveDailyNutritionState` | Carry strict context into prescription resolution; use established timezone instead of an indistinguishable fallback; preserve source-transition and exclusion semantics. |
| `server/services/prescriptionResolver.ts` — `resolveDailyNutritionPrescription` | Carry owner scope to GLP-1 activation; in strict mode surface guardrail-read and applicable performance failures instead of claiming a complete fallback. Preserve calculation order and existing default persistence behavior. |
| `server/services/nutritionDayService.ts` — `getUserTimezone` | Only if strict callers cannot supply the already-resolved profile timezone: add an explicit result/read variant without changing the current fallback API. |
| `server/services/myPerfectMenu/developmentNoSave.ts` — pool routing | Separate write-boundary approval: observe PostgreSQL `25006` errors delivered through callbacks as well as promises. Preserve pg overload behavior and unrelated requests. |

No policy rewrite is proposed for `buildUniversalConditionGuidance`, GLP-1 tolerance
calculations, ingredient verification, clinical output checks, alcohol detection, or
Phase 1 pairing validation.

`resolveDailyMedicationTolerance` already accepts date/timezone inputs and rethrows
its hub/ACE/water read failures. Reuse that behavior; do not change it based on stale
"never throws" commentary.

`loadSafetyProfile` / asynchronous `enforceSafetyProfile` need not change for this proposal.
The advisor should keep using the pure check with a successfully resolved owner profile,
not the existing async SAFE-on-load-failure branch.

## Write boundary: verified capabilities and remaining limits

Reuse the existing Development no-save calculation/materialization separation rather
than creating another prescription engine. The advisor remains disconnected.

- Prescription suppression alone is not a general write boundary.
- Every completion must explicitly call `assertNoDevelopmentTestWrites()` after awaited work.
- A helper-only call can return success after a caught blocked write. Verification
  includes that negative control; no shared correction was made.
- A confirmed callback-overload gap remains: a server-side `25006` delivered through
  pg's callback is not counted by the current promise-only observation code, so even
  the completion assertion can miss it. The expected-failure regression records this.
- Deferred audit work remains associated with the request-local state and is blocked
  after release. An already returned result cannot be retroactively failed; strict
  authority code must not use fire-and-forget writers as successful read dependencies.
- Pool routing does not cover another driver/client, session storage, or an external
  provider. Those must remain absent or independently denied.
- Mocked PostgreSQL errors establish adapter behavior, not a real database permissions audit.

Any production use, generalized helper activation, audit-policy change, or broader
persistence refactor requires additional approval.

## Regression scope required with shared-service implementation

Run these only under an independently approved, no-live-I/O harness. Existing suite
names identify affected callers; this proposal does not claim they were run here.

1. **Owner/household matrix:** same owner with no selection, saved selection A,
   saved selection B; same strict envelope/GLP-1 result. Explicit household requests
   retain household restrictions and never inherit owner clinical sources.
2. **Current-source matrix:** selected builder, verified medication, verified provider,
   inactive/ended sources, unverified provider and no source. Preserve exact existing
   relationship checks and Development-versus-Production activation boundaries.
   Existing anchors: `currentGLP1MealAuthority.test.ts`,
   `clinicalGLP1Authority.test.ts`, `protocolEnvelope.medicalConditions.test.ts`.
3. **Nested failure matrix:** fail each required read/calculation independently;
   contrast successful empty reads and inapplicable contexts; never emit complete
   receipts from failures. Include GLP-1 guardrails, competition, timezone and daily state.
4. **Date matrix:** midnight and DST boundaries; one owner-local date in diabetes,
   tolerance, hydration and daily-state dependencies.
5. **Calculation/default-caller parity:** equal prescriptions, macro clamps,
   training modifiers, starch count/timing, exclusions and mid-day source transitions.
   Existing anchors: `prescriptionResolver.test.ts`,
   `nutritionStateService.integration.test.ts`, `nutritionStateBudget.test.ts`.
6. **Shared consumer contracts:** Phase 1 pairing, wine-list, chef pairing and existing
   meal-generation consumers stay unchanged. Existing anchors:
   `developmentPairingFoundation.test.ts`, `aiPairingsProtocolSafety.test.ts`,
   `alcoholRecommendationsProtocol.contract.test.ts`,
   `weekBoard.household.contract.test.ts`.
7. **Write boundary:** promise and callback server errors, caught audit/override errors,
   detached work, concurrent ordinary requests and separate no-save transactions.
   Remove the expected-failure marker only after the callback regression is fixed.
8. **Release boundary:** default application binding remains `ADVISOR_NOT_ACTIVATED`;
   no Production registration, customer-facing fixture results or provider defaults.

## Approval sequence

1. Review this proposal and the synthetic verification evidence.
2. Separately approve the exact strict-owner/shared-service changes and callback fix.
3. Implement and verify those changes offline without activating the application binding.
4. Review evidence again before any real authority/profile execution.
5. Treat model/provider calls, frontend work, live activation and Increment 3 as
   separate decisions. None is authorized by this document.
