# Ask Chef Development response-contract repair

## Evidence and uncertainty

The investigated apple-pie exchange produced two `purpose_conflict` rejections.
Both selected `conversationMessage`; the stored replies were a shortcode alone
and a shortcode plus a generic acknowledgment. Neither saved a pending
recommendation or an authorized action. The frontend had no action to render.

Historical full model JSON was not retained. The exact conflicting field and any
rejected Dessert Creator selection remain unknown. This repair does not claim
otherwise and does not add raw model or member-content logging.

## Contract review

- `responsePurpose`, `memberNeed`, `navigationIntent` and the proposed
  `conciergeDecision` must agree. Their consistency validator is unchanged.
- `answer_with_offer` requires recommendation intent, food-assistance mode and
  an eligible member-need classification. Action readiness, access and final
  destination validation remain separate, subsequent checks.
- Development's canonical `message` schema description replaced the base field's
  description, omitting its explicit requirement for matching offer metadata.
  Development now restates that requirement and describes the purpose/need
  combinations. This is an identifiable contract-description gap, not proof of
  the historical model's exact mistake.
- The independent continuation is nullable. It must contain useful standalone
  prose, not a placeholder. Unaccepted offers require no handoff-message variant.
- Validated future permission wording such as “Want me to take you there?” must
  not be confused with a claim that navigation has occurred. The Development
  recommendation screen now distinguishes that bounded question form. It
  neither interprets consent nor relaxes whole-message link/claim screening.

## Fallback behavior

Before: a rejected action could select a continuation merely because it contained
letters or numbers. `:apple:` passed that test. Action-rejection recovery did not
evaluate useful canonical prose as an alternative.

After: both candidates undergo usefulness and whole-message safety screening.
Shortcodes alone, symbols, punctuation, empty text, internal placeholder tokens
and recognized generic acknowledgments cannot be selected as rejected-response
fallbacks. A useful independent continuation keeps precedence; a safe useful
canonical answer can recover an unusable continuation. Length does not establish
trust. No rejected offer is stripped into an apparently safe fragment, and the
unused recommendation variant is never used to manufacture an action.

If neither candidate is useful and safe, a deterministic recovery explains that
the response/handoff could not be completed and nothing has opened. A confirmed
reply without pending state receives a helpful recovery rather than an empty
acknowledgment. Honest informational explanations that Chef cannot open a page
remain valid; opening claims do not.

Existing pending state is retained only under the previously authorized recovery
conditions. A rejected response never creates pending state. A valid
recommendation still stores pending state; its first valid acceptance still
emits the existing confirmed action. Safety precedes purpose validation.

## Diagnostics

Development logs closed member-need/navigation enums, decision/goal presence,
approved destination identity, offer-consistency booleans, candidate outcomes,
selected field, incoming pending-state presence and emitted-action indicators.
After successful persistence, the engine logs whether pending navigation and an
authorized action were stored, correlated by an existing validated request UUID.
Emission and storage are deliberately distinguished.

No raw model response, member prose, profile values, medical details or invalid
metadata values are added to logs. Production descriptions, schemas, fallback
behavior and logging remain unchanged.

## Verification boundaries

Mocked tests cover the known failure, malformed candidates, cross-field
contradictions, both-candidate selection, no-pending acceptance, valid pending
acceptance, authorization, care precedence, canonical payloads, actual persistence
SQL and next-turn history. They prove server contracts, not live model judgment.
No automatic retry, extra model call, new destination or database change is added.
Live AI testing remains paused pending explicit founder approval.

Fallback usefulness screening is deliberately bounded, not a second semantic
model. It cannot establish universal culinary correctness, medical adequacy or
perfect interpretation of every possible acknowledgment.
