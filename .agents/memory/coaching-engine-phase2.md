---
name: Universal Coaching Engine — Phase 2 Complete
description: Engine core files, wiring decisions, and known gotchas for Phase 3 continuation
---

## What Phase 2 built

Full engine core — safety gate, confidence scorer, pattern matcher, style resolver, 8 observer stubs, Corner adapter, main CoachingEngine class with two-pass LLM pipeline, and the API route.

## Key files

- `server/services/coaching/safety.ts` — 8 hardcoded global adult red flags; `buildSafetyResponse()` for gate triggers
- `server/services/coaching/confidence.ts` — server-side only; `scoreConfidence()` → `ConfidenceAssessment`; `getConfidenceInstructions()` injects level into render pass
- `server/services/coaching/patternMatcher.ts` — DB query + predicate evaluation; returns `MatchedPattern[]` sorted by coverage
- `server/services/coaching/styleResolver.ts` — reads `coaching_profiles` columns; `resolveStyle(userId)` → `StyleResolution`
- `server/services/coaching/observers/stubs.ts` — 8 stubs returning empty findings; `runObservers()` + `selectObservers()`
- `server/services/coaching/adapters/cornerAdapter.ts` — Corner specialization; adult-only, all 8 observers
- `server/services/coaching/adapters/index.ts` — `getAdapter(specialization)` registry; throws 400 for unimplemented specs
- `server/services/coaching/engine.ts` — `CoachingEngine` class + `engine` singleton; 16-step pipeline; GPT-4o two-pass
- `server/routes/coachingEngine.ts` — 4 routes; mounted at `/api/coach` (no extra auth middleware — requireAuth is inside the router)
- `server/db/seeds/coachKnowledgePatterns.ts` — idempotent seed via `ON CONFLICT DO NOTHING`; 5 adult patterns

## Wiring

- Route mounted in `server/routes.ts` at line after the pregnancy coach mount
- Seed called from `server/index.ts` at 7500ms setTimeout (after migration at 6000ms)
- Boot migration (`runCoachingEngineMigration`) still called at 6000ms in both `index.ts` and `prod.ts`
- `prod.ts` still needs the seed call at equivalent offset (prod.ts uses `database` as var name, not `db`)

## Bugs fixed during Phase 2

1. Seed file had wrong import path (`../db` → `../../db` from `server/db/seeds/`)
2. `Evidence` interface has no `predicate` field — `detectObserverConflict()` uses `e.quality !== "missing"` instead
3. `db.execute<T>` generic requires `T extends Record<string, unknown>` — `RawPattern` and `CoachingProfileRow` both now `extend Record<string, unknown>`
4. `ObserverConfig` was missing `sourcesQueried?: string[]` — added to the interface in `shared/coaching/types.ts`

## Phase 3 must-know

- The 8 observer stubs each document which DB tables they will query (in their `sourcesQueried` field)
- `Evidence.predicate` does NOT exist — if Phase 3 needs predicate-level conflict detection, add a `predicate?: string` field to the `Evidence` interface
- `ObserverOutput.sourcesQueried` is string[] on the type; stubs return empty arrays
- Knowledge patterns seeded: `rapid_weight_gain`, `weight_loss_plateau`, `fatigue_low_energy`, `cravings`, `restaurant_eating` (all `is_active=true`, `specialization='corner'`)

**Why:** These wiring details are not visible from the code without reading all files; the bug patterns are non-obvious and will recur in Phase 3.

**How to apply:** Before starting Phase 3 observers, read this file. Before any `db.execute<T>()` call, make T extend `Record<string, unknown>`.
