# Academy tutorial controls — Development review

## Scope and files

- Tutorial map and pending URLs: `client/src/lib/tutorialVideoRegistry.ts` and
  `client/src/lib/TUTORIAL_VIDEO_REGISTRY.md`.
- Shared accessible green play control: `client/src/components/ui/HowThisWorksLink.tsx`.
- Feature pages: all pages in the supplied rollout list; the four training
  wrappers pass separate keys into `TrainingNutritionHub`. Existing builder
  controls were moved near the top, not duplicated.
- Automatic education policy: `client/src/lib/instructionalPopupPolicy.ts`,
  `CopilotRespectGuard`, `useQuickTour`, the Dashboard intro trigger and
  Edit Profile's automatic explanation effect.
- Tests: tutorial registry, tutorial button interactions, instructional popup
  policy, retained onboarding welcome and builder introductions.

Missing URLs intentionally produce no button and no inherited video. The exact
existing Athlete Beverage and Performance Builder links are retained until the
founder supplies their dedicated replacements. No new YouTube URLs were invented.

## Popup classification

| Trigger | Classification | Change |
| --- | --- | --- |
| Copilot page explanation hook, including guest explanations | Automatic educational | Central auto-open guard returns false |
| Dashboard's stored intro flag | Automatic educational | Guard checked before scheduling |
| Copilot intro playback | Automatic educational | Existing central guard blocks it |
| Edit Profile step explanation | Automatic educational | Guard checked before response mutation or scheduling |
| Inspiration Capture explanation | Automatic educational | Existing central guard blocks it |
| Quick Tour first-visit/setup/builder introductions | Automatic educational | Shared release switch blocks auto-opening only |
| Chef button, requested commands/walkthroughs, Guide buttons | User-requested education | Retained |
| Ask Chef | Separate assistant | Unchanged |
| Clinical/allergy warnings, consent, payments/access gates, organization operational setup, transactional notifications | Safety, access or operational | Unchanged |

The release switch is `false`; stored personal preferences and all explanatory
content remain intact. Reenabling is a deliberate code change, not a preference
reset. Onboarding data completion and native navigation are not changed.

## Feature impact assessment

| Area | Status and reason |
| --- | --- |
| Backend/core | Not applicable: no routes, schema, AI prompts or persistence changed |
| Copilot knowledge/actions | Applicable: automatic presentation disabled; knowledge, commands and manual help retained |
| App Library | Not applicable: no feature or route added; existing entries retained |
| Academy | Applicable: explicit YouTube mapping prepared; missing founder links remain unresolved. Platform, Professional and Business course content unchanged |
| Certification | Not applicable: no professional credential or clinical workflow change |
| Pro Tips | Not applicable: feature operations unchanged; existing content retained |
| What's New/release notes | Requires follow-up at release: no customer release announced for this Development-only verification |
| Sources | Not applicable: no scientific or clinical recommendation changes |
| White Label/organizations | Inspected: shared controls inherit existing page access; no branding, organization or membership rules changed |
| Marketing | Not applicable: no new marketed capability or demo changes |
| AI reasoning | Not applicable: Ask Chef and nutrition/image generation untouched |
| Testing/tier review | Applicable: offline tests cover button mapping, clicks and manual/automatic distinction; real all-tier/native-device verification remains outstanding |

Additional integration review: dashboard intro is gated; profile step explanations
are gated before mutation; subscription/account ownership safeguards and existing
routes are untouched. Notifications/reminders are untouched. Existing tutorial
labels are reused, with accessible names; no translation keys were removed.

## Verification and limitations

- Offline: 67 checks passed across five suites, including all existing feature URL
  clicks, every pending feature hidden, retained legacy default, no automatic
  Copilot/Quick Tours, and manual Chef/Guide interaction.
- Existing welcome/builder suites explicitly enable the release switch in their
  fixtures to verify dormant behavior can still be reenabled.
- These are mocked/offline checks, not proof of YouTube availability, successful
  live playback, clinical-message delivery, or account persistence.
- Page containers retain their existing safe-area and scroll ownership. Only the
  tutorial control was added/moved; it uses a minimum 44px touch target. Native iOS
  device/simulator verification remains unverified.
- No recipes, images, paid AI requests, saved meals or shared member data were
  created or changed by the implementation/tests.
- No publication, GitHub push or Production change is authorized by this report.
  The next release gates remain Published Development testing, GitHub/Production
  workspace review, and explicit Published Production approval.

This is not an unqualified Production-readiness certification. Pending video
assignments, live playback, complete role/tier coverage and native iOS checks
remain outstanding.
