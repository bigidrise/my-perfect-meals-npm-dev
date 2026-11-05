# Ask Chef navigation restoration — Development handoff

## Scope and restrictions

Reconciled the approved navigation and formatting approach from candidate
`55c5ce655` with current Development. This was not a wholesale candidate copy.
Production was not modified. No branch/worktree, commit, push, merge, reset, or
deployment was performed. Release metadata and the reviewed TypeScript baseline
were not refreshed. Subscription entitlements and clinical guardrails were not
changed. Feature Intelligence retains its separate activation gate.

## Delivered behavior

- Registry-recognized feature names render bold without requiring model-authored
  Markdown; ordinary words and existing formatting remain intact.
- Whole explicit named commands bind existing, available destinations even if the
  model supplies defective action metadata. Input/model care handling still wins.
- A fresh stored offer supports “Okay, take me there.” without another permission
  question. Original offer timestamps survive confirmation; expiry is 30 minutes.
- Navigation state includes `performedAt`. An Open button alone is not evidence
  of navigation. Frontend message IDs identify the receipt source; receipts follow
  a matching browser route and remain scoped to the authenticated owner,
  conversation, destination, and original offer.
- Click-time server authorization remains required. Denied or wrong-route
  responses do not navigate or generate a performed receipt.
- Diabetic Meal Builder opening requests offer **Open Meal Builders** at
  `/builders`, with instructions to select the builder available to that member.
  No direct clinical destination or universal professional-access requirement was
  added. Educational questions do not grant navigation consent.
- Approved conversation reliability, correlation, history, food-screening and
  response contracts apply independently of development/production compilation.
  Clear-conversation deletion uses the candidate's transactional approach.

## Required request coverage

| Request | Checked behavior |
| --- | --- |
| Take me to Restaurant Assistant. | Structured existing `restaurant_guide` action; Restaurant Assistant name retained; browser route `/social-hub/restaurant-guide`. |
| Take me to Beverage Creator. | Structured `beverage_creator` action; browser route `/lifestyle/beverage-creator`. |
| Okay, take me there. | Fresh Beverage Creator offer becomes a confirmed action; original expiry retained. |
| Take me to the Diabetic Meal Builder. | Structured `meal_builders` action; **Open Meal Builders**; browser route `/builders`. |
| What is the Diabetic Meal Builder used for? | Reviewed explanation; no Open action or invented universal professional prerequisite. |
| I have diabetes and want to prepare dinner at home. | Does not infer builder consent or clinical assignment merely from diabetes and dinner intent. |
| Can I ignore my carb limits tonight? | Does not grant permission to disregard clinical limits or manufacture a navigation action. |

Server tests inject synthetic provider output, including defective action metadata.
They are evidence of response-contract enforcement, not live model judgment.
Clinical escalation and unavailable-destination checks remain covered.

## Verification results

| Check | Result |
| --- | --- |
| Targeted regressions | **971 tests across 23 suites passed**, using the latest result for each suite. The expanded run passed 969/971; after correcting the last two obsolete expectations, both affected suites passed all 22 tests on their focused rerun. No tests were skipped or deleted to obtain this result. |
| Receipt persistence/isolation | Real in-memory PGlite SQL tests; no application database writes. |
| Server TypeScript | `tsc -p tsconfig.server.json --noEmit` passed. |
| Safety TypeScript | `npm run check:safety-types` passed. |
| Full-root release type gate | **FAILED**: checker reports 110 normalized diagnostic entries versus the stored 118-entry baseline. No reported diagnostic points to a changed file. The baseline was left untouched; this is not a clean release-gate result. |
| Production client compilation | `npm run build:client` passed. |
| Production server compilation | `npm run build:server` passed. |
| Patch whitespace | `git diff --check` passed. |
| Development availability | Managed application restarted after runtime changes; proxied health request succeeded. Anonymous screenshot rendered the sign-in landing page. |
| Mobile browser verification | Passed at 390×844 using real Vite-imported `CoachBubble`/`CoachFeatureAction` components and synthetic auth/API responses; real destination pages/routes rendered. |

Browser coverage included direct Restaurant Assistant and Beverage Creator
navigation, pending-versus-confirmed Beverage behavior, the Meal Builders parent
handoff, prose-only/no-action cases, synthetic 403 denial, and a wrong-route
response. Performed requests occurred only after the matching pathname; denied
and wrong-route cases produced no receipt.

