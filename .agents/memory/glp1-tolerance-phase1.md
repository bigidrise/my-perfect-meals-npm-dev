---
name: GLP-1 Daily Tolerance — Phase 1 Architecture
description: Governance contract, data model, surface coverage, and test structure for the daily tolerance aggregator
---

## Rule Registry Governance Contract

Three access paths — use the right one:

| Function | When to use |
|---|---|
| `getRule(id)` | Audit/admin display only — returns any non-removed rule including pending_review |
| `getExecutableRuleValue(id, fallback)` | Production numeric values — blocks pending_review (fail-closed) |
| `assertRuleApproved(id)` | Boolean escalation gate — returns null for pending_review |

**Why:** A pending_review rule may display in audit logs but must NEVER affect recommendations. "Warning icon = approved" is a governance failure. `getRuleValue()` was broken — it returned pending_review values. It's now deprecated.

## Audit Collections (DailyMedicationTolerance)

```ts
rulesApplied:  string[]  // approved rules that influenced output
rulesWithheld: string[]  // pending_review rules blocked (fail-closed)
rulesEvaluated: string[] // union — complete audit trail
safetyEscalations: string[]    // provider-contact directives (SAFETY — not nutrition)
nutritionAdaptations: string[] // meal modification directives (safe for prompts)
```

**Why:** Safety escalations and nutrition adaptations must be separate. A generator or coach must never reframe "contact your provider" as a dietary preference. The old `rulesFired[]` mixed everything.

## Data Model

- `glp1_profile` — base row per user; canonical schema: id, user_id UNIQUE, guardrails JSONB, created_at, updated_at. Nothing else. Do NOT add tolerance columns here.
- `glp1_daily_tolerance` — dated snapshot, one row per user per day, UNIQUE(user_id, tolerance_date). This is a time-series table; upsert on re-resolution.
- Canonical migration files: `migrations/0005_create_glp1_profile.sql`, `migrations/0009_create_glp1_daily_tolerance.sql`
- Boot migrations in BOTH server/index.ts AND server/prod.ts (LMS pattern)

## Routes

- `GET /api/glp1/daily-tolerance` — read-only resolver; never writes to DB
- `POST /api/glp1/daily-tolerance` — resolves and upserts to glp1_daily_tolerance

## Surface Coverage

Tolerance flows via `conditionGuidanceBlocks` in the protocol envelope. `enforceBeforeGenerate()` at line 1695 injects them into ALL generator prompts that call it.

| Surface | Path | Status |
|---|---|---|
| GLP-1 Builder | unifiedMealPipeline → loadUserProtocolEnvelope + enforceBeforeGenerate | ✓ wired |
| Snack Creator | generateSnackFromCravingUnified → unifiedMealPipeline (same path) | ✓ wired |
| Weekly Board | generateImmediatePlan (plan read); generation goes through unified pipeline | ✓ wired |
| Coach's Corner | coachCorner.ts does NOT use protocolEnvelope | ❌ needs explicit wiring |

Coach's Corner wiring is deferred — it needs direct glp1DailyTolerance read + safetyEscalations surfaced as coaching language (NOT meal directives).

## Prompt Block Layout

`buildGlp1ToleranceBlock()` in protocolEnvelope.ts:
1. SAFETY DIRECTIVES FIRST (━━━ markers, unmistakably urgent)
2. Nutrition Adaptations (meal constraints, safe for planning)

## Tests

- `server/services/glp1/__tests__/ruleRegistry.governance.test.ts` — 25 tests
- `server/services/glp1/__tests__/toleranceDerivation.test.ts` — 90 tests
- `server/services/glp1/__tests__/resolveGLP1MealTargets.test.ts` — 57 tests (original)
