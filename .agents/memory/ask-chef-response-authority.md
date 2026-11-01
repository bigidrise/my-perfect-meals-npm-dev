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
