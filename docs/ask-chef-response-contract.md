# Ask Chef response contract — Development only

## Scope and audit

The Development `corner` engine alone calls `runConciergeConversation`. Production
continues through `StructuredCoachingEngine`. No destination implementation,
subscription enforcement, database schema, or frontend behavior changes.

The provider's strict JSON schema requires all keys, not usable content in every
message variant. `message` is a string; `conversationMessage`,
`recommendationMessage`, and `handoffMessage` are nullable strings. The response
parser trims and bounds wording, treating blank/malformed optional wording as
absent. Action metadata is validated after safety escalation, not before it.

### Original mismatch

Provider-valid null variants were treated as required downstream. Rejection then
required an independent continuation that could not name *any* feature. A valid
main invitation was not considered, and even harmless feature descriptions could
be discarded. The final catch erased `navigation_not_authorized` into generic
`response_unavailable`. Instructions also required both navigation variants while
elsewhere allowing unused variants to be null.

The retained October 31, 2026 3:35:57 PM log proves a decision-stage failure, not
which of these conditions occurred. The original provider output was not stored.

## State contract

| State | Required usable wording | Optional/nullable wording | Server result |
|---|---|---|---|
| Ordinary conversation | `message`, or safe `conversationMessage` if primary is unusable | Both navigation variants and independent continuation | Text only; no pending destination or button |
| Recommendation | Dedicated recommendation question, or existing main/continuation question naming the validated destination | Handoff, independent continuation | Save `recommendation_pending`; no button |
| Confirmation | Owned pending destination matching validated goal and current available tools; usable dedicated handoff | Recommendation and continuation | `navigation_confirmed` plus matching registry action |
| Direct request | Existing current named-feature evidence plus semantic intent, explicit goal, registry/access validation; usable dedicated handoff | Recommendation and continuation | `direct_navigation` plus matching registry action |
| Safety escalation | Existing safety response/clinical guidance | All navigation wording | Safety response only |

No navigation variant is required for ordinary conversation. No turn must contain
all three wording variants. Provider output structure alone never grants consent.

### Safe recovery

* Existing recommendation wording is tried first, then main and continuation
  wording. Recovery requires a question, no foreign destination or link, and no
  opening/completion claim. Alternative fields must name the validated target;
  an unrelated question cannot establish a pending recommendation.
* A false `confirmed`/`direct_request` tag can at most become a pending proposal
  when actual confirmation/direct-request evidence is absent.
* Missing or unsafe handoff wording never falls back to a button using the main
  message. A safe independent continuation can still be shown. A validated
  matching pending recommendation remains pending, including in a retry response.
* A standalone continuation may describe a feature. Naming it does not create
  pending state, a destination action, transferred inputs, or entitlement.
* Link/route and opening/transfer/instruction screening remains conservative.
  It screens output, not member intent; it is not a semantic or clinical proof.
* No extra model call, generated navigation script, or finished food is introduced.

## Persistence, restoration, and frontend audit

The engine persists the selected text and full structured response. Restoration
reads only the latest owned assistant payload, not historical text or summaries.
Declines, changed choices, safety responses, and superseding conversations retain
their existing clearing/replacement behavior.

`CoachBubble` requires confirmed/direct state, matching presentation destination,
and matching `use_feature` plan item before rendering an action. Pending state
alone cannot render a button. Existing click-time access checks remain intact.

## Diagnostics and all retry paths

Decision failures retain static categories:
`missing_recommendation_wording`, `missing_handoff_wording`,
`navigation_not_authorized`, `missing_pending_recommendation`,
`decision_invalid`, `invalid_destination`, `entitlement_rejected`,
`goal_not_ready`, and `unusable_conversational_response`.

Recovery logs its reason without returning an error to the member. A rejected
continuation logs `unusable_conversational_response` separately from the original
action rejection. Safety escalation has its own static category.

The concise member retry remains possible for:

1. **Provider stage:** SDK/network/rate-limit/provider errors, or unexpected errors
   constructing the provider request. `response_unavailable`, stage `provider`;
   HTTP provider status is included when available.
2. **Parsing stage:** invalid JSON, missing/refused/empty provider content, or
   response-envelope schema errors. `response_unavailable`, stage `parsing`.
3. **Decision stage, known failure:** no usable ordinary response, or a rejected
   action with no safe independent continuation. The specific decision category
   is retained instead of `response_unavailable`.
4. **Decision stage, unexpected failure:** an unclassified runtime exception.
   `response_unavailable`, stage `decision`. No exception message is logged.

Existing request IDs are propagated from Express; only UUID-shaped IDs are
included. Logs contain no member text, model text, clinical context, account IDs,
provider exception bodies, or raw payloads.

## Verification boundary

Deterministic tests exercise the actual Development engine, persistence,
restoration, and rendered bubble with incomplete and malformed model responses.
They do not establish live model compliance, clinical validity of model wording,
or multilingual semantic screening. No paid live-model calls are authorized or
performed by this repair. Authenticated live-model acceptance and Production
promotion remain separate approvals.
