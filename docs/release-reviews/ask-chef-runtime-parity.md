# Ask Chef runtime parity and availability

This is the earlier parity report. The subsequent, release-scoped final review
and complete regression evidence are in
[Ask Chef navigation final readiness](ask-chef-navigation-final-readiness.md).
The exact proposed promotion allowlist is
[candidate files](ask-chef-navigation-candidate-files.txt); it deliberately
excludes agent memory and generated mockup artifacts.

## Scope and release boundary

Approved navigation and conversation-continuity corrections are ordinary Ask
Chef behavior in both Development and Production. Working in the Development
workspace does not authorize a Development-only implementation. No new release
flag or activation system was introduced.

This work does not authorize a push, merge, separate Production workspace change,
publication, or a change to the published feature's visibility.

## Availability is separate from behavior

The existing setting is **VITE_COACHES_CORNER_ENABLED**.

- Client: `client/src/features/coachCornerFlag.ts` delegates to
  `shared/coaching/askChefRelease.ts`. Explicit `false` hides navigation entries
  and excludes the `/coach-corner/*` routes from the client router. Production
  defaults to visible when unset; Development still requires explicit `true`.
  These defaults were not changed.
- Vite evaluates this setting at **build time**. Rebuild the client when changing
  customer-facing visibility.
- Previously, this flag did not enforce API availability.
- The new `server/middleware/requireAskChefAvailability.ts` reuses that same
  setting at **server runtime**. Explicit `false` returns 404 before executing
  Ask Chef handlers. True or unset continues through the existing authentication
  and destination permissions, preserving prior API defaults.
- The middleware is mounted on the engine, navigation/receipt, and legacy
  Coach's Corner routers. It is not a global platform middleware.
- Configure the same existing setting for the client build and server runtime.
  A build-only false value does not by itself configure the server, and a
  runtime-only false value cannot remove already-built menu entries.
- No setting was changed in the workspace or published application.

Other platform changes can therefore ship with this setting false while the
approved Ask Chef implementation remains present and functional when enabled.

## Functional changes

- Fresh unperformed navigation offers remain confirmable, including already
  offered direct/confirmed actions, with the original offer age retained.
- Current dessert-size choice metadata loads and resolves in both runtimes.
- Explicit feature selections and acceptance use server-owned current state,
  without repeated permission or reconstruction of consent from old prose.
- Confirming an explicit-feature-only stored goal does not require the original
  feature name to remain in the bounded conversation history.
- Continuity instructions, purpose schema, verified platform guidance,
  feature suitability, reply screening and handoff recovery no longer depend on
  the runtime environment.
- Grocery-specific name/evidence restrictions apply in both runtimes.
- Visible input submission, reply correlation, in-flight exclusion, transactional
  clearing and stable history pagination apply in both runtimes.
- Complete care wording is preserved in corner conversation history in both
  runtimes. Clinical escalation still precedes all navigation corrections.
- The self-subject and existing food-declaration safeguards accompany approved
  response rendering in both runtimes; they were not bypassed to obtain parity.
- Route receipt delivery depends on message identity and observed authorized
  navigation, not typography or the message-reliability setting.

Authentication, destination subscriptions, clinical eligibility, fixed routes,
original-offer/owner/conversation receipt matching, current tool availability,
expiry and already-performed checks remain enforced.

## Remaining Development-only behavior

| Location | Purpose | Effect on approved navigation |
| --- | --- | --- |
| `server/services/coaching/featureIntelligence.ts`, `featureIntelligenceRegistry.ts`; client `isChefFeatureScreenContextEnabled` | Explicit experimental generated-registry explanations, current-screen context and tool filtering. Requires the existing server/client Feature Intelligence opt-ins and rejects deployed-server use. | Not needed for approved navigation. Remains excluded from this release. |
| `server/services/coaching/coachingContext.ts` (`developmentEvidence`, member-evidence rendering) | Separate trustworthy member-evidence/date/target projection. | Not a navigation activation gate. This broader nutrition-evidence projection still differs and was not globally activated here; this report does not claim parity for every coaching-context experiment. |
| `server/services/coaching/conciergeConversation.ts`, `conciergeInstructions.ts`, `engine.ts` | Additional bounded diagnostic logging and fingerprints. | No functional effect. |
| `server/routes/coaching.ts` Development-only test helper | Legacy development testing endpoint. | Not required by Ask Chef conversation or navigation. |

