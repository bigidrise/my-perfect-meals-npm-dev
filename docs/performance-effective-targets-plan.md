# Performance Nutrition — Effective Daily Targets (Today's Coaching Plan)
## Approved Architecture Plan

> **Do not start Phase 4 or 5 until Phases 1–3 are verified with screenshots and raw API output.**

---

## The Permanent Project Rule

> **The Performance workspace is a self-contained nutrition ecosystem. It may consume the Macro Calculator baseline, but it must never modify it. It computes Today's Coaching Plan from that baseline and exposes it to Performance-aware consumers only. Outside the Performance workspace, all of My Perfect Meals continues to operate from the Macro Calculator (or ProCare/medical overrides where applicable).**

---

## The Core Model

```
Macro Calculator = permanent baseline (never modified)
Performance Schedule = the athlete's weekly coaching brain
Today's Coaching Plan = baseline + selected date's training adjustment
                        (internally: EffectiveDailyTargets)
```

---

## Rule 1 — EffectiveDailyTargets Is Immutable

The server computes Today's Coaching Plan once for a given `userId + date`. Every consumer reads the exact same object. No consumer performs additional macro math.

```
Server resolves once
        ↓
EffectiveDailyTargets object
        ↓
Hub → Builder → Biometrics → Restaurant → Cravings →
Beverages → Desserts → Sushi → Shopping
```

If a consumer needs to display "remaining," it subtracts macro logs from `effective.starchyCarbsG` — it does not recompute targets. The targets themselves are fixed for that date.

---

## Rule 2 — Selected Date Is Global Performance State

A single `PerformanceWorkspaceProvider` holds the selected date and the resolved `EffectiveDailyTargets` for that date. Every Performance-aware screen reads from this context. No screen asks "what day are we on?" independently.

```
PerformanceWorkspaceProvider
  selectedDate (state)
  todaysCoachingPlan (EffectiveDailyTargets for selectedDate)
        ↓
  Hub | Builder | Restaurant | Cravings | Beverages | Biometrics | History
```

When the user taps Thursday in the Hub, all other screens already know it's Thursday. No prop drilling. No per-screen date fetches.

---

## Rule 3 — One Coaching Explanation, Used Everywhere

The `description` field in EffectiveDailyTargets is generated once by the server. Every consumer displays it verbatim. No screen writes its own explanation.

Example for a Power Day:

> **Today's Training: Power Day**
> Today's nutrition has been adjusted for explosive strength work. Carbohydrates have been increased. Protein has been maintained. Fibrous carbohydrates remain unchanged. Hydration target has increased.

That exact string renders in the Hub, the Builder, the Restaurant Guide, the Shake creator, the Cravings screen, and Biometrics. One source. Zero drift.

---

## Contract Shape

```
GET /api/performance/effective-targets?date=YYYY-MM-DD

{
  date, sessionType, sessionLabel, trainingPhase,

  description: "Today's nutrition has been adjusted for...",

  baseline:    { calories, proteinG, starchyCarbsG, fibrousCarbsG, fatG },
  effective:   { calories, proteinG, starchyCarbsG, fibrousCarbsG, fatG },
  adjustments: { caloriesDelta, starchyDelta, fibrousDelta, ... },

  provenance:  { source: "performance"|"procare"|"medical"|"baseline", appliedLayers: [] }
}
```

Starchy and fibrous carbs are **always** returned and displayed separately. No "combined carbs" in any Performance-aware consumer.

---

## Precedence (server-enforced)

```
Medical hard limits
        ↓
ProCare / Physician override → Performance becomes informational only
        ↓
Performance schedule + day modifier
        ↓
Macro Calculator baseline
        ↓
App defaults
```

---

## Performance Hub Layout

```
Today's Training
━━━━━━━━━━━━━━━━
Power Day
Today's nutrition has been adjusted for explosive strength work.
Carbohydrates have been increased. Protein maintained.

Today's Targets
━━━━━━━━━━━━━━━
Calories  |  Protein  |  Starchy  |  Fibrous  |  Fat
  2,250       180g       170g        80g        70g

Remaining Today  (compact — not the builder footer)
━━━━━━━━━━━━━━━━
Calories  |  Protein  |  Starchy  |  Fibrous  |  Fat
   890        92g         80g        40g        35g
```

---

## Navigation Pattern

A shared `PerformanceWorkspaceLayout` with persistent pill tabs:

```
[ Hub ]  [ Builder ]  [ Check-In ]  [ History ]
```

Selected date and active tab live in query state. Switching Hub → Builder preserves the date. No landing-page bounce.

---

## Consumer Map

| Surface | Reads EffectiveDailyTargets? |
|---|---|
| Performance Hub | ✅ |
| Performance Builder | ✅ |
| Biometrics (Performance active) | ✅ |
| Restaurant Guide (Performance-launched) | ✅ |
| Cravings / Shakes / Beverages (Performance-launched) | ✅ |
| Desserts / Sushi / Shopping (Performance-launched) | ✅ |
| Weekly / GLP-1 / Anti-Inflammatory / Diabetic / General | ❌ Baseline only |

