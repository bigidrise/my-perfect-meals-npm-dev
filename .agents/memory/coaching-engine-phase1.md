---
name: Coaching Engine Phase 1 — Contracts & Schema
description: What was built in Phase 1, critical non-obvious decisions, and boot migration pattern for the 9-table coaching engine.
---

## What was built

- `shared/coaching/types.ts` — full TypeScript contract for the engine (CoachSubject, Evidence, ObserverOutput, EvidenceDelta, ReasoningResult, CoachResponse, TodayPlan, TodayPlanItem, memory types, specialization adapter interface, observer interface)
- `shared/coaching/schemas.ts` — Zod schemas for all LLM-produced output (ReasoningResultSchema, CoachResponseSchema, MemoryCandidatesSchema, EvidenceDeltaSchema)
- `server/db/schema/coaching.ts` — 9 Drizzle table definitions with all indexes
- `server/db/migrations/runCoachingEngineMigration.ts` — shared boot migration function, called from both index.ts and prod.ts

## 9 tables created

1. `coach_conversations` — one open conversation per user per specialization
2. `coach_messages` — append-only conversation turns (role: user | assistant | system)
3. `coach_investigations` — full evidence + pattern match audit trail per response
4. `coach_action_plans` — "Today's Plan" persisted; drives follow-up loop
5. `coach_action_items` — individual checklist items within a plan
6. `coach_followups` — scheduled check-ins from the daily job
7. `coaching_memories` — coach-owned long-term memory per specialization
8. `nutrition_memories` — platform-wide nutrition preferences (read by all features)
9. `knowledge_patterns` — versioned, clinically approved pattern library (is_active=false by default)

## Critical boot migration pattern in server/index.ts

The setTimeout block at module level (outside `start()`) does NOT have `db` in scope.
Must dynamically import it:

```typescript
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { runCoachingEngineMigration } = await import("./db/migrations/runCoachingEngineMigration");
    await runCoachingEngineMigration(db);
  } catch (err: any) {
    console.error("❌ Coaching Engine boot migration failed:", err.message);
  }
}, 6000);
```

In `server/prod.ts` the variable is `database` not `db` — check the local binding before passing.

**Why:** `db` in index.ts is only available inside `start()` via `const { db } = await import("./db")` at line 625. Module-level setTimeouts don't close over it.

## Phase 2 next

Engine core: safety gate, confidence scoring, pattern matcher, style resolver, two-pass LLM pipeline, validation. Stop after Phase 2 for architecture review before Phase 3 (Observers).
