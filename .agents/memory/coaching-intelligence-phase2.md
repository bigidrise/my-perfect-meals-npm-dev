---
name: Coaching Intelligence Layer — Phase 2 (Reasoning Library + Supportive Accountability Doctrine)
description: Architecture decisions, non-obvious rules, and file map for Phase 2 — server-controlled coaching reasoning library and governing behavioral doctrine.
---

## What Phase 2 adds

Phase 2 has two layers:

**Layer 1: Reasoning Library** — 5 situation-specific coaching logic families that constrain the LLM to server-approved interpretations, permitted actions, and forbidden conclusions.

**Layer 2: Supportive Accountability & Reinforcement Doctrine** — A governing behavioral layer above all reasoning families that controls HOW every coaching interaction approaches a person. Shared by Coach's Corner, Pregnancy Coach, and Parent's Corner.

## Reasoning Library — New files

| File | Purpose |
|---|---|
| `server/services/coaching/reasoningLibrary/index.ts` | Registry — exports all families, PRIMARY_FAMILIES, MODIFIER_FAMILIES |
| `server/services/coaching/reasoningLibrary/families/persistentHunger.ts` | Hunger family |
| `server/services/coaching/reasoningLibrary/families/planNotWorking.ts` | Consistency-Before-Adjustment family |
| `server/services/coaching/reasoningLibrary/families/cravings.ts` | Craving driver identification |
| `server/services/coaching/reasoningLibrary/families/weightChangePlateau.ts` | Weight trend vs artifact |
| `server/services/coaching/reasoningLibrary/families/lowEnergy.ts` | Fatigue/energy investigation |
| `server/services/coaching/reasoningLibrary/families/reinforcement.ts` | Modifier — participation improvement acknowledgment |
| `server/services/coaching/reasoningFamilyMatcher.ts` | Scores + selects family; builds + renders brief |

## Doctrine — New files

| File | Purpose |
|---|---|
| `server/services/coaching/doctrine/supportiveAccountabilityDoctrine.ts` | Governing principle, state playbooks, hard prohibition, behavior vs outcome distinction |
| `server/services/coaching/doctrine/behaviorProgressClassifier.ts` | Server-side classifier; `renderBehaviorSignalBlock()` |
| `server/services/coaching/doctrine/index.ts` | Public API for all three surfaces |

## Modified files

- `shared/coaching/types.ts` — Added `BehaviorProgressState`, `BehaviorProgressSignal`, plus all reasoning library types
- `server/services/coaching/engine.ts` — Steps 12.5 + 12.6; both LLM pass system prompts include doctrine; both user prompts include behavior signal block + reasoning brief block
- `server/routes/pregnancyCoach.ts` — Imports + injects `generateDoctrineSystemPromptSection('pregnancy')`
- `server/routes/myPerfectBeginning.ts` — Imports + injects `generateDoctrineSystemPromptSection('parent')` in `buildSystemPrompt()`

## Architecture rules

### Evidence pattern states (describe data, NOT the person)
- `consistent` — 5+ of 7 days logged, adherence reasonable
- `improving` — recent period meaningfully better than monthly baseline, or recovery detected
- `inconsistent` — some participation, gaps or below-target adherence
- `declining` — recent week meaningfully worse than monthly baseline
- `insufficient_evidence` — <2 days of logging data

### Recovery detection (tightened threshold)
Recovery fires ONLY when:
1. Monthly participation was genuinely low (< 30% of days = < 9/30)
2. Recent week is meaningfully higher (weeklyRate > monthlyRate + 0.15)
3. They logged at least 2 days this week
OR: logged today with ≤1 day that week (truly returning from absence).
Does NOT fire for someone consistently logging 5/7 days who happens to have a lower monthly average.

### Doctrine injection points
- **System prompt**: `generateDoctrineSystemPromptSection(surface)` injected into both LLM passes via `doctrineSectionForReasoning` / `doctrineSectionForRendering` (computed inline from specialization='corner')
- **User prompt**: `behaviorSignalBlock` stored in `additionalContext.behaviorSignalBlock`, stripped from JSON dump, injected before reasoning brief block
- Pregnancy Coach and Parent's Corner: import `generateDoctrineSystemPromptSection` directly and call it inside their system prompt template strings

### Pipeline sequence
```
Step 12.5: matchReasoningFamily() → reasoningBriefBlock
Step 12.6: classifyBehaviorProgress() → behaviorSignalBlock
Step 13:   reasoning pass (doctrine in system prompt, behavior signal + brief in user prompt)
Step 15:   rendering pass (doctrine in system prompt, behavior signal + brief in user prompt)
```

### Null guard in classifier
`extractBehaviorHighlights` checks `snapshot?.today?.checkin` before accessing fields.
Pass a null snapshot when no Phase 1 context is available (Pregnancy Coach, Parent's Corner).

### Phase 2.5 — All three surfaces now functionally alive

`getComplianceBehaviorSignal(userId)` is a shared helper in `behaviorProgressClassifier.ts` that:
1. Runs one lightweight SQL query against `macro_logs` (column is `at`, not `created_at`)
2. Builds a compliant `ObserverOutput` (fields: `ranAt: Date`, `windowsCovered: ObserverWindow[]`, `sourcesQueried: string[]`, `findings: Evidence[]`)
3. Calls `classifyBehaviorProgress()` and returns a ready signal

Both Pregnancy Coach (`server/routes/pregnancyCoach.ts`) and Parent's Corner (`server/routes/myPerfectBeginning.ts`) now:
- Import `getComplianceBehaviorSignal` + `renderBehaviorSignalBlock` from the doctrine module
- Call it in their POST /ask handler before building the system prompt (non-fatal — degrades gracefully)
- Append the rendered signal block to their system prompt (Pregnancy Coach: inside template string via `behaviorSignalSection`; Parent's Corner: appended after `buildSystemPrompt()` returns)

### Critical ObserverOutput shape (found via runtime TS errors)
```typescript
interface ObserverOutput {
  observerId: string;
  findings: Evidence[];
  ranAt: Date;                   // NOT 'completedAt'
  windowsCovered: ObserverWindow[]; // string union array, NOT objects
  sourcesQueried: string[];
}
```
And `Evidence.observedAt` is `Date | null`, NOT `string`.

## Pre-existing TS errors in pregnancyCoach.ts
Lines 145/459/531: `getConversation(userId)` called before null check on userId. Pre-existing, not caused by Phase 2.

## The shared doctrine is a pure function
`generateDoctrineSystemPromptSection(surface)` has no DB queries, no state.
Safe to call inline inside template strings and system prompt builders.
Each surface passes its own context tag ('corner' | 'pregnancy' | 'parent') for surface-specific notes.

## Forbidden conclusions (cross-family)
Core rules enforced in every family's brief:
- Never recommend willpower for hunger/cravings
- Never declare fat gain from <3 days of scale data
- Never change a prescription without adherence evidence
- Never diagnose medical conditions
- Never attribute missing data to noncompliance

## Governing objective (verbatim)
"Every coaching interaction should increase the user's willingness and confidence to take
the next positive action — without sacrificing honesty, accuracy, or appropriate accountability."