All Performance-launched generators must pass the workspace `selectedDate` to `effective-targets?date=` before generating. If Thursday is a recovery day, cravings, drinks, restaurant suggestions, and meals all honor Thursday's recovery targets — not generic baseline targets.

---

## Migration Phases

| Phase | Work | Risk |
|---|---|---|
| 1 | Server contract + endpoint + `description` field | Low — additive only |
| 2 | `PerformanceWorkspaceProvider` (global date state) | Low — new context, no removals |
| 3 | Hub migration: Today's Targets + Remaining Today + explanation | Low |
| ⛔ VERIFY PHASES 1–3 WITH SCREENSHOTS + RAW API OUTPUT BEFORE CONTINUING | | |
| 4 | Builder + Biometrics wiring | Medium — Biometrics date sync |
| 5 | Performance-launched generators pass workspace date | Medium — generator entry points |
| 6 | Cleanup: remove `getResolvedTargets()` from ambiguous surfaces | Low |

---

## Smoke Test Matrix

| # | Scenario | Pass Condition |
|---|---|---|
| 1 | Monday = Power Day | Hub, Builder, Restaurant, Shake, Biometrics all show identical targets |
| 2 | Tap Thursday = Recovery Day | Every screen updates without refresh |
| 3 | Generate breakfast | Remaining decreases in Hub, Builder, and Biometrics simultaneously |
| 4 | Delete breakfast | Everything immediately restores |
| 5 | Open Restaurant from Performance on Thursday | Recommendations honor Thursday recovery macros |
| 6 | Leave Performance → open Weekly Meal Builder | Immediately returns to Macro Calculator baseline. Zero Performance contamination |
| 7 | Assign ProCare coach | Coach override wins everywhere. Performance targets become informational only |

---

## Known Risks

- **BeachBodyMealBoard dual-role** — currently routes as Performance Builder but also used outside Performance. Must decide before Phase 4: pure Performance surface or dual-purpose.
- **Biometrics date sync** — Biometrics has its own date state. Must be wired to the workspace `selectedDate`, not assumed to mean "today."
- **AthleteMealPickerDrawer** — still calls `getResolvedTargets()` directly. Clean up in Phase 6.

---

## Future Extensibility

This same pattern (baseline + daily adjustment layer + one coaching explanation) applies directly to:
- Pregnancy nutrition (trimester-aware daily adjustments)
- Oncology support (treatment-day vs. off-day adjustments)
- Cardiac rehab (activity-level daily adjustments)

The Performance workspace proves the pattern. Other specialized protocols follow the same shape without changing how the general app behaves.

---

## Design Principles (Permanent)

### This Is a Protocol Engine

Performance is the first protocol. It is not a one-off sports feature.

Every specialty condition in My Perfect Meals asks the same question:

> **"Given this user, on this date, what should today's nutrition look like?"**

The adjustment supplier is the only thing that changes:

| Protocol | Adjustment Driver |
|---|---|
| Performance | Today's workout type |
| Pregnancy | Current trimester |
| GLP-1 | Current medication phase |
| Diabetes | Today's glucose context |
| Cardiac | Sodium restriction level |
| Oncology | Treatment day vs. off day |
| Renal | Current restriction tier |
| Menopause | Current hormonal phase |

The engine — baseline → adjustment layer → effective daily targets → protocol-aware consumers — is identical across all of them. Performance proves the pattern; every future protocol slots in without changing how the general app behaves.

---

### The Calendar Is the Operating System

The selected date is not a UI convenience. It is the trigger that sets the entire nutritional context.

When a user taps **Thursday**, every protocol-aware surface responds simultaneously:

- Builder targets update
- Hub targets update
- Biometrics comparison updates
- Restaurant recommendations update
- Beverage, cravings, and meal generation receive Thursday's targets

The date is the operating system for the protocol. Nothing computes independently of it.

---

### Protocol Isolation Rule

> **A protocol may influence only protocol-aware consumers. It must never modify the global nutritional baseline.**

```
Macro Calculator
        ↓
[Protocol] e.g. Performance
        ↓
Today's Coaching Plan
        ↓
Protocol-aware consumers ONLY
```

Everything outside the protocol workspace continues using the Macro Calculator unless it explicitly opts in to the protocol workspace.

---

## Future Enhancement (Not Now — Write It Down While Fresh)

Rich coaching explanation for a selected day:

```
Friday — Power Day

Heavy lower-body session

Training Goals
• Max force production
• Full glycogen availability
• High recovery priority

Nutrition Strategy
• Higher starchy carbohydrates
• Protein maintained
• Normal fibrous vegetables
• Increased hydration
```

This transforms the app from "here are your macros" into "here is your coach explaining today's plan." The AI value is visible: users understand *why* today's numbers are different, not just *what* they are.
