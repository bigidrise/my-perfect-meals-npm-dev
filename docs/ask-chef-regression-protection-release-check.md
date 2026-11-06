# Ask Chef — regression protection and release readiness

## Decision: NOT READY

Verified in the Development workspace on November 5, 2026, America/Chicago
(November 6 UTC). This is verification of the existing candidate, not authorization
to release it.

**Blocking findings:**

1. The safety TypeScript check fails with `TS2366` in
   `server/services/coaching/conciergeGoal.ts:15`: `goalFits` promises a boolean
   but its switch does not return for the newly expanded destination union.
2. The root release-type fingerprint fails: reviewed local baseline **118**
   diagnostics versus **111** current diagnostics, with a different fingerprint.
   A lower count is not a passing result. GitHub Production has a separately
   reviewed **110**-diagnostic baseline; it must not be blindly overwritten or
   substituted for a review of the current output.
3. **47 existing assertions remain red** after the new protection tests pass:
   all 45 historical failures and two additional stale post-expansion checks.
   Their first failing assertions are explained below; none were disabled,
   rewritten, suppressed or made green by changing an existing baseline.
4. Development is missing Production-only corrections. Preserve those changes
   during founder-managed synchronization and validate the resulting candidate.

No application feature, route, runtime prompt, authorization rule, receipt
implementation, database record, release flag or baseline was changed in this
verification. No Git commands, branches, worktrees, commits, pushes, merges,
resets or deployments were performed.

## 1. Approved functionality verified

The verification uses the actual conversation processor, navigation handlers,
DOM renderer and receipt SQL, with synthetic identities and explicit provider
fixtures. It does **not** establish live-model intent accuracy, live Stripe
entitlement resolution, or a fresh authenticated browser conversation.

| Approved behavior | Evidence and result |
|---|---|
| Automatic bold feature names | `chefFeatureEmphasis.test.tsx`: **4 passed**, including boundary handling, Markdown and non-executable formatting. Rendered action tests also passed. |
| Concise destination recommendations | `chefConciseNavigation.test.ts`: **342 passed** in its final run, covering Development and Production runtime settings. |
| Destination questions have no premature button | Each of the 36 registered destinations is exercised as an offer without an action; exact business-start wording is now additionally pinned. |
| Acceptance produces directions and button, then stops | All-destination acceptance tests assert the verified text, one action, original offer timestamp and no further permission question. |
| Direct commands produce an immediate navigation action | Reviewed canonical names and existing aliases are exercised through the real processor. This means an offered action, not automatic browser navigation. |
| Brief feature explanations | Explanation-versus-consent cases pass; ordinary nutrition advice is not truncated into a feature pitch. |
| Implemented continuity | `chefNavigationState.test.ts`: **91 passed**. Covers stored offers, history/summary wiring, relevant informational continuations, expiry and performed-state distinctions. This is not certification of the planned natural-language decision system. |
| Existing names and aliases | Reviewed alias cases pass. Proposed new partial names are not treated as already implemented. |
| Short acceptance replies | Existing “Yes” cases and the added “Take me there” case retain the selected stored destination, even with a conflicting injected model suggestion. |
| Receipts and 30-minute expiry | `chefNavigationReceipt.test.ts`: **2 passed**, including in-memory PostgreSQL policy checks. Navigation-state and route tests additionally cover authentication, ownership, expiry and exact destination binding. No shared database was used. |
| Click-time subscription authorization | `coachingNavigation.test.ts`: **136 passed**, including denied access, current access guards, fixed routes and the approved Meal Builders entry. Tests use fixture identities, not live paid accounts. |
| Clinical safety and builder restrictions | Care/red-flag suppression and existing access matrices pass. `menuChefAccessMatrix.test.ts`: **66 passed**; `chefBudgetEnforcement.test.ts`: **39 passed**. Navigation remains to Meal Builders, not an invented clinical-builder deep link. |
| Business Suite versus Business Organization | Separate IDs and routes pass: `/business-center` and `/business-organizations`. Accepting one does not switch to the other. |
| Individual destinations | All-destination tests preserve direct registered entries. The two approved modal exceptions remain Dashboard parent handoffs without automatic modal opening. |
| Unavailable features remain unavailable | Missing-tool cases and the unregistered Pregnancy/AI Pairing Advisor destinations remain blocked. |
| Client-side authorization failures | `chefApprovedNavigationActions.test.tsx`: **24 passed**. Route mismatches and authorization errors do not navigate or fabricate successful receipts. |
| Restored navigation presentation | `chefApprovedNavigationRestoration.test.ts`: **36 passed**; `chefConversationPage.test.tsx`: **43 passed**. |

