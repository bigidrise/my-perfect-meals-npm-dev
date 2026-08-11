---
name: Universal Coaching Engine — Phase 3 Complete
description: 8 real Observer implementations, Evidence interface fixes, Coverage Audit
---

## What Phase 3 built

Replaced all 8 stubs with real DB-connected Observers. Each Observer queries actual MPM tables, documents provenance, and declares NOT YET OBSERVABLE signals explicitly.

## Evidence interface — key fields

```typescript
interface Evidence {
  observer?: string;           // auto-tagged by runObservers(), optional on individual findings
  metric: string;
  window: ObserverWindow;
  value: number | string | boolean | null;   // boolean added in Phase 3
  unit?: string;               // optional; empty for dimensionless metrics
  observedAt?: Date | null;
  quality: EvidenceQuality;
  source: string;              // was "sourceRef" before Phase 3; now "source"
  trend?: "up" | "down" | "stable" | "volatile" | null;
}
```

## Observer files and their primary DB sources

| Observer | File | Primary table(s) | Observability |
|---|---|---|---|
| Weight | weightObserver.ts | biometric_sample (type='weight'), body_fat_entries | SUPPORTED |
| Macro | macroObserver.ts | macro_logs | SUPPORTED |
| Hydration | hydrationObserver.ts | water_logs | SUPPORTED |
| Exercise | exerciseObserver.ts | users.performance_context JSONB, ace_daily_checkins | PARTIAL — no exercise_logs table |
| Restaurant | restaurantObserver.ts | restaurant_guide_sessions | PARTIAL — guide ≠ consumption |
| Behavior | behaviorObserver.ts | coaching_profiles, ace_daily_checkins | SUPPORTED |
| Lifestyle | lifestyleObserver.ts | user_behavior_monthly_summary, macro_logs.alcohol, saved_meals | PARTIAL — no beverage/fridge_rescue tables |
| Compliance | complianceObserver.ts | macro_logs, water_logs, ace_daily_checkins, biometric_sample | SUPPORTED |

## Runner auto-tagging

`runObservers()` in stubs.ts now auto-tags every Evidence item with `observer: id` after the observer returns, so individual observers don't need to set it per-finding.

## EvidenceKey in patternMatcher.ts

`observer` field made optional (`observer?: string`) to match the Evidence interface. `value` updated to `number | string | boolean | null`.

## Coverage Audit

Full audit at `docs/coaching-engine/observer-coverage-audit.md`.
Key NOT YET OBSERVABLE gaps:
- exercise_logs (no table) — actual workouts not visible
- restaurant consumption (no column in macro_logs) — guide ≠ visit
- daily_nutrition_prescriptions (no table) — macro targets not persistent
- beverage_logs (no table) — coffee/juice/sports drinks invisible
- activity_events (no table) — fridge rescue, builder starts, shopping list invisible

## Index adequacy warnings (from audit)

- macro_logs: no composite index on (user_id, at) — acceptable at current scale, watch at growth
- restaurant_guide_sessions: no (user_id, generated_at) composite — same caution
- saved_meals: no composite on (user_id, created_at) — same caution

**Why:** These observability gaps and index notes are non-obvious from code alone and will recur in Phase 4 planning.

**How to apply:** Before Phase 4, read the Coverage Audit and this file. Address highest-impact gaps (exercise_logs, macro targets table) before building Coach's Corner UI.
