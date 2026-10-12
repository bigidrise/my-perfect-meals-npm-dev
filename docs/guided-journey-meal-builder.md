# Personal General Nutrition guided workflow — Development only

## Status and boundaries

The Builder integration is implemented, but **not fully cleared**. The canonical
autosave path exposes a reliable server boundary. The native **Save Plan** button
uses a legacy in-memory API; its success alone is not proof of a persisted,
account/week-scoped General Nutrition plan. That behavior has not been changed.
Authenticated browser/mobile verification was blocked by the browser service.

Only the account holder's selected, authorized personal General Nutrition Builder
is supported. Performance mode, other Builders, household and professional
subjects, organizations, guests, sandbox/reviewer accounts, and Production are
excluded. No migrations, generation/formula changes, subscription/authorization
changes, automatic Builder selection, new guidance-owned saves, or publishing.
Change 8 was not started.

## Placement and candidates

The native Creator, Favorites and picker dialogs retain their existing generated/
selected/favorited presentation and actions. Those states alone never establish
saved-plan evidence. Guidance does not insert an extra Add or Save action.

The local board is inspected using the existing weekly-board schema. A recognized
placement has an ID and title/name in a supported slot, with dates inside the
active Monday-to-Sunday week; modern `days` take precedence over legacy `lists`.
The guide retains an ephemeral opaque comparison of positions and recipe identity/
content, not recipes or nutrition details in progress. Image-only upgrades do not
change that comparison. A cached/local placement is explicitly unconfirmed until
the server proof matches.

## Save confirmation

1. `useWeeklyBoard.save` emits optional pending/success/failure observations around
   its existing awaited PUT. The original body, idempotency behavior, cache update,
   return contract and error propagation stay intact.
2. `boardApi.saveWeekBoard` observes the native manual action without changing its
   legacy route/body/result. This is a wake-up, **not a persistence receipt**.
3. Fresh self-only journey progress must recognize an authorized General Nutrition
   saved plan from the existing database repository.
4. A no-store GET of the canonical `/api/weekly-board` in the `generalNutrition`
   namespace validates the returned schema, exact week, exact namespace and
   `subjectId` against both the progress actor and subject. Only `source: db` with
   a valid meal placement qualifies. Cached/seed responses do not qualify.
5. The verified placement must match the visible local food identity before the
   completion offer is shown. Changed drafts cannot borrow a previous recipe's
   saved slot ID. Pending and failed operations suppress completion.

Concurrent saves have separate private operation identities: an earlier success
cannot clear a later pending request, and a later success cannot mask a failure
in the same overlapping cycle. Retry re-reads evidence only; it never saves.

The canonical GET retains its existing create-empty-if-missing behavior. Guidance
does not add a new endpoint, meal record, PUT, or independent autosave; native
Builder loading already uses this endpoint.

## Existing plans and destination

Existing matching database plans count without another generation or Save Plan
click. With an empty current board, the progress endpoint's historical saved-week
metadata is checked against that exact canonical board. An unconfirmed local draft
cannot be mistaken for that historical saved placement.

After confirmation, the user may manually open the existing explanation component:

* **Title:** Your Meal Plan Is Saved
* **Message:** You've added your first meal to your plan. You can come back to your
  Meal Builder anytime to add, replace, or change meals.
* **Primary:** Open My Plan
* **Secondary:** Go to Dashboard

Both actions recheck current account, access/progress, scope and saved evidence.
Open My Plan uses `/general-nutrition-builder/build?week=<confirmed Monday>&view=week`
so the saved week's meal slots, not an arbitrary empty day, are visible. These
query handoffs are Development-only and leave ordinary week navigation unchanged.
The introduction's Continue in Builder simply closes and returns to the native
board; it does not restart generation, navigate, or save.

## Context, preferences and presentation

Scope includes account, role, assignment/access, workspace, household, professional
client, planning week and Performance mode. Live and captured generation identities,
request versions and aborts reject stale callbacks/results including A → B → A.
The separate returned server subject/namespace prevent a changed authenticated
request from donating another account's board evidence.

The existing preference store and presentation coordinator remain authoritative.
Offers are manual even when paused or automatic explanations are disabled. Replay
does not reset saved work. Existing dialog priority blocks launch and withdraws
guidance when needed; no native interaction is dismissed by guidance. The inline
section uses normal document flow and wrapping, minimum-height controls.

## Verification

**190 checks passed across six focused suites:** 47 new plus 143 retained.
The final run passed all six suites together: 47 meal-board tests and 143 retained
tests. Scoped TypeScript checking and the served native Builder module (HTTP 200)
also passed after the final changes.

```sh
npx jest client/src/hooks/__tests__/guidedJourneyMealBoard.test.tsx \
  client/src/hooks/__tests__/guidedJourneyWorkflow.test.tsx \
  client/src/hooks/__tests__/guidedJourneyExplanation.test.tsx \
  client/src/hooks/__tests__/useGuidedJourneyDashboard.test.tsx \
  client/src/lib/__tests__/guidedJourneyPreferences.test.ts \
  client/src/lib/__tests__/guidedWorkflowNextStep.test.tsx \
  --runInBand --globals='{"ts-jest":{"isolatedModules":true}}'
```

Coverage includes no plan/candidate-only states, cached/unsaved placement,
canonical autosave and matching manual wake-ups, native/confirmation failure,
existing/historical plans, exact subject/namespace/week rejection, expired/wrong
contexts, account/week/household switching, overlapping saves, read-only Retry,
manual completion/navigation, pause/off/replay, and generic modal priority.

Scoped TypeScript checking passed using the ignored local verification config.
Native Builder syntax transpilation and `git diff --check` passed. The full root
release type gate was not rerun; the prior unresolved bounded-run limitation and
unchanged baseline remain. Safe Development restart confirmed port 5000 serving,
with maintenance/migrations suppressed.

The bounded authenticated Chromium continuation failed before any page interaction:
`EXECUTION_TIMEOUT: Script execution blocked the event loop`. It made no requests/
mutations and produced no new screenshots/assertions. Thus Change 7 native placement,
touch layout, actual modal conflicts and the Change 6 mobile Retry spacing are **not
browser-cleared**. A separate signed-out public preview capture showed only the
startup spinner, not a settled-page or feature verification.

Safari/WebKit, physical iOS, all critical/headless interactions and real-account
end-to-end database persistence are not cleared. Test receipts used synthetic mocks.

## Required before Production

* Separately approve correcting the native legacy Save Plan persistence path. A
  successful manual-only memory save cannot independently finish Stage 3. Matching
  canonical data already saved by autosave can still be recognized after that action.
* Complete the authenticated mobile General Nutrition journey and Change 6 Retry
  pointer check in a working browser session; retain wider device/modal limits.
* Resolve the existing release-type gate before making a Production-clean claim.

## Exact files changed

Application/test:

* `client/src/components/guided/GuidedMealBoard.tsx`
* `client/src/hooks/useGuidedPersonalMealBoard.ts`
* `client/src/hooks/useGuidedJourneyDashboard.ts`
* `client/src/hooks/useWeeklyBoard.ts`
* `client/src/lib/guidedJourney/mealBoard.ts`
* `client/src/lib/boardApi.ts`
* `client/src/pages/pro/GeneralNutritionBuilder.tsx`
* `client/src/hooks/__tests__/guidedJourneyMealBoard.test.tsx`

Documentation/context:

* `docs/guided-journey-meal-builder.md`
* `docs/guided-journey-workflow-handoffs.md`
* `.agents/memory/guided-journey-authority.md`

Local, ignored verification-only configuration:
`.local/validation/guided-journey-meal-board.tsconfig.json`.