A screenshot of `/coach-corner/home` reached the expected unauthenticated landing
page, with an expected authentication 401 rather than a blank application.
It does not verify the protected Chef conversation. Earlier authenticated
14-destination browser checks are historical evidence, not a new browser pass.
They used synthetic assistant navigation messages, not live-model reasoning.

## 2. Permanent regression protection

Extended `server/tests/chefConciseNavigation.test.ts` without removing existing
checks. Three new cases run under each of the two runtime settings:

1. Exact **“Where do I start a business?”**: Business Suite offer, no button.
2. Exact **“I want a drink”**: preserve an injected appropriate clarification,
   without selecting a destination or presenting a button.
3. Exact **“I need a post-workout shake”** with a valid workout goal: offer
   Athlete Beverage Creator; **“Take me there”** then uses that stored destination,
   not a conflicting injected Beverage Creator suggestion.

These are **six additional automated executions**, not six new live-model
understanding claims. Both drink scenarios explicitly fixture the model output.
The tests protect the processor's handling of that output.

The remaining requested cases were already covered and passed:

- Business Suite acceptance and direct opening.
- Separate Business Organization direct opening.
- “Take me to the Diabetic Meal Builder” through the approved Meal Builders entry.
- Restaurant Assistant direct opening.
- Existing name/alias handling, bold formatting, unavailable destinations,
  clinical precedence, receipt integrity, expiry and access denial.

Added opt-in test-only setup:
`server/tests/helpers/askChefReleaseIoGuard.cjs`.
It blocks external sockets/fetches while allowing HTTP fixtures owned by the
test process. It is not an application setting and does not change the default
Jest configuration or weaken authorization mocks.

### Reproduction

Use the existing Jest configuration with isolated transpilation and the two
setup files:

```sh
./node_modules/.bin/jest --runTestsByPath \
  server/tests/chefConciseNavigation.test.ts \
  --runInBand --forceExit \
  --globals='{"ts-jest":{"isolatedModules":true}}' \
  --setupFiles ./server/tests/testEnv.setup.ts \
  ./server/tests/helpers/askChefReleaseIoGuard.cjs

npm run check:safety-types
npm run check:release-types
```

The broad verification reran the same **39 suite paths** recorded in the
historical `/tmp/chef-concise-final.json` result, not a new project-wide selection.

## 3. Test and type-check results

| Check | Actual result |
|---|---|
| Historical wider run | **1,457 passed / 45 failed**, 39 suites, 1,502 tests. |
| Current broad verification after HTTP-fixture guard correction | **1,774 passed / 49 failed**, 29 passing and 10 failing suites, 1,823 tests. Includes expanded destination coverage and six new executions. |
| Final focused concise-navigation check | **342 passed / 0 failed**. Two of the broad run's failures were new assertions that overconstrained the permitted concise offer wording; corrected only those new assertions, then verified the complete suite. |
| Outstanding after that focused correction | **47 assertions**: the same 45 historical failures plus two existing checks invalidated by the approved destination expansion/deduplication. This is a reconciliation of the two runs, not a claim that a final single broad invocation returned 47 failures. |
| Strict safety types | **FAILED**, exit 2: `conciergeGoal.ts(15,65)`, TS2366. |
| Root release-type gate | **FAILED**, exit 1: 118 reviewed diagnostics versus 111 current diagnostics and a different fingerprint. |
| Generated build metadata | The type-check wrapper restored `client/src/buildVersion.ts` byte-for-byte against its pre-check backup. |
| New client/server production builds | Not rerun. Existing historical build passes cannot override the current failing release gates. |

