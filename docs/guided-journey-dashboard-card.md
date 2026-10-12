# Getting Started Dashboard card — Development only

## Approved scope

The compact card sits in `DashboardNew.tsx`, after the introductory hero and
before Nutrition Personalization Summary. It is a control center, not a
walkthrough. No explanatory modals, automatic navigation, database/schema changes,
nutrition changes, access/subscription changes, or Production activation are added.
Explanatory modals still require separate approval.

## Evidence and eligibility

The card reads the existing authenticated, self-only
`GET /api/guided-journey/progress` with `cache: no-store`. It validates the
response version, shape, account/self scope, ordered stages, and evaluator
consistency before showing completion. Local preferences never supply completion.

* Saved onboarding, targets, and meal-plan evidence supply stage states.
* Complete stages say Completed; the first pending stage says Current; later
  incomplete stages say Remaining. Ambiguous stages say Needs check.
* The meal-plan stage is omitted when the server marks it not applicable;
  Free/unavailable meal planning therefore has two stages, not a paid requirement.
* Unknown evidence, failed reads, missing Builder assignments, unsupported
  Builders, and unverified access do not authorize Continue Setup.
* No General Builder is selected by default, no assignments are changed, and no
  target is recalculated. Ambiguous records are not treated as empty/incomplete.
* Guests, reviewer/demo/sandbox accounts, professional identities, nonpersonal
  workspace contexts, and household subjects do not receive personal guidance.
* The build gate uses the existing Vite Development flag. Production builds
  cannot display the card, request its endpoint, or write these preferences.

Account/access/assignment, workspace, location, and household changes invalidate
visible progress immediately. Old requests and button callbacks are rejected,
including A → B → A account-switch races. Old preference stores are disposed.
The effect lifecycle also handles Development React StrictMode.

## Manual controls

* **Continue Setup** refreshes the existing signed-in profile and then re-reads
  progress before navigating. Only known existing onboarding, calculator, or
  General Nutrition routes are permitted. A newly completed task, downgrade,
  assignment change, lost session, failed read, or workspace switch cancels the
  navigation. Existing route guards and onboarding redirects remain authoritative.
* Manual continuation may initialize a not-started preference, but preserves a
  deliberate pause and disabled automatic explanations. Explicit Resume is
  separate.
* **Pause / Resume Guidance** update the existing account-scoped preferences.
* **Disable / Enable Automatic Guidance** change only that presentation choice;
  enabling does not silently resume a paused journey.
* **Restart Guidance** records replay intent. The card explicitly says explanatory
  modals are not enabled yet. It neither navigates nor clears saved work.
* **Retry** repeats an unavailable/blocked progress read, without assuming success.

The compact native Guidance controls disclosure is keyboard accessible and
contains no custom popover or dialog. Storage issues remain visible as
nonpersistent choices; browser preferences are local-device, not cross-device.

## Capability gaps retained, not expanded

1. Only General Nutrition has a saved-board adapter. Other Builders remain
   unresolved rather than silently using General Nutrition.
2. The foundation's missing-Builder suggestion is not navigation permission:
   the current progress is unknown, so this card does not route to selection.
3. Ambiguous targets, failed reads, and bounded-history uncertainty require a
   successful authoritative read, not a new repair/recalculation workflow.
4. Professional, Organization, and household guidance require their own adapters.
5. Restart can request replay; actual explanatory modals are not implemented here.
6. The existing project-wide TypeScript baseline mismatch still requires review
   before Production. This change neither repairs unrelated diagnostics nor
   refreshes the baseline.

## Verification

Focused fixtures use the real pure server completion service with synthetic
repository records; no database reads/writes or real accounts are needed.

```sh
npx jest client/src/hooks/__tests__/useGuidedJourneyDashboard.test.tsx \
  client/src/lib/__tests__/guidedJourneyPreferences.test.ts --runInBand \
  --globals='{"ts-jest":{"isolatedModules":true}}'
```

Coverage includes fresh/complete accounts, Free/paid stage counts, actual saved
plan evidence, paused/disabled preferences and reloads, manual routes, fresh
access and assignment checks, failed reads/retry, double clicks, account-switch
races, stale controls, workspace exclusions, scope/schema validation, and
Development-only behavior.

A narrow TypeScript configuration in `.local/validation/` checks the new card,
hook and helper modules with the existing project compiler options. It does not
claim a passing project-wide release gate.

Browser verification uses synthetic intercepted profile/progress responses and
the real UI, without creating accounts or submitting real application writes.
It is UI/route verification, not evidence of a live authenticated customer's
database state.

Results: **44 card/integration checks + 35 preference checks passed (79 total)**.
The narrow TypeScript check passed. The existing Development workflow was
restarted with its safe maintenance-suppression flags.

The browser pass confirmed the existing fresh-account onboarding redirect;
three-stage paid and two-stage Free cards; completed state; local preference
controls and reloads; failed read/retry; fresh profile/progress requests before
manual navigation; and mobile/desktop rendering. At 390px there was no horizontal
overflow, and keyboard focus was visible. All real API mutations were blocked.

Browser limitations: Nutrition Personalization Summary did not render without
its authenticated data response, so relative order against that summary was
verified from the Dashboard source, not the browser. The synthetic `PAID_FULL`
account without a paid plan key also showed the existing header's Free badge;
this does not verify real billing presentation. The Free fixture's existing
app-wide upgrade dialog was dismissed without buying or changing anything.
Those unrelated surfaces were not changed.

## Exact application/test files

* `client/src/pages/DashboardNew.tsx`
* `client/src/components/dashboard/GettingStartedCard.tsx`
* `client/src/components/dashboard/GettingStartedCardView.tsx`
* `client/src/hooks/useGuidedJourneyDashboard.ts`
* `client/src/lib/guidedJourney/dashboardModel.ts`
* `client/src/lib/guidedJourney/dashboardScope.ts`
* `client/src/lib/guidedJourney/progress.ts`
* `client/src/hooks/__tests__/useGuidedJourneyDashboard.test.tsx`

The server foundation and preference implementation are unchanged.

Documentation/context changes:

* `docs/guided-journey-dashboard-card.md`
* `docs/guided-journey-foundation.md`
* `docs/guided-journey-preferences.md`
* `.agents/memory/guided-journey-authority.md`

Local-only verification configuration:
`.local/validation/guided-journey-card.tsconfig.json` (ignored by Git).
