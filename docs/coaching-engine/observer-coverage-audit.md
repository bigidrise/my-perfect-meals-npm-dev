# Observer Coverage Audit — Phase 3B
**Updated:** 2026-08-10  
**Status:** Phase 3B complete — platform_activity_events + daily_nutrition_prescriptions live

---

## Executive Summary

Phase 3B closed the most critical observability gaps identified in the Phase 3 audit. The coaching engine can now see meaningful platform behavior — not just static profile data and macro logs.

### Signal Status After Phase 3B

| Observer | Phase 3 Status | Phase 3B Status | What Changed |
|---|---|---|---|
| Weight | ✅ SUPPORTED | ✅ SUPPORTED | Unchanged |
| Macro | ✅ SUPPORTED | ✅ SUPPORTED + Adherence | Now computes intake vs prescription |
| Hydration | ✅ SUPPORTED | ✅ SUPPORTED | Unchanged |
| Behavior | ✅ SUPPORTED | ✅ SUPPORTED | Unchanged |
| Compliance | ✅ SUPPORTED | ✅ SUPPORTED (redesigned) | Structured breakdown; score demoted to "Data Coverage Score" |
| Exercise | ⚠️ PARTIAL | ⚠️ PARTIAL | Unchanged — no workout log table |
| Restaurant | ⚠️ PARTIAL | ⚠️ PARTIAL → near SUPPORTED | Guide usage now in activity events; confirmed consumption in Phase 4 UI |
| Lifestyle | ⚠️ PARTIAL | ⚠️ PARTIAL → near SUPPORTED | Beverage/dessert/fridge/shopping/scan now visible via activity events |

---

## Governing Rules (Phase 3B)

### Usage ≠ Consumption

Every platform_activity_events entry has an `event_class`. The Coaching Engine MUST distinguish:

| Class | Meaning | Example |
|---|---|---|
| `usage` | User opened/generated/explored | restaurant_recommendations_generated |
| `engagement` | User took a deliberate action | meal_saved, shopping_item_added |
| `consumption` | User explicitly confirmed consumption | restaurant_meal_added_to_macros |
| `outcome` | Platform recorded a result | weight_log, plan_completion |

**The engine must NEVER treat a `usage` event as proof of consumption.**

- `restaurant_recommendations_generated` ≠ the user ate at the restaurant
- `beverage_generated` ≠ the user drank the beverage
- `fridge_rescue_generated` ≠ the user ate those meals
- `meal_saved` ≠ the user consumed that meal

### Subject-Aware Events

All events have `owner_user_id` + `subject_type` + `subject_id`. Adult context always has `subject_type='user'`. Observers must always filter `WHERE subject_type = 'user'` to prevent child (My Perfect Beginnings) events from contaminating adult coaching context.

---

## New Infrastructure (Phase 3B)

### `platform_activity_events` table

```sql
id              uuid PRIMARY KEY
owner_user_id   text NOT NULL         -- authenticated user
subject_type    text DEFAULT 'user'   -- 'user' | 'child'
subject_id      text NOT NULL         -- adult: same as owner; child: child_profile.id
event_type      text NOT NULL         -- see PlatformEventType in activityEvents.ts
event_class     text NOT NULL         -- 'usage' | 'engagement' | 'consumption' | 'outcome'
source_feature  text                  -- 'restaurant_guide' | 'beverage_creator' | etc.
entity_type     text                  -- 'meal' | 'beverage' | 'product' | etc.
entity_id       text                  -- optional reference
metadata        jsonb                 -- event-specific payload
occurred_at     timestamptz
created_at      timestamptz
```

**Indexes:** (owner_user_id, occurred_at), (subject_id, subject_type, occurred_at), (owner_user_id, event_type, occurred_at)

**Instrumented surfaces (Phase 3B) — live at runtime, server-side confirmed:**

| Event | Class | Source | Where emitted |
|---|---|---|---|
| `restaurant_recommendations_generated` | usage | `restaurant_guide` | server/routes/restaurants.ts (both AI + verified branches) |
| `beverage_generated` | usage | `beverage_creator` | server/routes/beverage-creator.ts |
| `dessert_generated` | usage | `dessert_creator` | server/routes/dessert-creator.ts |
| `fridge_rescue_generated` | usage | `fridge_rescue` | server/routes.ts /api/meals/fridge-rescue |
| `meal_saved` | engagement | `meal_builder` | server/routes.ts /api/saved-meals/toggle |
| `shopping_item_added` | engagement | `shopping_list` | server/routes.ts /api/shopping-list |

**Schema-supported, NOT yet emitted — Phase 4 (client-side Add to Macros wiring):**
- `restaurant_meal_added_to_macros` (consumption) — type registered, no route emits it
- `beverage_added_to_macros` (consumption) — type registered, no route emits it
- `meal_added_to_macros` (consumption) — type registered, no route emits it
- `product_added_to_diary` (consumption) — type registered, no route emits it

