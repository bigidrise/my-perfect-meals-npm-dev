# Ask Chef: one-confirmation navigation handoff

## Investigation and root cause

The existing path is unchanged: the conversation service returns a structured
presentation; the engine persists that exact response; the next turn reads only
the latest assistant's pending navigation in the owned, open Corner conversation.
The UI needs a confirmed/direct navigation state, matching destination and typed
use-feature action before showing the real navigation button. Clicking still
checks current access through `/api/coach/navigation`.

Two response-contract gaps caused lost or repeated confirmation:

1. A null decision could return ordinary `message` text containing an offer to
   assist/open a workflow. That text carried no pending recommendation. A later
   yes could not legitimately confirm it. The source path and regression fixtures
   demonstrate this; a destination must not be reconstructed from prose.
2. A valid stored recommendation and model-recognized acceptance still failed
   when `handoffMessage` was missing or unusable. The former code rejected the
   action rather than rendering the already-authorized button with known steps.
   A bounded pre-fix live replay reproduced this exact second failure.

The original member conversation's historical raw provider payload was not
queried. The supplied transcript alone does not establish which field was absent
on that original first yes. The report distinguishes the supplied observation,
source-backed defects and the synthetic live evidence.

## Corrections

- Clarified provider field descriptions and model instructions: a feature/workflow
  permission offer and its decision, ready goal and recommendation intent must
  be emitted together. No extra permission-to-help question precedes the actual
  feature offer.
- Added an output-only guard for unstructured permission bridge questions.
  It never examines member yes/no wording, chooses a destination or grants access.
  Normal topic questions, unresolved alternatives and feature explanations remain
  conversational. Malformed unstructured offers fail closed or use a separately
  valid continuation; no extra model call or fabricated pending record is used.
- After semantic acceptance, pending-state validation, goal validation and current
  tool eligibility, missing or repeated handoff wording uses reviewed destination
  starting instructions. If those are unavailable, only the actual existing button
  label is used; controls are not guessed.
- Unsafe links and mismatched destination content remain rejected, not rewritten
  into a handoff. Qualifying direct-open behavior remains unchanged.
- Existing persistence, ownership, open-conversation checks, latest-assistant
  semantics, destination allowlist, subscriptions and click-time access checks
  remain unchanged. No new expiry interval or database state was introduced.
- Emergency/referral handling still precedes navigation recovery. The corrected
  inactive-care-field and duplicate-safety behavior is unchanged.

## Accuracy

Find Meals Near Me is restaurant search. This change does not add or claim
verified dedicated ice-cream-shop discovery, current menu inventory or confirmed
availability of a particular dish. The instructions explicitly retain that limit.

## Tests and observed behavior

Ten focused suites: **688 tests passed**.

Coverage includes:

- Structured permission offer → persisted pending recommendation → one yes →
  exactly one button, in both Development and Production modes.
- Missing, symbol-only or repeated-question handoff variants.
- Unstructured permission offers, including the supplied generic bridge wording.
- Missing, malformed, superseded and consumed pending states.
- Declines, changed goals, direct opens and unrelated discussion.
- Access revoked after the offer; subscription and destination authorization.
- Rejection of unsafe links and mismatched features.
- Existing emergency, referral and ordinary-food safety regressions.
- The actual conversation page, real navigation control and click-time API check.

The final three-turn live replay used these exact member messages:

1. “I want some ice cream.” → ordinary clarification, no navigation.
2. “I wanna go to a restaurant to get ice cream.” → structured pending
   `find_meals_near_me` recommendation, no button yet.
3. “yes” → `navigation_confirmed`, the correct destination and concise starting
   instructions, with no further permission question.

Final live usage: **39,161 total tokens**. There were nine bounded synthetic
provider calls across pre-fix, intermediate and final observations. No saved
conversations, member-account queries, images or destination generation occurred.
The successful final observation is separate evidence from deterministic tests,
not proof that every possible model response is correct.

A mobile screenshot used the actual response bubble and navigation-action
component with built CSS, a fixture router and disabled API calls. It showed no
button before consent and one fully visible button after yes. The authenticated
member page was not accessed through the screenshot browser.

## Changed files

- `server/services/coaching/conciergeConversation.ts`
- `server/services/coaching/conciergeInstructions.ts`
- `server/tests/chefNavigationState.test.ts`
- `client/src/lib/__tests__/chefConversationPage.test.tsx`
- `scripts/smoke-chef-conversation-live.ts` — added the explicit
  `--restaurant-confirmation` scenario; it still requires opt-in for provider use.
- This review and the durable response-authority note.

## Release validation

- Strict safety TypeScript passed.
- Root strict TypeScript matched the unchanged reviewed baseline: 118 legacy
  diagnostics. The baseline was not refreshed; the repository is not claimed
  to be wholly type-error-free.
- Full release validation: **13 passed, zero warnings, zero failures**.
- The existing preview was restarted once after the final code/build batch and
  its proxied health endpoint returned HTTP 200. Existing safe-preview migration
  and maintenance suppression remained intact.

The final local integration SHA is reported in the completion message. No push,
merge, publication, pricing or Production environment change occurred.