### Remaining blocker and evidence limits

The full-root release type gate requires a separately reviewed resolution before
treating this workspace as release-gate clean. Passing compilation does not erase
that failure, and a lower diagnostic count is not approval to refresh its baseline.

The browser's real anonymous auth refresh returned 401. Browser verification
therefore used permitted synthetic authentication and coach responses. It did
not send a real chat message, invoke a paid model, create an account, or write
shared application data. It proves component behavior and browser route ordering,
not authenticated end-to-end server/model quality. Some destination content was
dimmed by the existing Copilot overlay.

The founder retains GitHub synchronization and Production publication.

## Changed files

### Client

- `client/src/components/coaching/CoachBubble.tsx`
- `client/src/components/coaching/CoachFeatureAction.tsx`
- `client/src/components/coaching/chefResponseText.tsx`
- `client/src/lib/chefConversationReliabilityGate.ts`
- `client/src/pages/CoachsCorner.tsx`

### Server and shared runtime

- `server/routes/coachingEngine.ts`
- `server/routes/coachingNavigation.ts`
- `server/services/coaching/adapters/cornerAdapter.ts`
- `server/services/coaching/clearConversation.ts` — new
- `server/services/coaching/conciergeConversation.ts`
- `server/services/coaching/conciergeGoal.ts`
- `server/services/coaching/conciergeInstructions.ts`
- `server/services/coaching/conciergeNavigationContinuity.ts`
- `server/services/coaching/conciergeNavigationState.ts`
- `server/services/coaching/conciergeReplyScreening.ts`
- `server/services/coaching/conversationReliability.ts`
- `server/services/coaching/engine.ts`
- `server/services/coaching/featureUsageKnowledge.ts`
- `server/services/coaching/navigationReceipt.ts` — new
- `server/services/coaching/platformKnowledge.ts`
- `server/services/coaching/verifiedNavigation.ts` — new
- `shared/coaching/navigationGuidance.ts` — new
- `shared/coaching/types.ts`

### Regression tests and fixture

- `client/src/lib/__tests__/coachBubble.test.tsx`
- `client/src/lib/__tests__/chefApprovedNavigationActions.test.tsx` — new
- `client/src/lib/__tests__/chefFeatureEmphasis.test.tsx` — new
- `server/tests/chefApprovedNavigationRestoration.test.ts` — new
- `server/tests/chefConciergeTruth.test.ts`
- `server/tests/chefConversation.test.ts`
- `server/tests/chefConversationPurpose.test.ts`
- `server/tests/chefConversationReliability.test.ts`
- `server/tests/chefConversationRoutes.test.ts`
- `server/tests/chefFallbackReliability.test.ts`
- `server/tests/chefFoodCompatibility.test.ts`
- `server/tests/chefFoodDestinationKnowledge.test.ts`
- `server/tests/chefGenericMealIntent.test.ts`
- `server/tests/chefHandoffStyle.test.ts`
- `server/tests/chefNavigationReceipt.test.ts` — new
- `server/tests/chefNavigationState.test.ts`
- `server/tests/chefOccasionHandoff.test.ts`
- `server/tests/chefReplyScreening.test.ts`
- `server/tests/chefResponseStrategy.test.ts`
- `server/tests/coachingNavigation.test.ts`
- `server/tests/menuChefAccessMatrix.test.ts`
- `server/tests/fixtures/chefNavigationReceipt.worker.cjs` — new

Existing frontend page/clear-conversation suites were also executed unchanged.
Old expectations that restricted approved reliability to Development or treated
model-authored handoff wording as authoritative were reconciled rather than
removed. The 30 original retained policy paragraphs still match their original
fingerprint; mandatory food-screening instruction bytes remain protected. The
platform-guidance fingerprint change is checked against the prior fingerprint
with only the already approved Restaurant Assistant rename reversed.

### Handoff and durable product instruction

- `docs/ask-chef-navigation-restoration-development.md` — this report
- `.agents/memory/ask-chef-parent-navigation.md` — founder's diabetic parent-page
  handoff rule, without changing the existing Grocery Coach rule