**Infrastructure built, server-side emission NOT YET WIRED:**
- `product_scan_completed` (engagement) — Lifestyle Observer already queries for this event; type is registered in activityEvents.ts; three `/api/barcode/:code` handlers exist in routes.ts (lines 3805, 6051, 6226) but **none call `emitActivityEvent`**. Currently NOT OBSERVABLE. Requires one `emitActivityEvent` call added to the primary barcode handler (line 3805, the NDE-enriched route using barcodeService).

### `daily_nutrition_prescriptions` table

```sql
id                   uuid PRIMARY KEY
user_id              text NOT NULL
date                 date NOT NULL
target_calories      numeric
target_protein       numeric
target_total_carbs   numeric
target_starchy_carbs numeric           -- MPM-specific: starchy vs fibrous split
target_fibrous_carbs numeric
target_fat           numeric
source               text              -- 'macro_calculator' | 'performance_overlay' | 'procare'
source_version       text
performance_day_type text              -- 'training' | 'rest' | overlay name
created_at           timestamptz
updated_at           timestamptz
UNIQUE (user_id, date)
```

**Populated by:** `POST /api/macro-calculator/compute` — upserts today's Resolver output on every calculator hit. Fire-and-forget, never blocks the response.

**Why it matters:** Coach's Corner previously had no way to know what the user was *supposed* to eat. Now it can compute real adherence: "You hit 88% of your protein target on 5 of 7 days."

---

## Observer-by-Observer Status

---

### Weight Observer — ✅ SUPPORTED (unchanged)

| Signal | Status | Source |
|---|---|---|
| Recent weight trend (7d, 30d) | ✅ SUPPORTED | biometric_sample (type='weight') |
| Rate of change (kg/week) | ✅ SUPPORTED | biometric_sample |
| Device-synced vs manual distinction | ✅ SUPPORTED | biometric_sample.provider |
| Body fat % (current + method) | ✅ SUPPORTED | body_fat_entries |
| Scan method quality (DEXA > ultrasound > manual) | ✅ SUPPORTED | body_fat_entries.scan_method |

**Still NOT observable:**
- Body composition change over time (would need consistent body_fat_entries)
- Visceral fat (no column)

---

### Macro Observer — ✅ SUPPORTED + Adherence (Phase 3B upgrade)

| Signal | Status | Source |
|---|---|---|
| Avg daily intake — kcal, protein, carbs, fat, fiber (7d, 30d) | ✅ SUPPORTED | macro_logs |
| Alcohol consumption days (7d) | ✅ SUPPORTED | macro_logs.alcohol |
| Logging frequency (days logged / possible) | ✅ SUPPORTED | macro_logs |
| **Calorie adherence % vs prescription (7d)** | ✅ **NEW** | daily_nutrition_prescriptions + macro_logs |
| **Protein adherence % vs prescription (7d)** | ✅ **NEW** | daily_nutrition_prescriptions + macro_logs |
| **Prescription source (macro_calculator/performance/procare)** | ✅ **NEW** | daily_nutrition_prescriptions |
| Days with prescriptions available | ✅ **NEW** | daily_nutrition_prescriptions |

**Still NOT observable:**
- Meal timing / intermittent fasting patterns (no timestamp detail in macro_logs at meal level)
- Restaurant meal macros (no restaurant origin column in macro_logs)
- Starchy vs fibrous carb adherence (prescription exists; intake breakdown not in macro_logs)

---

### Hydration Observer — ✅ SUPPORTED (unchanged)

| Signal | Status | Source |
|---|---|---|
| Daily water intake (7d, 30d) | ✅ SUPPORTED | water_logs |
| Logging frequency (7d) | ✅ SUPPORTED | water_logs |
| Hydration trend | ✅ SUPPORTED | water_logs |

**Still NOT observable:**
- Electrolyte intake
- Coffee/juice/sports drink contribution (beverage_generated is usage only — Phase 4 consumption events needed)

---

### Behavior Observer — ✅ SUPPORTED (unchanged)

| Signal | Status | Source |
|---|---|---|
| Cravings patterns | ✅ SUPPORTED | coaching_profiles |
| Eating style (structured/intuitive) | ✅ SUPPORTED | coaching_profiles |
| Emotional eating triggers | ✅ SUPPORTED | coaching_profiles |
| Daily energy rating | ✅ SUPPORTED | ace_daily_checkins |
| Satiety/hunger signals | ✅ SUPPORTED | ace_daily_checkins |
| Stress and sleep signals | ✅ SUPPORTED | ace_daily_checkins |

---

### Restaurant Observer — ⚠️ PARTIAL → Near SUPPORTED

