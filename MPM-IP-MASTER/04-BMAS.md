# System 04: Behavioral Memory & Emotion AI System (BMAS)

**Classification:** Adaptive Intelligence — Behavioral Coaching
**Status:** Active, Production

---

## Purpose

The Behavioral Memory & Emotion AI System tracks longitudinal user patterns, recognizes emotional and behavioral signals around eating, and uses this intelligence to inform coaching recommendations, Copilot responses, and adaptive meal suggestions.

The system is designed around a core insight:

> **Nutrition failure is rarely a knowledge problem. It is almost always a behavioral and emotional problem.**

BMAS is the infrastructure that allows MPM to go beyond "here is a healthy meal" to "here is why you're not eating the healthy meals I've been giving you, and here's what we're going to do about it."

---

## Components

### 1. Behavioral Memory Service
Tracks and summarizes user behavioral patterns over rolling time windows (7-day, 30-day, 90-day). Captures:
- Meal adherence rate (meals planned vs. meals logged as eaten)
- Time-of-day patterns (when does the user eat vs. plan?)
- Cuisine cycling patterns (is the user stuck in a rut?)
- Skip patterns (which meal types get skipped repeatedly?)
- Regeneration patterns (what does the user keep changing?)

**Key file**: `server/services/behavioralMemoryService.ts`

### 2. Pattern Alert System
Surfaces behavioral anomalies as structured alerts that can be seen by both the user and (if enrolled in ProCare) their coach. Alert categories:

| Alert Type | Example |
|---|---|
| Adherence drop | "You've skipped dinner 4 of the last 7 days" |
| Meal rut detection | "You've generated chicken and rice 11 times this month" |
| Skip pattern | "Breakfast gets skipped most on Mondays and Tuesdays" |
| Craving surge | "High-carb cravings have increased significantly this week" |
| Positive momentum | "You've hit your protein goal 6 days in a row" |

**Key route**: `server/routes/patternAlerts.ts`

### 3. Emotion AI Layer
The system includes lightweight emotion-aware signals that influence Copilot language and meal suggestions without requiring explicit emotional input from the user.

Signals detected:
- Regeneration frequency (user is dissatisfied, possibly stressed)
- Late-night meal requests (possible emotional eating pattern)
- High-craving request volume (behavioral signal)
- Skipped meals after social dining entries (possible guilt signal)

These signals do not diagnose or pathologize. They inform the tone and content of Copilot coaching language.

**Key component**: `client/src/components/EmotionAIFooter.tsx`, `server/services/mentalHealthService.ts`

### 4. Behavioral Summary DB
Structured user behavioral summaries stored in the database and made available to the ProCare professional portal for coach review.

**Key schema**: `server/db/schema/userBehaviorSummary.ts`

---

## How It Works

```
User Actions (generation, logging, skipping, regenerating)
    │
    ▼
Behavioral Memory Service
    ├── Ingests events with timestamps
    ├── Updates rolling 7/30/90 day summaries
    └── Calculates behavioral signals (rut score, adherence rate, etc.)
         │
         ▼
    Pattern Alert Engine
    ├── Evaluates alert thresholds
    ├── Generates structured alerts
    └── Routes alerts:
         ├── → User-facing (Copilot, dashboard card)
         └── → Coach-facing (ProCare tablet, behavior tab)
              │
              ▼
    Emotion AI Layer
    ├── Reads behavioral signals
    ├── Adjusts Copilot tone (supportive vs. challenging)
    └── Informs meal suggestion diversity engine
```

---

## Inputs

| Input | Source |
|---|---|
| Meal generation events | Generation pipeline |
| Meal log entries | User logging |
| Skip/dismiss events | UI interaction |
| Regeneration events | Generation pipeline |
| Social dining entries | Lifestyle page logs |
| Coach notes | ProCare portal |

## Outputs

| Output | Used By |
|---|---|
| Behavioral summary object | ProCare coach portal |
| Pattern alerts (structured) | Dashboard, Copilot |
| Behavioral signals | Emotion AI, Copilot language |
| Adherence metrics | Dashboard display |
| Rut detection flags | Meal suggestion diversification |

---

## Key Files

| File | Role |
|---|---|
| `server/services/behavioralMemoryService.ts` | Core behavioral tracking |
| `server/routes/patternAlerts.ts` | Alert generation and routing |
| `server/services/mentalHealthService.ts` | Emotion signal processing |
| `server/db/schema/userBehaviorSummary.ts` | Behavioral data schema |
| `client/src/components/EmotionAIFooter.tsx` | UI emotion signal display |
| `client/src/components/copilot/CopilotRespectGuard.ts` | Prevents behavioral override of medical rules |

---

## What Makes This Unique

1. **Longitudinal behavioral modeling** — most nutrition apps are stateless. BMAS maintains a rolling understanding of each user's behavioral patterns across weeks and months.
2. **Emotion-aware coaching language** — the Copilot adjusts its tone based on detected behavioral signals without requiring the user to self-report emotional states
3. **Coach-visible behavioral intelligence** — behavioral summaries are surfaced in the ProCare portal, giving coaches data they would normally have to gather through weekly check-ins
4. **Non-pathologizing signal detection** — the system detects patterns without diagnosing or labeling. It uses signals to improve coaching tone, not to medically classify behavior.

---

## Integration

- **Feeds**: Chef Copilot (System 7) — tone and suggestion content
- **Feeds**: ProCare portal (System 5) — coach behavior view
- **Reads from**: All user-facing generation and logging events
- **Protected by**: Copilot Respect Guard — behavioral signals never override medical constraints
