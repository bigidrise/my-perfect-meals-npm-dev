---
name: Coaching Intelligence Layer — Phase 1 (Context & Evidence)
description: Architecture decisions, non-obvious rules, and file map for Phase 1 of the Coaching Intelligence Layer (CoachingContextSnapshot, capabilityRegistry, KNOW→SAY→COACH→LEARN doctrine).
---

## What Phase 1 adds

Phase 1 builds the canonical evidence layer that all coaching surfaces share.
Before Phase 1, the engine had brain + memory but was partially blind — it couldn't answer
"what is happening with this person right now vs what they're supposed to be doing."

After Phase 1:
- Every coaching turn starts with a structured `CoachingContextSnapshot`
- The LLM knows prescription vs. actual intake, today's check-in, meal completeness, data confidence, and which MPM features exist
- The capability registry replaces 3 hardcoded tools with 15+ categorized, filterable features
- KNOW → SAY → COACH → LEARN and Consistency Before Adjustment are baked into both LLM pass system prompts

## New files

| File | Purpose |
|---|---|
| `server/services/coaching/capabilityRegistry.ts` | Canonical MPM feature registry — 15 features with scopes, applicableSituations, eligibilityNote, recommendable |
| `server/services/coaching/coachingContext.ts` | `buildCoachingContext()` + `renderSnapshotForPrompt()` |
| `shared/coaching/types.ts` | Added `FieldValue<T>`, `DataConfidence`, `PromptCapability`, `CoachingContextSnapshot` |

## Modified files

- `server/services/coaching/adapters/cornerAdapter.ts` — imports capability registry; `loadAdditionalContext()` builds snapshot, mutates `availableTools` post-context for overlay-aware filtering; returns `coachingContextBlock` (rendered text) + `coachingContextSnapshot` (structured)
- `server/services/coaching/engine.ts` — reasoning pass: injects `coachingContextBlock` before evidence block, updated system prompt with KNOW→SAY→COACH→LEARN + Consistency Before Adjustment + MISSING vs ZERO distinction; rendering pass: same context block + updated system prompt with opening-calibration doctrine + Reinforcement rule + enforced capability-only redirects

## Non-obvious rules

### FieldValue<T> envelope
Every coaching context field that could be absent uses `FieldValue<T>`:
```typescript
{ value: T | null; status: 'observed'|'zero'|'missing'|'not_applicable'; source?, sourceType?, observedAt? }
```
- `missing()` and `notApplicable()` helpers must be generic: `function missing<T=number>()` — otherwise TypeScript infers `FieldValue<null>` and won't satisfy `FieldValue<number>` in the snapshot shape

### today.meals.completeness
NEVER guessed from count alone. Logic:
- 0 meals → `unknown` (may not have eaten, not just not logged)
- count > 0 but before noon → `unknown` (too early)
- after 8pm + count < 75% of 7d average → `partial`
- after 8pm + count >= 7d average → `complete`
- between noon and 8pm + count >= 7d average → `complete`
- all other cases → `unknown`

### water_logs schema
Column is `amount_ml` (NOT `amount_oz`). Convert: `oz = ml * 0.033814`.
Table: `id, user_id, amount_ml, unit, intake_time, created_at`.

### sleep intentionally omitted from checkin
MPM removed sleep from Today's Check-In. `today.checkin` has no sleep field.
If a future data source provides sleep, add an explicit new field — do NOT add it to checkin.

### Clinical authorization gate
`buildCoachingContext()` takes `permittedClinicalScopes: string[]`.
`cornerAdapter` passes `[]` → no clinical data exposed.
Future specializations (pregnancy, GLP-1, ProCare) will pass their scopes.
The gate is structural, not just a prompt instruction.

### Capability registry filtering
`getCapabilitiesForUser(activeScopes, onlyRecommendable)` — always starts with `["all"]`, then adds overlay scopes.
cornerAdapter computes activeScopes AFTER building context (overlays are known then).
Mutates `cornerAdapter.availableTools` in-place so the engine's rendering pass gets the right list.

### Data confidence classification
- `HIGH`: prescription + today macros both observed → can coach from data
- `PARTIAL`: ≥2 of 4 signals present → note gaps
- `LOW`: 0-1 signals → must not guess; open by acknowledging gap

### Engine prompt injection
`additionalContext` from adapter carries both:
- `coachingContextBlock` (string): injected verbatim before evidence block
- `coachingContextSnapshot` (object): stripped from JSON dump to avoid size explosion

Both passes delete these keys from the JSON dump before serializing `additionalContext` to avoid the snapshot going in twice.

## LLM prompt doctrine added (both passes)

**Reasoning pass system prompt:** KNOW→SAY→COACH→LEARN calibration rules + MISSING vs ZERO distinction + Consistency Before Adjustment rule (check adherence before suggesting prescription change).

**Rendering pass system prompt:** Opening-calibration by DATA CONFIDENCE level + Reinforcement rule (meaningful acknowledgment when participation improves, not gamification) + enforced capability-only redirect rule ("do not invent feature names").

## Verified working
- `buildCoachingContext()` runs successfully against live DB
- All field statuses correctly `"missing"` for a user without today's data
- `dataConfidence: "LOW"` when all today's data is missing
- 10 capabilities returned for a standard user (no overlays)
- Profile data (goal, activity, dietary, specialty_conditions) correctly pulled
- TypeScript: 0 errors in all Phase 1 files
- Pre-existing TS errors in client components are unrelated to this work

## What is NOT in Phase 1 (deferred)

- Phase 2: Reasoning Library patterns (persistent hunger, "plan isn't working", craving, missing info)
- Observers consuming the snapshot instead of re-querying tables (migration is Phase 2)
- Clinical data queries (gate is wired but queries are stubs returning null)
- Pregnancy and Performance coach adapters migrated into universal engine
- REINFORCE detection from compliance observer streak (observer integration is Phase 2)
