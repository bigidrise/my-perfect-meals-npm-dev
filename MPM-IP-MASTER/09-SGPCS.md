# System 09: Starch Game Plan Coaching System (SGPCS)

**Classification:** Behavioral Coaching — Carbohydrate Distribution Intelligence
**Status:** Active, Production

---

## Purpose

The Starch Game Plan is a proprietary carbohydrate distribution coaching system. Rather than simply tracking total daily carbs, SGPCS coaches users on *where* to place starchy carbohydrates across their day — and actively manages this placement during AI meal generation.

The core insight driving the system:

> **The same 150g of daily carbohydrates produces completely different metabolic, energy, and satiety outcomes depending on whether they are distributed as two starch-heavy meals, or as one starch meal and two fiber-based meals.**

SGPCS turns this principle into an active generation strategy.

---

## The Two Strategies

### Strategy 1: "One Starch" (Conservative)
User gets one starch-forward meal per day. All other meals are protein + fiber-based (vegetables, legumes). Designed for:
- Diabetic / pre-diabetic users
- Weight loss phases
- GLP-1 users

### Strategy 2: "Flex Starch" (Moderate)
User gets flexible starch placement. The system tracks starch allocation across the day and advises without strict restriction. Designed for:
- Weight maintenance
- Active users
- Family meal planning

---

## How It Works

### Starch Slot Tracking
Each meal generated is evaluated for starch content. If the meal contains rice, pasta, bread, potatoes, or other high-starch carbohydrates above a threshold, it is flagged as a "Starch Slot Consumed."

### Generation-Time Guidance
When generating a new meal, SGPCS evaluates the day's current starch state:

| Day State | Guidance Injected |
|---|---|
| Starch slot available | Standard generation — starch permitted |
| Starch slot consumed | "🥦 STARCH GUIDANCE: This meal should be FIBER-BASED. No rice, pasta, bread, or starchy carbs." |
| Approaching starch ceiling | "⚠️ STARCH GUIDANCE: Light starch only — keep under 25g net carbs from starch." |

### Daily Starch Indicator
A visual indicator on the daily dashboard shows the user's starch status throughout the day, making the strategy transparent and understandable without requiring nutritional knowledge.

**Key component**: `client/src/components/DailyStarchIndicator.tsx`

---

## Architecture

```
User's Day State (meals generated/logged so far)
    │
    ▼
SGPCS Evaluator
    ├── Count starch slots consumed today
    ├── Evaluate strategy (one_starch vs flex)
    └── Calculate remaining starch availability
         │
         ▼
    Starch Guidance String
    ├── Injected into AI system prompt (generation-time)
    └── Displayed in DailyStarchIndicator (UI)
```

---

## Key Files

| File | Role |
|---|---|
| `server/services/unifiedMealPipeline.ts` (lines 340–421) | Core starch guidance logic |
| `client/src/components/DailyStarchIndicator.tsx` | User-facing starch status |
| `shared/schema.ts` | Strategy field on user profile |

---

## What Makes This Unique

1. **Intra-day carb distribution coaching** — not just daily totals, but where carbs fall across meals
2. **Active generation influence** — SGPCS doesn't just advise after the fact; it changes what the AI generates in real time
3. **Transparent visual feedback** — the Daily Starch Indicator makes a clinical nutrition concept legible to non-clinical users
4. **Integrated with clinical protocols** — for diabetic users, SGPCS operates in "one starch" mode automatically, aligned with clinical carb management guidelines

---

## Integration

- **Integrated into**: Unified Meal Generation Pipeline (System 11)
- **Informed by**: AHCS (System 2) — clinical users receive tighter starch constraints
- **Works with**: UP-FEM (System 1) — starch guidance is a sub-layer within behavioral constraints
- **Displayed in**: Dashboard, meal planning views
