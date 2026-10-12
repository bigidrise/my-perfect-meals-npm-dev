# Guided Journey explanations — Development only

## Boundary

This is the approved manual explanation/presentation layer, not a finished Guided
Journey. Existing onboarding, calculator and Builder actions remain authoritative.
There is no automatic launch, completion monitoring, automatic next-step
presentation, new meal generation, or workflow-specific walkthrough. Those
connections require separate approval. Nothing is enabled in Production.

## Presentation

The existing Dashboard card has **Show Explanation** beside its unchanged manual
Continue Setup action. Both re-read the signed-in profile and authoritative
progress before using it. Unknown evidence, unsupported Builders, changed identity,
failed reads and unverified access cannot launch an explanation or authorize a
handoff.

The reusable component uses `UniversalDialog`, its established scrollable body,
header/footer, Radix focus containment and dismissal handling. A locally bounded
dynamic viewport/safe-area frame supports portrait and short mobile viewports.
The only shared-container change is an optional `onCloseAutoFocus` pass-through;
existing consumers retain their existing behavior.

Stage titles, explanatory copy and primary labels match the approved brief.
The indicator uses applicable stages only: Free journeys have two, not a paid
meal requirement. The sole supported meal adapter names **General Nutrition Meal
Builder**. Unsupported assignments are never substituted.

Primary actions recheck profile and progress again, and must still match the
stage being explained. If completion changed while the explanation was open,
an old button cannot jump into a later activity. Existing redirects and native
actions remain intact.

## Preferences and replay

Manual explanations remain available when automatic guidance is disabled or
paused. Opening them does not resume guidance or enable automatic presentation.
User dismissal (Close, Close & Pause, Escape, outside), conflict withdrawal and
failed active reads pause guidance for the current running browser session.
This account-scoped, in-memory pause survives page/component navigation, does not
write persistent pause preferences, and resets on a full browser-page reload.
Explicit Resume clears it without re-enabling a disabled automatic preference.

Restart Guidance explicitly launches an explanation replay from the first
applicable stage after fresh checks. Next Explanation changes presentation only.
Completed or future activities have disabled native primary actions and explain
why. Finish clears replay intent and closes/pauses the presentation. Early
dismissal preserves replay intent for another manual attempt.

No explanation event supplies completion evidence or resets onboarding, targets,
Builder selections, saved plans or other operational data. Successful handoff to
an existing activity is not a user dismissal; there is no automatic follow-up.

## Coordination and integration limits

Guidance checks blockers before requesting an explanation and again after the
fresh reads. While open, DOM observation withdraws only guidance when another
interaction appears. It never closes another UI or queues an automatic reopen.

Covered detection:

* Displayed dialogs/alertdialogs/ARIA-modal containers/native HTML dialogs,
  including existing UniversalDialog/Quick Tour/paywall/verification dialogs.
* Welcome Gate's existing marker and displayed high-z, fixed-inset overlays,
  including the custom disclaimer and Copilot backdrop patterns.
* Visible recording stop controls and displayed media elements with live streams.
* Hidden document state and explicit interaction leases.

The lease API is opt-in for future native/headless capture integrations. No
recording/camera, checkout, legal, welcome or Quick Tour workflow was rewritten.
Native OS permission/camera/file-picker UI, headless recorders without visible
controls, shadow-root/cross-origin UI, and custom overlays without recognized
semantics/markers are **not fully arbitrated**. They need explicit integration,
not a claim of universal coverage. DOM withdrawal is reactive, not an atomic
shared priority registry that every legacy workflow participates in.

## Verification

```sh
npx jest client/src/hooks/__tests__/guidedJourneyExplanation.test.tsx \
  client/src/hooks/__tests__/useGuidedJourneyDashboard.test.tsx \
  client/src/lib/__tests__/guidedJourneyPreferences.test.ts --runInBand \
  --globals='{"ts-jest":{"isolatedModules":true}}'
```

**111 passing checks:** 32 explanation/coordination checks and the existing 79
card/preference checks. Narrow source TypeScript checking passes using the
existing ignored `.local/validation/guided-journey-card.tsconfig.json`.
This does not claim a passing project-wide release gate; the existing TypeScript
baseline mismatch remains deferred before Production.

The safe Development restart logged automatic database maintenance suppression;
the Development Dashboard then returned HTTP 200.

The fixture-backed Chromium browser pass verified configured paid manual launch,
replay/copy, disabled completed activity actions, fresh reads before the native
Builder handoff, Close/Escape/backdrop dismissal and focus return, Tab/Shift+Tab
containment, synthetic higher-priority dialog withdrawal, failed/unknown reads
and Retry, account switching, and no automatic launch or recovery reopen.
All real non-GET API requests were blocked; no real account or database was used.
The native Builder's local draft initialization and Quick Tour remained unchanged.

Mobile Chromium emulation passed at 390×844 and 390×640. The short viewport
measured dialog bounds x=16, y=79.5, width=358, height=481, bottom=560.5.
Desktop Dashboard rendering was checked at 1440×900.

An initial Free replay check was interrupted by the existing Dashboard upgrade
information dialog. Its X only closes; the native **Continue With Current Plan**
button records dismissal, preventing its `[user]` effect from reopening after
profile refresh. This behavior was identified, not changed or bypassed.
The targeted follow-up used that native dismissal option and confirmed Free
replay **Stage 1 of 2 → Stage 2 of 2 → Finish** with no meal stage, no plan
purchase, preserved completed evidence and automatic-off/session-pause choices,
and no automatic reopen. The settled paid/mobile modal was also confirmed opaque
and legible after its standard opening animation; the earlier capture was mid-fade.

**Unverified:** actual WebKit/Mobile Safari/device safe-area behavior; real
checkout/safety/legal/professional-verification workflows; native/headless camera
and recording integrations. Generic blocker tests are not proof of every legacy
interaction. Unrelated unauthenticated fixture 401/CSRF/timezone warnings were
observed. Synthetic responses are not live authenticated database evidence.

## Changed application/test files

* `client/src/components/dashboard/GettingStartedCard.tsx`
* `client/src/components/dashboard/GettingStartedCardView.tsx`
* `client/src/components/guided/GuidedJourneyExplanation.tsx`
* `client/src/components/ui/universal-modal.tsx`
* `client/src/hooks/useGuidedJourneyDashboard.ts`
* `client/src/hooks/__tests__/guidedJourneyExplanation.test.tsx`
* `client/src/hooks/__tests__/useGuidedJourneyDashboard.test.tsx`
* `client/src/lib/guidedJourney/dashboardModel.ts`
* `client/src/lib/guidedJourney/dashboardScope.ts`
* `client/src/lib/guidedJourney/explanation.ts`
* `client/src/lib/guidedJourney/presentation.ts`

Documentation/context: this file, `docs/guided-journey-dashboard-card.md`, and
`.agents/memory/guided-journey-authority.md`.
