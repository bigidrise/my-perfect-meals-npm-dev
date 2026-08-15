---
name: Dish Adaptation Layer
description: Identity-preserving meal generation — DAL directive, substitution map, identity validator; how they wire into craving-creator.
---

# Dish Adaptation Layer (Phases 2–4 shipped)

Architecture authority: `docs/dish-adaptation-layer/ARCHITECTURE.md`.

**Rule:** protocol compliance may change ingredients/prep/portion, never the requested dish. If the dish can't be made compliant, return HTTP 400 `dishIdentityFailure: true` naming the conflicts — never a silent generic plate.

Key design decisions (non-obvious):
- **No hardcoded dish tables.** Dish decomposition comes from one gpt-4o-mini call (temp 0, max_tokens 200, JSON); substitutions come from `shared/dishAdaptation/guardrailSubstitutionMap.ts`, which is *extracted* from existing prompt builders (each profile cites its source file). When a builder's substitution text changes, the map must be updated in lockstep.
- **LRU cache is mandatory** (`dishAdaptationCache.ts`, max 500 / 24h TTL, key = hash(dish + sorted guardrail IDs)). The cache stores the decomposition + conflicts core; the adaptationBlock is re-rendered per callContext, so first_pass and fallback share one LLM call. Fallback rendering appends the explicit "DO NOT return a generic protein plate" line — fallback prompts must be MORE specific than first pass, never less.
- **Identity validator is rule-based, no LLM** (`dishIdentityValidator.ts`): name-token match + defining-component keyword presence. Catastrophic = zero name relation AND <1/3 defining components. Only catastrophic deviations are filtered in `filterMealsByProtocol` (via `context.dishIdentity`); weak matches are logged but kept to avoid over-filtering renamed-but-valid dishes ("Cajun Cauliflower Rice Stew").
- **Functional-role bias:** role-tagged substitution rules win over generic ones for the same component. A functional role must only be attached to rules whose every blocked ingredient actually performs it (split multi-ingredient rules), and roleRequirement text must never unconditionally name an ingredient another guardrail could block — list universally compliant options first, condition the rest ("egg only where eggs are permitted").
- **Override continuity:** overridden allergens are excluded from `GuardrailContext.activeAllergens`, so the DAL never directs substituting an ingredient the user authenticated-unlocked.
- DAL failure (decomposition error) returns null and generation proceeds unenriched — the identity validator downstream still blocks silent substitution.

Proof matrix: `scripts/proof-dish-adaptation.ts` (7 scenarios + cache proof, live gpt-4o-mini; 35 assertions).

Remaining phases (not shipped): Phase 5 (DAL on dessert/beverage/kids/restaurant/GLP-1 surfaces), Phase 6 (override threading on all surfaces).
