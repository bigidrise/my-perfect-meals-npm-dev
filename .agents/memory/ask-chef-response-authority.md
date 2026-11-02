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

Contract-rejection recovery must be useful as well as nonempty. Neither a longer
canonical reply nor an independent variant is trustworthy merely because it
contains letters. Rejected metadata must never supply navigation authority.

**Why:** Founder acceptance exposed emoji shortcodes and generic acknowledgments
as saved replies after purpose rejection, despite passing synthetic conversation
tests. Shortcodes contain letters, so a symbol-only check is insufficient.

**How to apply:** Test contradictory cross-field metadata and both text candidates
through the actual persistence path. Prefer truthful deterministic recovery when
neither candidate is safe and useful. Use closed contract indicators to diagnose
failures without retaining private model or member prose; live judgment remains
a separate founder-approved gate.

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

Ask Chef's primary role is the conversational front door to My Perfect Meals:
understand the member's goal, ask only what identifies the right verified
destination, and help them get there. This product goal includes consumer,
lifestyle, clinical, professional, business and organizational services, but does
not imply that all pathways are implemented or approved. Within food guidance,
favor practical choices rather than a diagnostic interview; do not automatically
investigate symptoms or medication effects. Necessary care and genuinely
safety-critical questions still take priority.

**Why:** The founder established the broader conversational-front-door purpose
while preserving "Coach first. Food decision next. Feature when useful. Medical
care when necessary."

**How to apply:** Do not treat naming familiar food options as recipe generation.
Use answered preferences without restarting discovery, retain verified feature
limits, and keep serious warning signs ahead of food or navigation suggestions.
Business or professional interest never proves role authority, enrollment
availability or an approved navigation destination.

Treat serving counts and occasion words as context, never standalone routing
rules. The founder positions Craving Creator around immediate sweet or savory
cravings, including multiple servings; Dessert Creator around a complete dessert;
Create a Dish around a chosen recipe; Gatherings around the full occasion.

**Why:** The founder explicitly rejected single-serving-only craving assumptions
and holiday-keyword routing. More specific requests should require fewer questions.

**How to apply:** Leave destination-owned settings to the destination. Preserve the
original member request through existing grounded transfer only, with concise
guidance after consent; no repeated permission or request restatement. Actual
feature capability, access and necessary care still override conversational speed.

Broader circumstances provide context; the immediate activity determines the
verified feature. A cruise buffet request belongs to buffet selection rather
than automatically to general Getaway guidance. Travel context must not be
assumed to include every specialized dining workflow.

**Why:** The founder explicitly requires context-versus-activity reasoning across
the platform, rather than routing on a cruise, holiday or athletic keyword.

**How to apply:** Prefer a verified specific workflow for the clear current task.
Clarify only unresolved activity, and never use a broader contextual destination
to bypass unavailable access or invent an internal handoff.

After a valid feature handoff, Chef should identify the destination, briefly
explain a few relevant verified controls or starting actions, and stop at the
existing navigation button. Preserve conversational warmth, but omit scripted
sign-offs, generic encouragement and invitations for more help. This applies
across destinations, not just Sushi Creator; it is not a request for a fixed
tutorial or a runtime blacklist.

**Why:** The founder found “Enjoy your culinary adventure!” unnecessary after a
successful Sushi Creator handoff and requested practical, feature-specific
directions instead.

**How to apply:** Refine Development instructions and source-verified knowledge
without changing navigation authority or borrowing controls from another
creator. Keep necessary safety guidance and requests to skip instructions.
Mocked fixtures prove wiring and contracts, not live stylistic compliance.

For uncertain new members, distinguish planning a day of meals, making one dish
and exploring Lifestyle. Only when meal planning is chosen and its method remains
unresolved, distinguish My Perfect Menu's suggested ideas from Create With Chef
inside a Meal Builder. Create a Dish is a separate single-dish experience.
Clear intent bypasses orientation; prior choices must not be asked again.

**Why:** The founder's live test recommended My Perfect Menu prematurely for
general new-member meal-planning help. They explicitly requested these meaningful
choices, not a compulsory onboarding interview or a platform-wide tour.

**How to apply:** Keep the refinement Development-only. Recommend existing entry
pages once the method is clear, retaining setup/access gates and one confirmation.
Lifestyle's landing page remains knowledge-only without an approved Chef button;
never silently substitute a creator. Do not infer exact setup completion.

Meal Builder handoffs must guide ordinary members into their assigned builder,
not imply they can freely choose among builders. Administrators may have access
to multiple builders; do not infer that authority for a member.

**Why:** The founder confirmed the existing Open Meal Builders landing-page
navigation works and is acceptable, but rejected “select a builder card that
suits your needs” as misleading for ordinary members.

**How to apply:** Keep the Development correction within conversational guidance.
After the single confirmation, explain opening the landing page, then the assigned
builder, day and slot, and Create With Chef. Preserve the existing button and
assignment/access rules; no direct builder navigation or added closing question.
