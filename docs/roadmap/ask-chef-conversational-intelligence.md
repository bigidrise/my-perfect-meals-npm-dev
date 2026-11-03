# Ask Chef Conversational Intelligence roadmap

## Status and approval boundaries

This document records planned requirements and the existing phase boundaries.
It does not authorize implementation or claim that planned behavior is released.

- **Phase 1 — Trustworthy Member Context:** Preserve the current implementation.
  Code-level and automated-test completion does not establish live conversational
  quality. The controlled, authenticated Development conversation review remains
  a separate verification step.
- **Phase 2 — Conversational memory:** On hold pending explicit approval and
  review of the four live Development responses. Do not begin memory
  implementation, extraction or retrieval work on the strength of this document.
- **Purposeful Conversational Follow-Through:** Planned cross-cutting
  conversational-quality requirement, documented below. Implementation phase
  and scheduling remain unassigned; this is not permission to start Phase 2 or
  alter the current conversation.

## Planned requirement: Purposeful Conversational Follow-Through

### Objective

Ask Chef should behave like a knowledgeable nutrition coach: answer questions
accurately and, when useful, ask a natural follow-up to understand the member's
underlying goal.

The objective is useful coaching, not maximizing conversation length, question
counts, feature use or engagement.

### Example: micronutrients and vitamin-rich foods

When a member asks about micronutrients and vitamin-rich foods, Chef should
explain the nutrients and their food sources first. When the member's purpose
is still unclear and understanding it would improve the next guidance, Chef
may then ask:

> "Are you trying to improve the overall nutritional quality of your meals, or are you concerned that you might be missing certain vitamins or minerals?"

This is an illustrative option, not a mandatory script or required ending.
Do not infer a deficiency from an educational question.

### Behavioral requirements

1. **Answer directly when that is sufficient.** Do not withhold an answer that
   can be given accurately and safely in order to begin an interview.
2. **Explore needs when doing so has a clear purpose.** A follow-up should
   resolve an ambiguity, identify a relevant barrier or preference, or clarify
   the outcome the member wants. Its answer should meaningfully affect what
   Chef would say next.
3. **Personalize from available, authorized context.** Use known goals,
   timelines, allergies, restrictions and saved nutrition evidence where
   relevant. Do not ask again for information already supplied by the account
   context or conversation. Preserve Phase 1's unknown, unavailable, explicit
   none and freshness distinctions; never invent missing facts.
4. **Keep questions natural and proportionate.** Prefer a focused conversational
   question when useful, rather than a multi-part questionnaire. Do not require
   a question after every response or impose a fixed sequence of questions.
5. **Respond appropriately to corrections.** Acknowledge the correction and
   adapt the discussion to the latest stated intent. Do not repeat superseded
   assumptions or restart already answered questions. A conversational
   correction is not permission to overwrite saved goals, macro targets,
   physician-controlled settings or persistent memory.
6. **Recognize when to stop.** Stop asking when the question is answered, the
   need is understood, further questions add no useful information, or the
   member declines further discussion. Answer a later member-initiated question
   normally, without reopening a declined interview.
7. **Avoid engagement tactics and unnecessary promotion.** No generic closing
   question solely to prolong the exchange, irrelevant feature pitch, repeated
   permission offer, or attempt to turn ordinary education into navigation.
   Relevant feature assistance still follows existing consent and authorization.

These requirements do not replace existing safety checks or clinical
authorities, including when a member declines ordinary follow-up discussion.
They do not authorize new clinical inferences, account writes or feature access.

## Planned regression scenarios

All scenarios below are **specifications only: not implemented or executed by
this documentation change**. Future verification must distinguish synthetic
contract checks from observed live model behavior.

| Scenario | Context / member input | Expected behavior | Regression to prevent |
| --- | --- | --- | --- |
| Micronutrient education, unclear purpose | Member asks about micronutrients and vitamin-rich foods; their underlying purpose is unknown. | Explain nutrients and food sources accurately, respecting known restrictions. Consider one relevant question distinguishing general meal quality from concern about missing nutrients. | Interview instead of answering; assuming a deficiency; unrelated feature promotion; mandatory scripted closing. |
| Micronutrient education, purpose already known | The available conversation says the member wants better overall meal quality, not deficiency assessment. | Use that purpose to provide relevant food-based guidance. Ask only if a different material uncertainty remains. | Asking the example question again despite already knowing its answer. |
| Weight-management coaching | Synthetic context supplies a weight goal, timeline, saved targets and relevant restrictions; barriers are not yet known. Member asks for help reaching the goal. | Ground advice in the known facts without recalculating targets. If useful, explore an unknown practical barrier, such as which part of following the plan is difficult. | Re-asking goal/target facts; inventing progress or habits; ignoring restrictions; imposing a rigid intake questionnaire. |
| Weight-management guidance with missing context | The relevant goal or target is unknown/unavailable. | Be honest about the gap. Give appropriately bounded guidance and clarify only information that matters to the member's request. | Inventing a calorie target, deadline, weight history or clinical clearance; treating missing data as confirmed none. |
| Short factual question | Member asks a narrow factual nutrition question with no consequential ambiguity. | Give a concise, accurate answer. A follow-up is not required. | Padding the answer with a generic engagement question, personal-data interview or feature offer. |
| Member correction | After discussing weight loss, the member says, "Actually, I want to maintain my weight now." | Acknowledge and use the corrected conversational goal. Do not claim the saved account goal or targets were updated. Ask another question only if the correction leaves a relevant uncertainty. | Continuing weight-loss advice; requesting the same correction again; silently changing saved data or claiming persistent recall. |
| Member declines further discussion | Member says, "Just answer the question, please," or "I don't want to discuss my goals." | Respect the boundary, answer what can be answered, and stop ordinary probing. Preserve existing safety obligations. | Another engagement question, "Are you sure?", pressure to disclose, or a feature pitch replacing the declined discussion. |
| Need already understood / natural completion | The member's purpose is clear, relevant facts are available, and Chef has provided sufficient guidance. | Complete the answer naturally without forcing another question. | Endless clarification or a requirement to always end with a question. |

### Review criteria for a future implementation

- Evaluate whether the answer was accurate, relevant and complete before
  judging whether a follow-up helped.
- Judge questions by the information they could usefully resolve, not by
  whether every reply contains one.
- Verify continuity across turns: use supplied facts, honor corrections, avoid
  repetition and respect declined discussion.
- Verify that both asking a useful question and ending without a question can
  be correct outcomes. Do not score an optional follow-up as universally required.
- Record live replies separately from mocked fixtures; neither passing fixtures
  nor this roadmap proves real-model adherence.

## Change boundary

This addition is documentation/planning only. It does not change prompts,
runtime code, schemas, navigation, premium authorization, clinical protocols,
saved targets, account data, model configuration or feature flags. No paid AI
calls, deployment or Phase 2 work is authorized by this addition.
