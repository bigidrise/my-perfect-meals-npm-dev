# Concise Ask Chef navigation — Development correction

## Approved scope

Business Suite is now an approved Chef destination, and concise navigation is the
standard for existing approved destinations. This is not a new feature-knowledge
system or a general intelligence rewrite. No Production changes, deployment,
branch/worktree, commit, push, merge or reset were performed.

## Behavior

- **Destination question:** briefly identify the destination and ask permission.
  Save a pending offer, not an actionable button.
- **Acceptance:** supply reviewed entry directions and the existing Open action.
  Do not explain the destination's workflow, ask permission again, or append a
  closing question.
- **Direct opening command:** supply directions and the action immediately.
- **Feature explanation:** answer briefly without treating the question as
  consent. Actual nutrition guidance and necessary clinical care are not
  truncated to fit a navigation template.
- Naturally brief existing offers can retain their wording. Feature-only
  explanations longer than 40 words or containing multiple paragraphs use a
  reviewed short offer instead; this does not truncate nutrition answers.

Business starting-point intent uses the existing single model call with a typed
business goal. Its selected destination is normalized into a short offer instead
of an administrator lecture. Whole named destination questions and commands bind
the existing reviewed entry records.

Expected exchange:

> Start in Business Suite to explore your business options. Would you like to go there?
>
> **Member:** Yes.
>
> You can find it under More → Business Suite.
>
> **Open Business Suite**

The button opens the existing `/business-organizations` Organization Hub. It
handles both existing authorized organizations and its existing Start
Organization option. Chef does not choose a workspace, create an organization,
enroll an affiliate, grant paid access, or assume administrator membership.
The human navigation directions remain **More → Business Suite**.

## Preserved boundaries

Click-time authentication and destination authorization remain unchanged.
Clinical escalation still precedes navigation; malformed or mismatched model
handoffs retain their rejection checks. Original offer timestamps, 30-minute
expiry, owner-scoped receipt persistence and post-arrival `performedAt` behavior
are unchanged. Unsupported Create a Dish transfer attempts still receive an
honest notice; a plain opening command without a transfer attempt does not get
an unnecessary transfer-warning paragraph.

No destinations other than Business Suite were added. Feature Intelligence was
not activated. Existing Development safe-start flags and isolated Vite cache
configuration were preserved.

## Validation and limits

- Scoped navigation, conversation, receipt, clinical and UI regression checks:
  **1,137 tests across 26 suites passed** in their latest applicable runs.
  The final explanation-only shortening was separately confirmed by
  **132 passing tests across two focused suites**.
- Broader check across 39 suites: **1,457 passed, 45 failed**. This is not a
  clean full-suite result. Forty failures are in additional legacy Chef
  instruction/choice/knowledge suites; some expect historical Production
  separation or previous handoff wording/destination counts. Five are in
  `chef-path-diet-override.integration.test.ts`, concerning macro ceilings,
  forecasted overages, total-versus-starchy carbohydrates and zero-starch
  enforcement. Those meal-generation paths were not modified. Their customer
  impact and baseline status were not established here.
- Server TypeScript and safety TypeScript passed for the correction.
- Production client/server compilation passed; release metadata was not changed.
- The existing root release-type baseline was neither refreshed nor declared
  clean; its earlier reported mismatch is not resolved by these focused checks.
- The managed Development workflow was restarted after runtime changes.
  Health returned HTTP 200. Anonymous preview checks do not prove an
  authenticated live-model conversation; provider responses in regression tests
  are synthetic and no paid model call was made.

## Changed runtime files

- `shared/coaching/navigation.ts`
- `shared/coaching/navigationGuidance.ts`
- `shared/coaching/schemas.ts`
- `server/services/coaching/verifiedNavigation.ts`
- `server/services/coaching/capabilityRegistry.ts`
- `server/services/coaching/conciergeGoal.ts`
- `server/services/coaching/conciergeInstructions.ts`
- `server/services/coaching/conciergeConversation.ts`

New protocol coverage is in `server/tests/chefConciseNavigation.test.ts`;
existing server conversation/navigation/style assertions and
`client/src/lib/__tests__/chefApprovedNavigationActions.test.tsx` were reconciled
to the approved contract without skipping or deleting tests. Durable founder
instructions were added to `.agents/memory/ask-chef-parent-navigation.md`.