| Signal | Phase 3 | Phase 3B | Source |
|---|---|---|---|
| Guide sessions generated (30d, 90d) | ✅ | ✅ | restaurant_guide_sessions |
| Top cuisine explored | ✅ | ✅ | restaurant_guide_sessions |
| Top restaurant explored | ✅ | ✅ | restaurant_guide_sessions |
| **Guide usage events (7d, 30d)** | ❌ | ✅ **NEW** | platform_activity_events (usage) |
| **Usage vs consumption gap signal** | ❌ | ✅ **NEW** | platform_activity_events (inferred) |
| Confirmed meals from guide | ❌ | ⚠️ PARTIAL | platform_activity_events (consumption) — Phase 4 UI needed to wire Add to Macros → event |
| Macros consumed at restaurant | ❌ | ❌ | NOT observable — no restaurant column in macro_logs |
| Restaurant eating frequency vs home | ❌ | ❌ | NOT observable |

**Key insight for LLM renderer:** The observer now distinguishes:
- `restaurant_recommendations_generated` (intent/exploration) — can say "you looked at Restaurant Guide 5 times this week"
- `restaurant_meal_added_to_macros` (confirmation) — can say "you confirmed 2 restaurant meals" (Phase 4)
- If high usage + zero confirmed → coach can appropriately hedge: "I see you were looking at restaurants a lot — did those turn into meals?"

---

### Lifestyle Observer — ⚠️ PARTIAL → Near SUPPORTED (Phase 3B upgrade)

| Signal | Phase 3 | Phase 3B | Source |
|---|---|---|---|
| Monthly consistency score | ✅ | ✅ | user_behavior_monthly_summary |
| Log source distribution | ✅ | ✅ | user_behavior_monthly_summary |
| Alcohol frequency (30d) | ✅ | ✅ | macro_logs.alcohol |
| Meals saved (30d) | ✅ | ✅ | saved_meals |
| **Beverage Creator usage (7d, 30d)** | ❌ | ✅ **NEW** | platform_activity_events (usage) |
| **Dessert Creator usage (7d)** | ❌ | ✅ **NEW** | platform_activity_events (usage) |
| **Fridge Rescue usage (7d)** | ❌ | ✅ **NEW** | platform_activity_events (usage) |
| **Meal saves via builder (7d)** | ❌ | ✅ **NEW** | platform_activity_events (engagement) |
| **Shopping list additions (7d)** | ❌ | ✅ **NEW** | platform_activity_events (engagement) |
| **Product Intelligence scans (7d)** | ❌ | ⚠️ **PARTIAL** | Observer queries `product_scan_completed` but no barcode route emits it — NOT OBSERVABLE at runtime |
| **Platform feature richness (7d)** | ❌ | ✅ **NEW** | platform_activity_events (inferred count, excludes product scans until wired) |
| Whether generated beverages were consumed | ❌ | ❌ | NOT confirmable — Phase 4 consumption events needed |
| Whether fridge rescue meals were eaten | ❌ | ❌ | NOT confirmable — usage ≠ consumption |
| Shopping list items purchased | ❌ | ❌ | NOT confirmable — no purchase confirmation |

**What the engine can now say:**
> "This week you created 4 beverages and used Fridge Rescue twice. You also added 11 items to your shopping list. Your platform engagement is high, but confirmed consumption events are not yet live."

**Note on product scans:** The Lifestyle Observer is built and queries correctly, but `product_scan_completed` is not emitted at runtime. The fix is a single `emitActivityEvent` call in the primary barcode handler (`/api/barcode/:code`, routes.ts line 3805). Until that call is added, `product_scans_7d` always returns 0.

---

### Compliance Observer — ✅ SUPPORTED (redesigned, Phase 3B)

**Phase 3B redesign:** Renamed "Compliance" to "Data Coverage" framing. Primary evidence is now structured per-signal findings. `data_coverage_score` (0–100) is secondary/presentation only — the Coaching Engine MUST NOT reason from the composite number.

| Signal | Status | Source |
|---|---|---|
| Macro log days (7d, 30d) | ✅ SUPPORTED | macro_logs |
| Water log days (7d) | ✅ SUPPORTED | water_logs |
| ACE check-in days (7d) | ✅ SUPPORTED | ace_daily_checkins |
| Biometric weight recency (days ago) | ✅ SUPPORTED | biometric_sample |
| **Platform usage events (7d)** | ✅ **NEW** | platform_activity_events (6 events live) |
| **Platform engagement events (7d)** | ✅ **NEW** | platform_activity_events (2 events live) |
| **Platform consumption events (7d)** | ⚠️ schema only | Types registered; no route emits any consumption event yet — always returns 0 until Phase 4 wires Add to Macros |
| **Usage-without-consumption gap signal** | ✅ **NEW** | platform_activity_events (inferred — flags when usage > 0 but consumption = 0) |
| Data Coverage Score (0–100, presentation only) | ✅ SUPPORTED | composite |
| Evidence tier (strong/moderate/weak/insufficient) | ✅ SUPPORTED | composite |
| Data gaps list | ✅ SUPPORTED | composite |

