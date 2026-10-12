# Guided Journey workflow handoffs — Development only

## Boundary

Change 6 connects the existing personal OnboardingV3 and Macro Calculator saved
results to a manual **Next Step** offer. It does not finish the Guided Journey,
implement Builder completion guidance, generate meals, activate Production, or
enable automatic explanations. Change 7 requires separate approval.

No questions, safety PIN rules, formulas, native save messages, redirects,
authorization, subscriptions, schema, or resume keys are changed.

## Onboarding recognition

Only the native successful `/api/user/complete-onboarding` branch, after its
existing `refreshUser()`, publishes a Development-only wake-up hint. The hint is
not completion evidence. The authenticated self-only progress endpoint re-reads
the account's real `onboardingCompletedAt`; only a valid server-backed timestamp
counts. An HTTP success without that evidence fails confirmation.

The native trial welcome modal and `/macro-counter?from=onboarding` redirect
remain in control. Interrupted onboarding has no new success signal and its
native resume behavior remains unchanged. Previously completed onboarding counts
from server evidence, without another run of the form.

## Nutrition target recognition

The shared native calculator save helper publishes a hint only after
`setMacroTargets` succeeds. Guest/local-only saves, computation, measurement
entry, and biometric-only saves never establish personal journey completion.
Failure publishes a failed-attempt hint and rethrows the same native error.

Confirmation uses both:

1. Fresh self-only progress: raw calorie/protein/carbohydrate/fat fields must meet
   the existing evidence contract. Missing/ambiguous legacy values stay unknown.
2. For a newly successful calculator save, a no-store GET of the existing
   `/api/users/:id/macro-targets` must match the four submitted numeric targets,
   including a legitimate **zero** carbohydrate value.

The normalized target GET alone cannot distinguish null from zero; the raw
progress evidence is therefore required as well. A failed/mismatched confirmation
removes the offer and exposes Retry Progress Check, not a success explanation.
Once this receipt is confirmed, expected numbers are discarded: future valid
server updates are not pinned to old submitted values. Existing valid targets
count without forcing recalculation or a new save.

Target success is independent of subsequent biometric failures. Existing
`Promise.allSettled`, partial-failure toasts, clean-state marking, profile refresh,
and native completion callbacks remain unchanged. A failed replacement does not
erase previously valid evidence or claim that the latest replacement succeeded.

## Next Step and presentation

An inline offer appears in the native workflows and a manual Next Step action is
available from the Dashboard control center. No save event opens a modal or
navigates. The offer remains manual when guidance is paused or automatic
explanations are off.

Clicking Next Step rechecks the current profile, progress and interaction
priority. It offers the current applicable stage, not stored replay intent:

* Confirmed onboarding → existing nutrition-target explanation/calculator.
* Confirmed targets → existing authorized General Nutrition Builder explanation.
* Completed Free two-stage setup → explicit **Next Step: Dashboard**.
* Already completed setup → Dashboard, without repeating completed activities.

Only the existing supported General Nutrition adapter is used. Unsupported or
conflicting assignments remain unresolved; there is no fallback Builder switch.

The existing explanation and coordinator are reused. Higher-priority dialogs
defer launch and arriving dialogs withdraw guidance, without closing their UI.
Closing preserves session pause; replay and account-scoped preferences remain
separate. Native in-progress saves disable offers/actions.

The native calculator CTA that already redirects to a Builder keeps that
redirect. Guidance does not intercept it, add a Builder-arrival popup, or delay
it for its own confirmation. Inline offers are available when the workflow stays
open and on returning to the Dashboard; Builder-arrival guidance is not Change 6.

## Context and failure boundaries

Generation-scoped requests, aborts and callbacks reject stale account/workspace/
household/navigation results, including A → B → A. Signals are account-scoped
ephemeral wake-ups, not stored completion. Guest, sandbox/reviewer, professional,
organization and household contexts do not receive personal offers. Professional
calculator sessions are explicitly excluded even if legacy workspace storage
says personal.

Optional guidance's blocked-storage/observer failures must not fail native saves.
Failed confirmation never clears server targets or saved onboarding.

## Verification

Focused real-service fixtures and hook tests cover new/existing/interrupted
onboarding, zero-carb and ambiguous targets, saved-value matching, failed saves/
confirmation and Retry, separate biometric failure, Free/paid destinations,
paused/off/manual and replay distinctions, context changes, stale callbacks,
priority blockers, and actual native source integration boundaries.

```sh
npx jest client/src/hooks/__tests__/guidedJourneyWorkflow.test.tsx \
  client/src/hooks/__tests__/guidedJourneyExplanation.test.tsx \
  client/src/hooks/__tests__/useGuidedJourneyDashboard.test.tsx \
  client/src/lib/__tests__/guidedJourneyPreferences.test.ts \
  client/src/lib/__tests__/guidedWorkflowNextStep.test.tsx --runInBand \
  --globals='{"ts-jest":{"isolatedModules":true}}'
```

The focused pass has **143 checks** (32 new and 111 retained). Scoped type
validation uses the ignored `.local/validation/guided-journey-workflow.tsconfig.json`.
The root release-type baseline command did not finish within a bounded 120-second
run. No baseline was refreshed and no project-wide type-clean claim is made.

The Chromium browser pass used stateful intercepted Development fixtures and
native buttons, without real accounts, database access, clinical edits or
forwarded API writes. It verified native Step 11 onboarding completion and its
calculator redirect; compute-only without completion; target-save failure;
target success with confirmation GET 503 and biometric failure; successful
exact-value Retry confirmation; manual Stage 3 launch without generation; and
Close & Pause with continued manual availability.

The pass failed on mobile pointer access: the native fixed macro summary covered
the new offer/Retry. The new section now reserves clearance only when that summary
is present, and its action buttons have scroll margin. Native header/summary and
layout/scroll ownership were not changed. Three component regression checks cover
that conditional clearance, Retry callback, and inactive/professional absence.
This is a code/component-test fix, **not a browser-cleared touch result**: the
browser service disconnected twice before the pass could finish.

Free Next Step reached `/dashboard` and correctly skipped the meal stage; final
Dashboard rendering was blocked by the synthetic fixture returning `{}` for the
effective-builder API. That malformed-fixture crash is not claimed as a product
defect. Account/household invalidation has focused-test coverage, not completed
browser coverage. Trial/welcome and every native redirect variant are not all
browser-cleared. The stopped browser run made no real server writes.

Retained limits: actual Safari/WebKit/physical iOS and native/headless capture
arbitration are not cleared; generic blockers do not prove every safety/legal/
checkout/verification workflow. No new critical-workflow refactor addresses them.

## Files

Application/test:

* `client/src/components/dashboard/GettingStartedCard.tsx`
* `client/src/components/guided/GuidedWorkflowNextStep.tsx`
* `client/src/hooks/useGuidedJourneyDashboard.ts`
* `client/src/hooks/__tests__/guidedJourneyWorkflow.test.tsx`
* `client/src/lib/guidedJourney/dashboardScope.ts`
* `client/src/lib/guidedJourney/workflow.ts`
* `client/src/lib/__tests__/guidedWorkflowNextStep.test.tsx`
* `client/src/pages/OnboardingV3.tsx`
* `client/src/pages/MacroCalculator.tsx`

Documentation/context: this document, the Dashboard/explanation documents, and
`.agents/memory/guided-journey-authority.md`. The local verification configuration
is ignored by Git and is not a runtime/deployment configuration.
