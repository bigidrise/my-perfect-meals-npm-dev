# AI Pairing Advisor — offline Increment 1

## Authorization and boundaries

Only contracts, pure policy functions, prompt contracts, and synthetic acceptance tests
are authorized here. This code is not imported by application entrypoints. There is no
advisor route, browser interface, customer-profile loader, provider client, or database
adapter. Phase 1 screens, routes, validators, and DTOs remain frozen.

Account-owner-only scope, separate education/consumption behavior, complete-response
validation, and conservative authority-outage behavior are approved design decisions.
Missing required safety authority produces an operational failure even for education.
Optional preferences cannot stand in for missing authority.

The model-attempt ceiling, deadlines, cancellation implementation, request-size limits,
and new endpoint HTTP mapping are design proposals for later approval. The
`ProvisionalRuntimeDesign` object is explicitly non-executing: it configures no runtime
and is not permission to make calls. Existing HTTP behavior has not changed.

## Contracts and trust boundaries

- Request: closed schema; no subject ID, safety clearance, entitlement, override,
  system-role message, or client-authoritative intent.
- Authority: separately supplied future server context. A complete account-owner
  result must match both actor and subject to the authenticated account. No guest
  or empty-profile fallback. The pure function does not authenticate callers.
- Intent: a supplied structured assessment for every turn. No classifier exists in
  this increment; synthetic labels do not prove multilingual understanding.
- Risks: new or retained disclosures conservatively withhold personal recommendations.
  They never edit a profile. The first implementation withholds all personal choices
  while a relevant risk remains unresolved rather than pretending to determine
  product-specific risk nonmateriality.
- Evidence: only exact supplied-list identity is currently represented. Prices,
  current stock, and composition cannot be substantiated by this evidence contract.
- Response: closed outcome variants with typed references. A complete-response verdict
  is bound to the exact normalized payload, not an earlier candidate.

Future runtime adapters must resolve authority freshly and produce authoritative
pre-generation eligibility; they must not pass raw request fields into those trusted
arguments. Real consumption scanners and clinical authority are not reimplemented.

## Policy outcomes

Disabled, unauthorized, and forbidden outcomes cannot be turned into advisor content.
Missing authority is distinct from a valid restriction. Education may proceed under
valid restrictions but not under missing authority. Other-person requests, unresolved
referents, contradictory assessments, and unclear intent require clarification.

Consumption retains the existing ingredient gate and active restrictions. A wine list,
label pasted into chat, alleged verification, or override instruction cannot clear the
gate. Mixed requests may return a restriction plus separately validated education.
They cannot move recommendations into the educational field.

## Final validation

Deterministic checks reject unknown fields, unresolved recommendation references,
off-list/ambiguous identities, unsupported evidence, and inconsistent outcomes.
Alternatives and Best Choice refer only to surviving cards. Removing a card therefore
invalidates dependent references rather than silently selecting another card.

The final complete-response review is mandatory for generated prose, including all
explanations, serving advice, alternatives, and follow-up suggestions. `fail`,
`uncertain`, missing review, or a changed payload withholds content. Fixed restriction,
clarification, and unavailable messages are server-owned rather than model explanations.
Only the accepted, fully assembled payload is eligible for future rendering.

Important limitation: semantic verdicts are SYNTHETIC in this increment. The validator
cannot itself infer that arbitrary prose contains an unsafe recommendation or price
claim. Passing an invented verdict is not evidence that the words are safe. Real
semantic assessment and existing scanner integration require later authorization.
There is no streaming, repair loop, timeout executor, provider fallback, or HTTP handler.

## Conversation lifecycle

Pure helpers describe explicit preference replacement/removal, list replacement,
retained risk disclosures, reset state, and response correlation. They create no browser
storage. History is bounded and untrusted; assistant statements cannot establish facts
or safety authority. Replacing a wine list clears historical index references. Runtime
integration must increment `contextRevision` on every context mutation, allocate a new
conversation ID after resets, and never reuse a pending submission after identity changes.

The future UI must reset on logout, account/workspace change, leaving the advisor, and
refresh. Response acceptance requires matching active account/workspace plus request,
conversation, and context revision. It must not show earlier recommendations as fresh
clearance after safety context changes.

Client-held disclosures cannot be guaranteed after a reset or malicious omission.
No signed ledger or persistent clinical record is implied. Durable risk capture and
household/delegated subjects remain outside scope.

## Five acceptance groups and proof limits

1. Restricted users can receive education: valid restricted fixtures permit general
   explanation; personal consumption remains gated; authority outages fail closed.
2. Consumption gates: ingredient/active restrictions, incomplete/mismatched subjects,
   missing optional preferences, new risks, and access/Development decisions.
3. No hidden mixed-request advice: closed schema, all prose review dimensions,
   rejected-card dependencies, partial payloads, unavailable review.
4. Conversation: supplied per-turn interpretations, fresh-authority simulation,
   forged history/provenance, missing referents, multilingual labeled fixtures,
   replacement/reset semantics, limits, stale responses.
5. Evidence: real deterministic identity matcher, duplicate/vintage/name ambiguity,
   unsupported price/stock/composition, old list revision, injected list instructions.

Cross-cutting tests verify provider/database import denial, network/subprocess denial,
and a closed pure source-import graph. Real network calls are not used to test denial.

## Verification commands (offline)

```sh
./node_modules/.bin/jest --config server/tests/pairingAdvisorOffline/jest.config.cjs --runInBand
./node_modules/.bin/tsc -p server/tests/pairingAdvisorOffline/tsconfig.json
```

The standalone Jest configuration intentionally does NOT load the application's Jest
setup. Guards are process-local, do not change environment variables, and throw before
HTTP, sockets, DNS, fetch, WebSocket, or subprocess work. Provider/database module
mappings fail at import. The import-graph test rejects application runtime dependencies.

## Deferred, not authorized by Increment 1

- Endpoint mounting and actual Development/direct-request enforcement.
- Existing auth/CSRF/entitlement/rate-limit integration.
- Account-owner authority adapter and real deterministic scanner integration.
- Classifier, generator, or semantic-review provider execution.
- Actual deadlines, cancellation, attempts/retries, and HTTP mapping.
- Conversation UI and real browser lifecycle verification.
- Paid/live verification, Production work, release, publishing, or deployment.

Increment 2 requires separate approval.
