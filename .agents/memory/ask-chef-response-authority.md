---
name: Ask Chef response authority
description: Typed care states, meaningful model continuations and honest platform-knowledge coverage.
---

Use explicit care classification, not presence of an optional text field, to
decide whether ordinary conversation is a care escalation. Independent emergency
flags always win, and unclassified legacy care must remain fail-closed.

**Why:** A controlled live model returned a nonempty emoticon in an unused care
field while explicitly classifying the turn as no-care. Nullable structured
output did not guarantee that unused fields were actually null. Mocked responses
had not revealed this behavior.

**How to apply:** Keep inactive fields inert under an explicit no-care decision.
Preserve genuine referral/emergency classifications and independent red flags.
Validate that fallback conversation is meaningful text; a nonempty symbol-only
placeholder is not a useful reply or consent. Do not patch this with food
keywords or a blacklist of observed placeholder strings.

Knowledge coverage must distinguish source-verified controls, partial guidance
and route registration alone. Professional/organization instructions need
server-proven authority, not a role claimed in conversation.

**Why:** A route inventory is not evidence that every feature is active, fully
documented or permitted for the current member. Restaurant search also does not
prove coverage of specialty shops or live menu availability.

**How to apply:** Reuse existing feature/access authorities, avoid adding
navigation permissions through knowledge, and report incomplete coverage
explicitly. Synthetic live observations and deterministic tests establish
different kinds of evidence; never present mocked tests as proof of natural
conversation quality.

Ask Chef must not require repeated confirmation for the same destination.
Permission offers must carry a validated pending recommendation before display;
acceptance of that recommendation must not depend on an optional model wording
variant being populated.

**Why:** A synthetic replay stored the correct recommendation and recognized the
member's acceptance, but an unusable handoff variant still prevented the button.
Plain conversational permission offers also could bypass pending-state creation.

**How to apply:** Preserve semantic consent, current tool eligibility and
latest-owned pending-state checks. Only after those checks, recover missing or
repeated handoff wording from verified destination instructions (or the existing
button label when controls are unreviewed). Keep unsafe links and mismatched
destinations rejected. Never choose a destination from a permission question,
reconstruct pending state from text history, or authorize a bare yes by keyword.

Distinguish missing recommendation wording from a missing decision. A validated
ready goal may support recovery of an omitted wording variant or uniquely missing
destination ID; a correct-looking feature name in prose is not pending-state
authority.

**Why:** A member can finish clarification and correctly identify a feature
without the model emitting structured action data. Knowing the intended feature
alone does not prove that a response carries an authorized action.

**How to apply:** Base recovery on existing structured goal/access validation.
Verify saved pending state, first acceptance and the real rendered control—not
just natural-sounding handoff text.

Nutrition coaching must remain independent of feature suitability. A valid
feature proposal is not evidence that the member's nutrition question was
answered, and a shorter pitch must never replace substantive advice.

**Why:** Founder Development acceptance still produced a feature-only reply
after a coaching-instruction enhancement passed mocked regressions. The previous
diagnostics could not distinguish advice discarded during selection from advice
the model never generated. Subsequent founder Development conversations confirmed
that answer-first behavior improved, but follow-ups describing persistent symptoms
and difficulty eating still received general advice and feature offers without
meaningful clarification or appropriate medical follow-up.

**How to apply:** Exercise the actual selected reply with adversarial split-field
and conflicting-purpose fixtures, not just ideal model outputs. Retain
privacy-limited instruction identity and selection diagnostics. Live coaching
quality remains a separate founder acceptance gate; do not claim it from mocks.
Evaluate meaningful context changes and the use of already answered questions,
not only complete wording or knowledge of available features. Keep conversational
clarification distinct from changing clinical thresholds or expanding data access.

For drink-related recommendations, the founder wants better suitability and
timing, not fewer recommendations at all costs. Do not replace poor Beverage
Creator offers with a blanket prohibition during nutrition guidance or an
automatic symptom-to-Hydration rule. Liquid Nutrition Support must not be
positioned as independently designing a medical liquid diet.

**Why:** The founder approved the feature-understanding audit's distinction
between making a drink and needing help with eating or drinking, while explicitly
preserving useful feature offers and the implemented features' limits.

**How to apply:** Keep underlying need, proposed drink format, verified capability
and conversational timing separate. The approved correction is Development-only;
live model acceptance and any Production release need separate authorization.
