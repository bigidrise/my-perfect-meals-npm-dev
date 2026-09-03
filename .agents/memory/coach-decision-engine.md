---
name: Coach Decision Engine architecture
description: Situation-agnostic engine + per-situation adapter pattern for Coach's Corner
---

Coach's Corner coaching logic is split into two layers:
- `server/services/ace/coachDecisionEngine.ts` — the shared, situation-agnostic
  pipeline (`resolveCoachingResponse`). It must NEVER branch on situation
  identity (no `if (situation === "tired")`). It only orchestrates:
  adapter.determineIntent -> adapter.buildRecommendation.
- Situation Adapters (e.g. `progressSlowedEngine.ts`, `tiredEngine.ts`) —
  each implements `SituationAdapter<TContext, TFollowUp, TProfile>` from
  `shared/coachCornerTypes.ts` and owns ONLY that situation's evidence shape,
  follow-up questions, intent-selection logic, and recommendation content.

**Why:** the user explicitly rejected a per-situation "mini-engine" pattern
and also rejected embedding situation knowledge into a shared engine. Adding
a new situation must mean writing a new adapter file, never touching the
engine file.

**How to apply:** every new Coach's Corner situation gets: (1) its own
context/follow-up types in coachCornerTypes.ts, (2) its own adapter file
implementing SituationAdapter and calling resolveCoachingResponse, (3) its
own route handlers for context/resolve, (4) its own coaching_profiles
continuity columns (`<situation>_last_intent/recommendation/at`) added via a
migration script in `scripts/`, (5) its own client page mirroring
CoachCornerProgressSlowed.tsx's UI pattern (merged single message, no
Science/Philosophy labels — see coach-corner-response-pipeline.md).