The first offline-guard trial incorrectly blocked local HTTP fixtures and is
not counted as evidence of application regressions. The guard was corrected to
recognize synchronously bound fixture ports and permit their fetch requests.
The final broad log contains **zero external-I/O-blocked messages**.
The two new wording assertions were setup mistakes in this verification, not
customer-facing failures. All original assertions remain unchanged.

## 4. Investigation of the historical 45 failures

All 45 reproduce. “Historical” here means present in the saved prior run,
**not** proven to predate every approved Ask Chef change.

| Suite | Historical failures | First-failure diagnosis |
|---|---:|---|
| `chefGuidedChoice` | 16 | Old long handoff text, literal prompt clauses, Production-only instruction expectations, and a 20-destination count. |
| `chefMemberContext` | 2 | Expects the original raw Production prompt rather than the current approved conversation instruction selection. |
| `chefPurposefulFollowThrough` | 4 | Old environment-specific prompt/closing behavior expectations. Requires contract review, not disabling the checks. |
| `chefChoiceClarity` | 12 | Old handoff wording, Production-only prompt expectation and a 20-destination count. |
| `chefConversationalStyle` | 5 | Requires the entire previous prompt text to be embedded; the current strategy replaces/reconciles those clauses. |
| `chefFeatureUsage` | 1 | Pins the registry at 20 destinations instead of the approved 36. |
| `chef-path-diet-override.integration` | 5 | Development assertions lag behind corrections already present in GitHub Production; details below. |
| **Total** | **45** | **40 legacy contract assertions + 5 meal-path assertions.** |

The 40 legacy first failures break down as **21 handoff wording**, **9
environment/prompt-selection or closing**, **7 literal prompt-clause**, and
**3 fixed registry-count** expectations.

These first failing assertions conflict with the candidate's changed contracts;
that does not prove every later assertion in those tests would pass after a
reviewed update. Keep them visible until the founder approves their alignment.
Do not restore unwanted tutorials or obsolete destination counts just to pass.

### Five meal-path failures

The current `server/services/unifiedMealPipeline.ts` is **byte-identical** to the
file at the inspected GitHub Production commit. Production already changed all
five failing expectations in its correction commit:

| Development expectation still failing | Current implementation / GitHub Production expectation |
|---|---|
| Unmatched explicit fat maximum must reject the recipe | Bounded repair followed by honest unmatched-target feedback, not a fabricated compliance claim. |
| Overage text must contain “9g over” | Structured projection still carries the nutrient/grams; current sentence says “9 over”. |
| An unmatched at-most carbohydrate request must reject | Preserve the request and disclose the unmatched per-serving estimate after repair. |
| Total-carbohydrate mismatch must reject | Report total carbohydrates, not only starch, with honest unmatched-target feedback. |
| Legacy zero-starch daily allowance must always hard-stop | Daily allowance is guidance, not a new clinical prohibition; actual protocol/allergy rejection remains separate. |

This supports **stale Development tests/missing Production corrections**, not a
new Ask Chef navigation regression. No meal-policy code or tests were changed
here. Production's corrected test file must be reviewed/preserved, not silently
copied over the current tests to make this check green.

### Two additional existing failures

- `chefConciergeTruth`: still asserts Recipe Maker and Daily Journal are absent
  from the destination registry. Their subsequent approved addition invalidated
  that expectation.
- `chefNaturalConversation`: expects Academy in `featureCatalog`.
  `getMemberPlatformCatalog` now deliberately filters registered destinations
  from that third copy; Academy is already represented in available features.
  This first assertion conflicts with deduplication, not evidence that Academy
  is unavailable.

## 5. GitHub Production comparison

Read-only public GitHub REST/raw-content requests succeeded after connector
credentials were withheld. No credentials were exposed and no Git commands or
GitHub writes were used.

- Repository: `bigidrise/my-perfect-meals-npm-dev`
- Inspected GitHub `dev` / common base:
  `3358b4563615d76c8e1dd2ddb90c40d10fa469c0`