**Score components (unchanged):**
- Macro logging (7d): 0–40 pts
- Water logging (7d): 0–20 pts  
- ACE check-ins (7d): 0–20 pts
- Biometric recency: 0–20 pts

**New gap signal:**
- `platform_active_but_no_confirmed_consumption` — user was active on platform but no consumption events recorded; coach should not assume logged macros represent all eating

---

### Exercise Observer — ⚠️ PARTIAL (unchanged)

The exercise observability gap is structural — **no `exercise_logs` table exists**. This is the highest-priority Phase 4+ infrastructure gap.

| Signal | Status | Note |
|---|---|---|
| Performance protocol active | ⚠️ PARTIAL | users.performance_context JSONB — schedule, not actual workouts |
| Weekly training days scheduled | ⚠️ PARTIAL | performanceContext.weeklySchedule only |
| Subjective energy/fatigue post-workout | ⚠️ PARTIAL | ace_daily_checkins (soreness, energy) |
| Actual workouts completed | ❌ NOT OBSERVABLE | No exercise_logs table |
| Exercise type, duration, intensity | ❌ NOT OBSERVABLE | No exercise_logs table |
| Calories burned | ❌ NOT OBSERVABLE | No TDEE adjustment possible without workout data |

**Recommended Phase 4+ work:** Create `exercise_logs` table (date, user_id, activity_type, duration_min, intensity, source). Wire Performance Hub's workout completion UI to log entries.

---

## Index Adequacy (unchanged from Phase 3)

| Table | Current Indexes | Recommendation |
|---|---|---|
| macro_logs | user_id only | Add composite (user_id, at) at scale |
| restaurant_guide_sessions | user_id + generated_at (check) | Verify composite exists |
| **platform_activity_events** | **3 indexes: owner+occurred, subject+type+occurred, owner+event_type+occurred** | ✅ Well-indexed |
| **daily_nutrition_prescriptions** | **UNIQUE(user_id, date)** | ✅ Well-indexed |
| water_logs | user_id + intake_time | ✅ Adequate |
| biometric_sample | user_id + type + start_time | ✅ Adequate |

---

## Acceptance Test (from Phase 3B specification)

When asked: "What do we actually know about what this person has been doing for the last 7 days?"

The system should now answer with facts such as:

```
Macro logs:         X / 7 days
Protein adherence:  avg 88% of prescription
Starchy carb:       avg 103% of prescription (prescription source: macro_calculator)
Water:              X / 7 days logged
Weight:             X measurements

Restaurant Guide:   X recommendation sessions
Confirmed meals:    X (from platform_activity_events consumption class) — Phase 4

Beverages:          X generated (usage)
Desserts:           X generated (usage)
Fridge Rescue:      X used (usage)
Meal Builder:       X meals generated, X saved (engagement)
Product Scans:      X completed (engagement)
Shopping List:      X items added (engagement)

Behavior check-ins: X / 7 days
Data Coverage Score: XX/100 (presentation only — engine uses per-signal findings)
```

---

## What Moves to SUPPORTED in Phase 4

When the Coach's Corner UI is built (Phase 4), these consumption events will be wired:
- `restaurant_meal_added_to_macros` — user clicks "Add to Macros" from restaurant guide → Restaurant Observer: SUPPORTED
- `beverage_added_to_macros` — user logs a beverage to macro diary → confirmed consumption
- `meal_added_to_macros` — user logs a builder meal → confirmed consumption
- `product_added_to_diary` — user logs a scanned product → confirmed consumption

With Phase 4 consumption events + the existing Phase 3B usage events, the Lifestyle Observer and Restaurant Observer both reach **SUPPORTED** status.

---

## Remaining NOT OBSERVABLE Gaps (Post-Phase 3B)

| Gap | Impact | Recommended fix |
|---|---|---|
| Actual workouts completed | HIGH — can't coach exercise compliance | Create exercise_logs table |
| Restaurant macros consumed | MEDIUM — can see guide use, not nutrition impact | Wire Add to Macros → consumption event (Phase 4) |
| Beverage macros consumed | MEDIUM — see generation, not confirmed drinking | Wire beverage Add to Macros (Phase 4) |
| Starchy vs fibrous carb intake adherence | MEDIUM — prescription exists, intake breakdown doesn't | Add starchy/fibrous columns to macro_logs |
| Shopping list purchase confirmation | LOW — engagement visible, no purchase data | Out of scope for coaching engine |
| Builder session abandonment rate | LOW — saves visible, abandonment is not | Out of scope |
