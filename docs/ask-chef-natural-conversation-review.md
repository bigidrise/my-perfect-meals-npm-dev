# Ask Chef natural conversation and knowledge review

## Scope and release boundary

Local integration only. No subscription/pricing, environment, navigation
allowlist, clinical permissions or deployment changes are authorized.

## Safety correction

The former `redFlag || contactCare` condition treated any nonempty care string
as a clinical event. A bounded synthetic live-model observation returned
`redFlag=false`, `careDisposition=none`, and `contactCare=":)"`. Nullable
structured-output strings are not by themselves a clinical classification.

The explicit care classification now governs inactive fields:

- `none` and `routine_caveat`: ordinary conversation, unless redFlag is true.
- `referral` and `emergency`: preserve care guidance and suppress navigation,
  including a referral with no separate contactCare string.
- Missing/invalid legacy classification with nonempty contactCare: fail closed.
- An independent redFlag always wins.
- Existing hardcoded safety screening still precedes model invocation.

The safety response stores full care guidance once, in a typed contact-care
action. The frontend also deduplicates exact historical safety strings and does
not append a routine professional disclaimer to an already-escalated message.
No fuzzy text removal or food-keyword exception was introduced.

## Knowledge inventory and evidence

Run `tsx scripts/report-chef-platform-coverage.ts` to reproduce the self-contained
owner-facing report in `generated-artifacts/ask-chef-platform-coverage.html`.
The report contains all nine requested fields for every structured catalog
record, the retained broad knowledge, unavailable features and all 244 literal
route registrations. Source paths belong only to this internal report.

Current structured coverage: 26 workflows, 20 verified and 6 partial. Existing
broad member knowledge covers another set of overlapping platform areas.
This is **not** complete verification of all 244 routes. Route-only entries are
explicitly uncertain; registration alone proves neither controls nor access.

Verified additions/corrections:

- Academy entry through More and its progress-dependent certification controls.
- Organization client invitation guidance, filtered by current authorized
  owner/admin workspace membership. No tenant IDs, clients or private data enter
  the model; workspace selection and invitation submission remain in Business.
- Professional workflow overview, filtered by existing professional identity
  readiness, including current session MFA where required. Per-client permission
  is never inferred from account readiness.
- Find Meals Near Me's restaurant-only search evidence. Dedicated specialty
  shops, bars and grocery retailers are not verified search coverage.
- Semantic distinctions between preparation, chosen restaurants/shops,
  restaurant discovery, packaged-product discovery, nutrition and feature help.

The approved destination registry and existing usage knowledge are reused,
not duplicated in a second model catalog. The role-specific facts supplement
them. No vector database, new provider, retrieval service or second foreground
model pass was added.

## Remaining gaps

- Four approved destinations have incomplete detailed control records:
  Sushi Creator, Hydration Center, Macro Calculator and My Perfect Beginnings.
  Do not infer missing control labels from a route or general description.
- Clinical hub and professional Studio records are partial; a clinical condition
  name is not proof of a particular available control, guideline or permission.
- Route-only business, lifestyle, account and specialist subpages still need
  individual content/control/access review before detailed instructions are added.
- Dedicated ice cream shop/bar/retailer discovery needs feature verification
  or destination work; it is not added by this change.
- Persistent food enjoyment, avoidance and full allergy-context coverage are
  not added to the old snapshot. Existing food generators and clinical safeguards
  remain authoritative; this review does not certify complete chat safety context.
- Long-history summaries are asynchronous; older preferences can temporarily be
  unavailable. Latest explicit corrections and pending-state authority remain.

## Validation interpretation

Regression fixtures verify contracts, safety classification, historical rendering,
history transfer, role filtering and navigation/access invariants. They do not
prove model conversation quality. Controlled synthetic live observations must be
reported separately, including failures, number of turns and absence of writes.
Strict/release results must be reported as observed; do not refresh a reviewed
TypeScript baseline merely to make a changed fingerprint pass.

### Observed results

- Ten focused suites: **672 tests passed**, including safety, navigation state,
  authentication/access contracts, subscription matrices and actual page rendering.
- Strict safety TypeScript gate passed with the four new/changed core knowledge
  and response modules explicitly included.
- Controlled live work made ten bounded synthetic provider calls in total.
  Initial observations exposed false care escalation and an unusable symbol-only
  continuation; neither was concealed by the final mocked-test count.
- The final three-turn live run used 38,197 total tokens and produced ordinary
  clarification, a pending Craving Creator recommendation, then a pending Find a
  Product recommendation after the Walmart correction. No automatic navigation,
  saved conversation or image generation occurred.
- Actual response-component fixtures were visually checked at 390×844 and
  1120×800. Ordinary replies had no safety boilerplate; new and historical care
  envelopes each displayed the guidance once. These were isolated real-component
  fixtures, not verification of the member's authenticated page.
- Full release validation: **13 passed, 0 warnings, 0 failed**. Root strict
  TypeScript exactly matches the unchanged reviewed baseline of 118 legacy
  diagnostics; this is not a claim that the entire repository is type-error-free.
- The existing preview workflow was restarted once after the final code/build
  batch. Startup completed and the proxied health endpoint returned HTTP 200.
  Automatic release migrations and background maintenance remained suppressed
  by the existing preview configuration. The final local SHA is in the completion
  message; no push, merge, publication or Production environment change occurred.

### Changed areas

- Response contract/handling: `conciergeConversation.ts`, `conciergeInstructions.ts`,
  `safety.ts`, `client/src/components/coaching/CoachBubble.tsx`.
- Knowledge and permission projection: `platformFeatureCatalog.ts`,
  `platformKnowledgeAccess.ts`, `platformKnowledge.ts`, `capabilityRegistry.ts`,
  `featureUsageKnowledge.ts`, `engine.ts` (all under `server/services/coaching`).
- Regressions: `server/tests/chefNaturalConversation.test.ts` and
  `client/src/lib/__tests__/chefConversationPage.test.tsx`.
- Review tools: `scripts/report-chef-platform-coverage.ts`,
  `scripts/smoke-chef-conversation-live.ts`; strict-check configuration and ignored
  generated report output were updated. No release metadata was changed.