No additional database migration, backfill, environment variable, external
service, research integration or paid-model call is required for these changes.
Existing message JSON stores choice and navigation evidence.

## Verification and limitations

The automated checks use synthetic provider responses, mocked authenticated
requests and database transports, plus in-memory PostgreSQL for receipt SQL.
Development and Production runtime cases execute the same approved service,
state-loading and navigation routes. Client component tests verify actual button
click handlers and receipt delivery with feature-name emphasis both on and off.
Availability tests verify hidden APIs and unrelated-route independence.

Production-mode client/server builds and release-manifest verification passed.
The strict release type gate retains the existing reviewed debt baseline; no
compiler settings or baseline were relaxed.

Initial regressions included obsolete tests requiring Production to keep old
behavior. Those expectations were changed to assert approved parity and
authoritative handoff wording. An additional state-only confirmation gap was
fixed, rather than weakening current-offer freshness checks.

The production application was not started against the shared database. A
Production-mode test process and compilation are not evidence of a published
Production deployment. Signed-in live destination clicks, a paid live-model
conversation, and physical iOS safe-area behavior are not established by these
isolated checks. Existing live signed-in acceptance remains a release checklist
item; do not interpret this report as an unqualified publish recommendation.

### Final check results

- The 20-suite regression set covers 697 tests. After correcting obsolete
  Production-only expectations, its final passing evidence is the wide run
  (18 passing suites) plus focused passing reruns of the two remaining suites.
- The additional real conversation-page component suite passed, including its
  submission and conversation-lifecycle checks.
- The final paired-runtime suite covers selection, confirmations, stale and
  performed offers, care precedence, unavailable destinations, stored choice
  loading, availability and experimental isolation.
- Root release TypeScript gate: passed against the existing 110-diagnostic
  reviewed baseline, without refreshing it.
- Production client and server builds and built release manifest: passed.
- Development safe-start workflow: starts successfully; `/api/health` returned
  HTTP 200.
- Existing large-chunk/bundle and ts-jest deprecation warnings remain; they are
  not failing checks and were not addressed by unrelated tooling changes.

### Files changed

Runtime and client:

```text
client/src/components/coaching/CoachBubble.tsx
client/src/components/copilot/CopilotPageExplanations.ts
client/src/lib/chefConversationReliabilityGate.ts
server/middleware/requireAskChefAvailability.ts
server/routes/coachCorner.ts
server/routes/coachingEngine.ts
server/routes/coachingNavigation.ts
server/services/coaching/adapters/cornerAdapter.ts
server/services/coaching/capabilityRegistry.ts
server/services/coaching/conciergeConversation.ts
server/services/coaching/conciergeGoal.ts
server/services/coaching/conciergeInstructions.ts
server/services/coaching/conciergeNavigationContinuity.ts
server/services/coaching/conciergeNavigationState.ts
server/services/coaching/conciergeReplyScreening.ts
server/services/coaching/conversationReliability.ts
server/services/coaching/engine.ts
server/services/coaching/featureUsageKnowledge.ts
server/services/coaching/platformKnowledge.ts
shared/coaching/navigation.ts
```

Tests:

```text
client/src/lib/__tests__/chefFounderHandoff.test.tsx
server/tests/chefConversationPurpose.test.ts
server/tests/chefConversationReliability.test.ts
server/tests/chefConversationRoutes.test.ts
server/tests/chefFallbackReliability.test.ts
server/tests/chefFoodCompatibility.test.ts
server/tests/chefFoodDestinationKnowledge.test.ts
server/tests/chefFounderConversation.test.ts
server/tests/chefGenericMealIntent.test.ts
server/tests/chefMealBuildersExplanation.test.ts
server/tests/chefNavigationReceipt.test.ts
server/tests/chefNavigationState.test.ts
server/tests/chefOccasionHandoff.test.ts
server/tests/chefReplyScreening.test.ts
server/tests/chefResponseStrategy.test.ts
server/tests/chefRestaurantRecovery.test.ts
server/tests/chefRuntimeParity.test.ts
server/tests/coachingNavigation.test.ts
```

Documentation: this report, `.agents/memory/ask-chef-reference-index.md`, and
`.agents/memory/ask-chef-runtime-and-visibility-policy.md`.

No unrelated application feature, dependency, release manifest source, database
schema, stored configuration, or published visibility setting was changed.