- Inspected GitHub `production`:
  `c2176adf7fbb296b60064c16dce7ddf321e353aa`
- GitHub reports Production **7 commits ahead**, zero behind GitHub `dev`.
- **The local tested workspace is not identical to GitHub `dev`.** It contains
  the additional candidate Ask Chef changes.
- Compared **24 targeted paths** byte-for-byte against the pinned base and
  Production revisions: **19 candidate-only changes**, **4 Production-only
  changes**, **1 identical file**, and **zero paths changed on both sides**.

### Candidate-only paths in the comparison

| Area | Files |
|---|---|
| Shared contracts | `shared/coaching/navigation.ts`, `navigationGuidance.ts`, `schemas.ts`, `types.ts` |
| Capability/selection | `server/services/coaching/capabilityRegistry.ts`, `conciergeGoal.ts`, `verifiedNavigation.ts` |
| Conversation/presentation | `server/services/coaching/conciergeConversation.ts`, `conciergeInstructions.ts` |
| State/receipt handling | `server/services/coaching/conciergeNavigationState.ts`, `conciergeNavigationContinuity.ts` |
| Reviewed knowledge | `server/services/coaching/featureUsageKnowledge.ts`, `platformKnowledge.ts` |
| Server routes | `server/routes/coachingEngine.ts`, `coachingNavigation.ts` |
| Client formatting/actions | `client/src/components/coaching/CoachFeatureAction.tsx`, `CoachBubble.tsx`, `chefResponseText.tsx` |
| Regression suite | `server/tests/chefConciseNavigation.test.ts` |

`shared/coaching/askChefRelease.ts` is identical to GitHub Production.

### Production-only changes that must survive synchronization

The workspace still matches the common base, not Production, for:

1. `server/tests/chef-path-diet-override.integration.test.ts`
2. `scripts/release-typecheck-baseline.json`
3. `client/src/pages/physician/DiabeticHub.tsx`
4. `client/src/lib/__tests__/diabeticHubReleaseParity.test.tsx`
   — added in Production and absent locally.

The GitHub comparison also contains
`docs/production-release-blockers-correction.md`, absent locally.
It documents the Production corrections and should be retained.

**Merge risk:** no dual-edited text conflicts were identified in the 24 selected
paths. That is not a performed Git merge, a whole-repository conflict guarantee,
or proof of runtime compatibility. Production-only files and reviewed baseline
history must survive. Do not replace Production with a Development filesystem
copy. The founder should use the established Git workflow and revalidate the
actual combined candidate.

GitHub Production source is not proof of what is currently deployed; no
Production application, database or deployment was accessed or modified.

## 6. Implemented versus still planned

Implemented and protected: approved names/aliases, structured semantic-goal
processing, existing history and recommendation continuity, concise offers,
confirmed/direct actions, formatting, click-time authorization, receipts and
expiry.

Still planned or not established by this verification:

- New partial aliases such as “Craving” and “Diabetic Builder”.
- Consistent boundary-safe matching in the secondary feature-name helper.
- New dog/cat semantic goal support.
- Dedicated pending-clarification metadata, if approved.
- Live-model accuracy for the proposed decision groups, short contextual choices
  and changes of mind.
- The founder's refined cruise-venue versus location-independent buffet guidance.

The requested drink examples now have permanent **processor-contract** tests.
They must not be reported as proof that Phase 2 natural-language intent selection
has been implemented or live-verified.

## 7. Required before Production

1. Authorize a minimal fail-closed return-path correction in `goalFits`, without
   introducing new semantic routing for the added destinations.
2. Review and align the 47 failing assertions with approved behavior while
   preserving ownership, safety, access, receipt and unresolved-choice coverage.
3. Preserve the Production-only corrections through founder-managed Git
   synchronization; investigate the full type diagnostic set before any
   separately approved baseline change.
4. Run the release gates and focused protection tests on the actual combined
   candidate. Current passing navigation tests do not substitute for those gates.

**Recommended readiness: NOT READY. Return to founder review; do not publish.**
