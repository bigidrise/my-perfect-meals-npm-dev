---
name: Universal Coaching Engine — Phase 3B Complete
description: Platform Observability infrastructure — event stream, prescription persistence, 4 observer upgrades
---

## What Phase 3B built

Platform observability infrastructure so the coaching engine can distinguish what users actually *do* from what they *look at*.

## Governing Rule: Usage ≠ Consumption

Every event in platform_activity_events has an `event_class`:
- `usage` — feature opened/generated/explored
- `engagement` — deliberate action (save, add to list, scan)
- `consumption` — confirmed consumption (Add to Macros, logged)
- `outcome` — platform-recorded result

The engine MUST NEVER treat a `usage` event as proof of consumption.

## New Tables

### platform_activity_events
- owner_user_id, subject_type (user|child), subject_id
- event_type, event_class, source_feature
- entity_type, entity_id, metadata JSONB
- occurred_at, created_at
- 3 indexes: (owner+occurred), (subject+type+occurred), (owner+event_type+occurred)

Subject-aware: parent events for a child use subject_type='child', subject_id=child_profile_id. Observers must always filter WHERE subject_type='user' for adult coaching context.

### daily_nutrition_prescriptions
- user_id, date (UNIQUE pair)
- target_calories, target_protein, target_total_carbs, target_starchy_carbs, target_fibrous_carbs, target_fat
- source: 'macro_calculator' | 'performance_overlay' | 'procare'
- performance_day_type (overlay name when Performance Mode active)
- Upsert: ON CONFLICT (user_id, date) DO UPDATE

## Instrumented Surfaces (server-side, fire-and-forget)

| Event | Class | Route |
|---|---|---|
| restaurant_recommendations_generated | usage | server/routes/restaurants.ts (both AI + verified branches) |
| beverage_generated | usage | server/routes/beverage-creator.ts |
| dessert_generated | usage | server/routes/dessert-creator.ts |
| fridge_rescue_generated | usage | server/routes.ts /api/meals/fridge-rescue |
| meal_saved | engagement | server/routes.ts /api/saved-meals/toggle |
| shopping_item_added | engagement | server/routes.ts /api/shopping-list |

NOT YET emitted (Phase 4 — requires UI wiring):
- restaurant_meal_added_to_macros (consumption)
- beverage_added_to_macros (consumption)
- meal_added_to_macros (consumption)

## Prescription Persistence

`POST /api/macro-calculator/compute` (macroCalculatorRoutes.ts) now fire-and-forgets a daily_nutrition_prescriptions upsert after every compute. Handler made async. userId from `(req as any).authUser?.id`.

result structure: `{ target: calories, macros: { protein.g, carbs.g, carbs.starchy, carbs.fibrous, fat.g } }`

## Observer Upgrades

### Macro Observer
- Added daily_nutrition_prescriptions query
- Computes calorie_adherence_pct_7d and protein_adherence_pct_7d when both intake + targets available
- Query is non-fatal (try/catch with warn) — table may not exist in older envs

### Restaurant Observer
- Queries platform_activity_events for restaurant_recommendations_generated (usage) and restaurant_meal_added_to_macros (consumption)
- Reports usage vs consumption gap signal when high usage + zero confirmed
- Observability boundary: confirmed consumption remains PARTIAL until Phase 4 UI wires Add to Macros → event

### Lifestyle Observer
- Queries platform_activity_events for all feature usage events (7d + 30d)
- beverage_generated, dessert_generated, fridge_rescue_generated, meal_saved, shopping_item_added, product_scan_completed
- Reports platform_feature_richness_7d (count of distinct feature types used)
- Non-fatal fallback to missing markers if table not yet in env

### Compliance Observer (redesigned)
- Renamed framing: "Compliance" → "Data Coverage"
- Queries platform_activity_events for usage/engagement/consumption event counts (7d)
- Adds gap: platform_active_but_no_confirmed_consumption
- data_coverage_score (0–100) is PRESENTATION ONLY — engine must NOT reason from composite
- Individual signal findings are authoritative

## Boot Migration

- server/index.ts: setTimeout at 8500ms — runPhase3BMigration(db)
- server/prod.ts: setTimeout at 11000ms — runPhase3BMigration(dbP3b)
- Migration: server/db/migrations/runPhase3BMigration.ts (idempotent IF NOT EXISTS)

## Coverage Audit Updated

docs/coaching-engine/observer-coverage-audit.md — full Phase 3B status with signal table, acceptance test, and Phase 4 upgrade list.

**Why:** Phase 4 (Coach's Corner UI) requires confirmed consumption events from the UI layer. Phase 3B instrumentes the server side; Phase 4 must wire the client side (Add to Macros buttons → POST /api/coach/activity-event or inline event param).

**How to apply:** Before Phase 4, read the Coverage Audit acceptance test section. Wire consumption events from: Restaurant Guide Add to Macros, Beverage Add to Macros, Meal Add to Macros.
