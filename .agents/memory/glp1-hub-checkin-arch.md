---
name: GLP-1 Hub Daily Check-in Architecture
description: Separate glp1_daily_checkins table design, resolver v2 merge-by-timestamp logic, AdaptationEntry triad, and 5 pending_review escalation rules.
---

## Core decision: separate table (not extending ace_daily_checkins)

Three reasons ace_daily_checkins cannot be extended:
1. UNIQUE(user_id, date) — one row/day upserted. Hub requires multiple timestamped rows/day so the resolver can pick the most recent using merge-by-timestamp.
2. Schema mismatch — ace has lifestyle/behavioral columns (energy, stress, sleep, mood, cravings, soreness). Adding 15 clinical severity enums violates its design contract.
3. free-text symptoms[] vs. pre-classified severity enums — fundamentally different shapes consumed by different resolver paths.

## Resolver v2 merge-by-timestamp rule

resolveDailyMedicationTolerance() reads BOTH tables for today's date:
- glp1_daily_checkins: most recent row ordered by submitted_at DESC
- ace_daily_checkins: single upserted row, updatedAt timestamp

Precedence:
- Hub (structured) wins when: hub.submitted_at >= ace.updatedAt OR ace has no row today
- ACE (keyword matching) wins when: ace.updatedAt > hub.submitted_at
- Hub is preferred on exact timestamp tie (same second)

When hub wins, all severity fields come directly from pre-classified enums — no keyword matching.
When ACE wins, existing keyword-matching path runs unchanged (fully backward-compatible).

## AdaptationEntry triad

Each adaptation builder returns:
```typescript
{
  adaptation: string;      // display: what changes ("Bland flavors, lower-fat...")
  reason: string;          // display: why ("Moderate nausea reported today")
  evidenceRef: string;     // display: source ("BMJ Gut 2023, PMID 36614945")
  promptDirective: string; // injected into AI prompt system context
}
```

adaptationEntries[] is returned as an extended field alongside nutritionAdaptations[] (which contains only promptDirective strings for backward compat with protocol envelope consumers).

## 5 new pending_review escalation rules

All fail-closed — withheld from production until clinical reviewer approves:
- glp1_cant_keep_fluids_escalate — canKeepFluidsDown = 'no'
- glp1_repeated_vomiting_escalate — vomiting = 'multiple' or 'cant_keep_fluids'
- glp1_severe_gi_cant_eat_escalate — any symptom at 'severe' + canEatWithoutWorsening = 'no'
- glp1_worsening_trend_advisory — symptomTrend = 'worsening'
- glp1_severe_nausea_advisory — nauseaLevel = 'severe' (only fires if not already escalating)

**Why:**  All cite FDA prescribing information (semaglutide/tirzepatide PI) or PMID_36614945 for directional guidance, but specific thresholds need clinical reviewer sign-off before production.

## Route design

POST /api/glp1/hub-checkin:
1. Validate with HubCheckinPayloadZ (Zod)
2. INSERT into glp1_daily_checkins (multiple rows per day allowed, no unique constraint)
3. resolveDailyMedicationTolerance() — reads BOTH tables, most recent wins
4. Upsert glp1_daily_tolerance snapshot for audit history
5. Return { ok, checkinId, tolerance }

GET /api/glp1/hub-checkin/today:
- Returns most recent glp1_daily_checkins row + current resolved tolerance
- Idempotent, no side effects

## Frontend component pattern

GLP1DailyCheckin.tsx mounts at top of GLP1Hub.tsx main content (before Quick Launch).
Status card has 4 states: no-checkin / escalation / active-symptoms / all-clear.
Symptom selector expands inline (no modal) — all pill-style buttons, orange/black theme.
AdaptationCard is expandable — shows adaptation/reason/evidenceRef per entry.
