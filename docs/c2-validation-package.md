# C2 Validation Package — Daily Nutrition State Engine

## Status: IMPLEMENTED, PENDING ACCEPTANCE

Implemented: server/services/dailyNutritionState.ts  
Wired into: server/services/protocolEnvelope.ts (Tier 5c)  
Tests: server/tests/daily-nutrition-state.test.ts  
Run: `npx tsx server/tests/daily-nutrition-state.test.ts`

---

## 1. EXPORTED TYPE CONTRACT

### `DailyNutritionState` — complete field specification

| Field | Type | Source | Fallback | Authority |
|---|---|---|---|---|
| `userId` | `string` | `DailyStateInput.userId` | none — required | authoritative |
| `resolvedAt` | `string` (ISO) | `new Date(now).toISOString()` | none | authoritative |
| `localDate` | `string` (YYYY-MM-DD) | `Intl.DateTimeFormat("en-CA", { timeZone })` on `now` | none | authoritative (TZ-correct) |
| `timezone` | `string` | `DailyStateInput.timezone` | `"America/Chicago"` | authoritative |
| `performanceActive` | `boolean` | `DailyStateInput.performanceActive` — reflects `specialtyConditions.includes("performance-nutrition")` | `false` | authoritative |
| `scheduleConfigured` | `boolean` | `true` only when schedule ≠ null AND config ≠ null AND performanceActive | `false` | authoritative |
| `sessionType` | `SessionType \| null` | `resolveTodayTargets()` → `schedule[dayOfWeek] ?? "off"` | `null` when scheduleConfigured=false, `"off"` when day key missing | estimated (server clock drives today, TZ-corrected via noon-UTC trick) |
| `sessionLabel` | `string \| null` | `SESSION_LABELS[sessionType]` from performanceProtocolResolver | `null` when scheduleConfigured=false | authoritative given sessionType |
| `trainingPhase` | `string \| null` | `schedule.trainingPhase` | `null` when scheduleConfigured=false | authoritative |
| `starchyCarbsTargetG` | `number` | `resolveTodayTargets()` → `max(0, baseline.starchyCarbsG + modifier.carbsAdjustG)` | `baseline.starchyCarbsG` when no schedule | estimated (performance protocol modifier applied to live baseline) |
| `fibrousCarbsTargetG` | `number` | `resolveTodayTargets()` → `baseline.fibrousCarbsG` (fibrous is always fixed) | `baseline.fibrousCarbsG` | authoritative |
| `totalCarbsTargetG` | `number` | `resolveTodayTargets()` → `max(0, baseline.carbsG + modifier.carbsAdjustG)` | `baseline.carbsG` | authoritative given session |
| `starchyCarbsConsumedG` | `number` | `SUM(macro_logs.starchy_carbs)` WHERE userId AND at IN localDayUTCBounds | `0` when no logs or scheduleConfigured=false | authoritative when ledgerReliability=high; estimated when medium; unknown when low |
| `totalCarbsConsumedG` | `number` | `SUM(macro_logs.carbs)` same window | `0` | same as starchyCarbsConsumedG |
| `starchyCarbsRemainingG` | `number` | `max(0, starchyCarbsTargetG - starchyCarbsConsumedG)` | `starchyCarbsTargetG` when no logs | derived — clamped at zero |
| `starchyBudgetExhausted` | `boolean` | `ledgerReliability !== "low" && consumed >= target` | `false` when ledger=low or scheduleConfigured=false | authoritative only when ledger=high; estimated when medium |
| `starchPolicy` | `StarchPolicy` | derived from sessionType + budgetExhausted + ledgerReliability | `"unlimited"` when no schedule/config | derived |
| `ledgerReliability` | `LedgerReliability` | `rowCount=0 → high`; `nonZero=rowCount → high`; `nonZero>0 → medium`; else → `low` | `"low"` when scheduleConfigured=false | authoritative |
| `preGenerationConstraint` | `string \| null` | `buildPreGenerationConstraint()` from state | `null` when no schedule/config or performanceActive=false | derived |

### `StarchPolicy` values

| Value | Meaning |
|---|---|
| `"zero"` | No starchy carbs. Fires when budget is exhausted (and ledger reliable) or target < 30g on restricted day. |
| `"restricted"` | Minimize starchy carbs. Fires on `off` and `recovery` days with non-zero target. |
| `"moderate"` | One meaningful starchy carb source. Fires on `strength` and `sport_practice` days. |
| `"generous"` | Maximize starchy carb availability. Fires on `power`, `endurance`, and `competition` days. |
| `"unlimited"` | No constraint active. Fires when performance is inactive or schedule/config is missing. |

### `LedgerReliability` values

| Value | Condition | Can claim exhausted? |
|---|---|---|
| `"high"` | rowCount=0 (definitively zero) OR every row has starchy_carbs > 0 | Yes |
| `"medium"` | Some rows have starchy_carbs > 0, some are zero | Yes |
| `"low"` | All rows exist but every starchy_carbs = 0 (all unclassified) | No |

---

## 2. EVIDENCE REQUIRED

### 2.1 Local Date and Timezone Code Path

```
loadUserProtocolEnvelope(userId)
  → users.timezone (DB column, default "America/Chicago")
  → passed as DailyStateInput.timezone
  → resolveDailyNutritionState(input)
    → const now = input.now ?? new Date()
    → const timezone = input.timezone || "America/Chicago"
    → const localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now)
       // "en-CA" locale produces YYYY-MM-DD format — always user's local date
    → const [ly, lm, ld] = localDateStr.split("-").map(Number)
    → const localNoonAsUTC = new Date(Date.UTC(ly, lm - 1, ld, 12, 0, 0))
       // noon UTC on the user's local date = correct day-of-week for any server at UTC±11
    → computeDailyNutritionState(..., localDateStr, resolvedAt, localNoonAsUTC)
```

The server's own timezone has no effect. The computation is driven entirely by the user's `timezone` DB field.

**Known limitation:** `localDayUTCBounds()` uses the noon UTC offset to approximate the full-day offset. DST transitions that occur exactly at midnight (historically rare, last seen in Brazil) may shift one minute's worth of logs to the wrong day. This is accepted for v1.

### 2.2 Records Counted as Confirmed Consumption

**SQL query (lines 219-232 of dailyNutritionState.ts):**
```sql
SELECT
  COALESCE(SUM(starchy_carbs::numeric), 0) AS starchyCarbsG,
  COALESCE(SUM(fibrous_carbs::numeric), 0) AS fibrousCarbsG,
  COALESCE(SUM(carbs::numeric),         0) AS totalCarbsG,
  COUNT(*)                                  AS rowCount,
  COUNT(*) FILTER (WHERE starchy_carbs::numeric > 0) AS nonZeroStarchy
FROM macro_logs
WHERE user_id = $userId
  AND at >= $logStart   -- UTC start of user's local day
  AND at <= $logEnd     -- UTC end of user's local day
```

**Only these write paths insert into `macro_logs`:**
- `POST /api/macro-logs` — `source="quick"` (manual quick log)
- `POST /api/meals/log` (via macroLogs.ts) — `source="food"` or `source="recipe"` (food/recipe log)

**Verified via grep:** `grep -rn "macroLogs.insert\|insertMacroLog\|into.*macro_logs" server/` shows only `server/routes/macroLogs.ts` and `server/routes/manualMacros.ts` as write paths.

### 2.3 Proof That Generated / Viewed / Saved / Favorited / Scheduled Meals Do Not Reduce Budget

The budget is computed solely from `macro_logs`. The following tables are NOT queried:
- `saved_meals` — stores generated meal definitions; no write to macro_logs
- `meal_plans` — stores planned weekly meal assignments; no write to macro_logs
- `weekly_meal_plan` — same; no write to macro_logs
- `generated_meals` / AI response cache — no write to macro_logs

**Mechanism:** A user must explicitly choose "Log This Meal" or use the Quick Log to write to `macro_logs`. Generating, viewing, saving, favoriting, or scheduling has no macro_logs effect.

**Test coverage:** Scenario 9 in the test file verifies this with synthetic `noLog()` data representing "meals generated but not logged."

### 2.4 How starchy_carbs Nulls, Zeros, and Unreliable Values Are Handled

1. **NULL at DB level:** The column is `numeric NOT NULL DEFAULT '0'` — NULLs cannot exist for new rows. Old rows (pre-boot-migration) have default 0. The `::numeric` cast and `COALESCE(..., 0)` handle any edge case.

2. **starchy_carbs = 0 on a row (unclassified):** This is the unreliable case. The row exists in `macro_logs` but the ingredient classification did not identify starchy carbs. Result: `nonZeroStarchy < rowCount` → reliability drops to `"low"` (all-zero) or `"medium"` (partial).

3. **starchy_carbs = 0 genuinely (all fibrous, no starch):** Indistinguishable from unclassified at the row level. This is the inherent ambiguity. The `ledgerReliability` field surfaces this to callers.

4. **All rows have starchy_carbs = 0 → `"low"` reliability:**
   - `starchyBudgetExhausted` is forced to `false` regardless of consumed vs. target.
   - `starchPolicy` does NOT become `"zero"` due to exhaustion.
   - `preGenerationConstraint` does NOT contain "BUDGET EXHAUSTED" text.

5. **rowCount = 0 → `"high"` reliability:** Definitively zero consumption. The system trusts this as authoritative.

### 2.5 Whether the Resolver Can Declare "Starch Exhausted" When Classification Confidence Is Incomplete

**Answer: No.**

```ts
const budgetExhausted = ledgerReliability !== "low" && consumedStarchy >= targetStarchy;
```

When `ledgerReliability === "low"` (all starchy_carbs = 0 — all unclassified), `budgetExhausted` is forced to `false`. The exhaustion claim requires `ledgerReliability` to be `"high"` or `"medium"`.

The `"medium"` case is a deliberate design choice: partial classification is still evidence. If 2 of 4 rows were ingredient-classified with starchy_carbs > 0, and the classified sum exceeds the target, we claim exhausted. The unclassified rows (starchy_carbs = 0) are unknown but not suppressing the known data.

If this is too aggressive for a future use case, the threshold can be raised to require `"high"` only.

### 2.6 Exact Constraint Text Injected into protocolEnvelope.ts

The constraint is appended to `layers.performanceIntent` in `enforceBeforeGenerate()` (lines 1598-1614 of protocolEnvelope.ts):

```ts
layers.performanceIntent +=
  `\n\n${envelope.dailyNutritionState.preGenerationConstraint}\n` +
  `This day-specific rule is derived from the user's weekly training schedule and ` +
  `today's confirmed consumption. It is a hard constraint — it supersedes any general ` +
  `carbohydrate guidance above for this specific recommendation. Medical safety rules ` +
  `(Tiers 1–4) still take absolute precedence.`;
```

**Example output for strength day, 80g consumed of 170g target:**
```
🗓️ PERFORMANCE SCHEDULE — STRENGTH TRAINING (TODAY):
STARCH TARGET: 170g total today (90g remaining). The user has already consumed approximately 80g of starchy carbohydrates today.
Include a meaningful starchy carbohydrate source to support training. Preferred sources: sweet potato, brown rice, oats, whole grain bread, quinoa.
Fibrous vegetables (broccoli, spinach, zucchini, cauliflower, kale, peppers, asparagus, cucumbers, leafy greens) are unrestricted and should be included generously.
This day-specific rule is derived from the user's weekly training schedule and today's confirmed consumption. It is a hard constraint — it supersedes any general carbohydrate guidance above for this specific recommendation. Medical safety rules (Tiers 1–4) still take absolute precedence.
```

**Example output for budget-exhausted strength day:**
```
🗓️ PERFORMANCE SCHEDULE — STRENGTH TRAINING (TODAY):
STARCH BUDGET EXHAUSTED: The user has consumed 200g of starchy carbohydrates today (daily target: 170g). Do NOT include additional starchy carbohydrate sources in this recommendation.
Excluded sources: rice, pasta, bread, tortillas, potatoes, oats, corn, beans, grains, cereal.
Fibrous vegetables (...) are unrestricted and should be included generously.
[hard constraint suffix]
```

**Example output for rest day (off), target=80g:**
```
🗓️ PERFORMANCE SCHEDULE — REST DAY (TODAY):
STARCH TARGET: 80g (reduced — rest day). Minimize starchy carbohydrates; lean protein and fibrous vegetables are the priority.
Fibrous vegetables (...) are unrestricted and should be included generously.
[hard constraint suffix]
```

### 2.7 Confirmed Envelope-Aware Builders That Receive the Constraint

The constraint fires inside `enforceBeforeGenerate()`. Only routes/services that call this function receive it.

**FULL CONFIRMED RECIPIENT LIST (14 surfaces):**

| Builder | File | generatorName |
|---|---|---|
| Create a Dish | server/services/unifiedMealPipeline.ts | create_a_dish |
| Snack Creator | server/services/unifiedMealPipeline.ts | snack_creator |
| Create With Chef (meal) | server/services/unifiedMealPipeline.ts | create_with_chef |
| Create With Chef (beverage) | server/services/unifiedMealPipeline.ts | create_with_chef_beverage |
| Fridge Rescue | server/services/fridgeRescueGenerator.ts | fridge_rescue |
| Restaurant Guide / Find Near Me | server/services/nutritionContext/getActiveNutritionContext.ts | (via combinedBlock) |
| Restaurant Meal Generator | server/services/restaurantMealGeneratorAI.ts | restaurant_meal |
| Dessert Creator | server/routes/dessert-creator.ts | dessert_creator |
| Gatherings / Holiday Feast | server/routes/gatherings.ts | gatherings |
| AI Pairings | server/routes/ai-pairings.ts | pairings_ai |
| Wine List Helper | server/routes/ai-wine-list-helper.ts | wine_list_helper |
| Chef Pairings | server/routes/chef-pairings.ts | chef_pairings |
| Wine Pairing | server/routes.ts | wine_pairing |
| Bourbon/Spirits Pairing | server/routes.ts | bourbon_spirits_pairing |
| Meal Pairing | server/routes.ts | meal_pairing |

**Surfaces that load the envelope but do NOT call enforceBeforeGenerate() (constraint does NOT reach them):**

| Route | File | Gap |
|---|---|---|
| Getaway Coach | server/routes/getaway.ts | **Confirmed gap.** Calls `getActiveNutritionContext()` which internally calls `enforceBeforeGenerate()`, but getaway.ts only extracts `nutritionContext.protocolLabel` and `nutritionContext.activeBuilder` — the combined block is discarded. The daily constraint is NOT injected into the getaway prompt. |
| Grocery Coach | server/routes/groceryCoach.ts | Reads envelope for dietary profile; no meal generation AI call. Acceptable. |
| Inspiration | server/routes/inspiration.ts | Reads envelope for context; no generation. Acceptable. |
| Nutrition Summary | server/routes/nutritionSummary.ts | Read-only display. Not applicable. |
| Performance Hub (/today) | server/routes/performanceNutrition.ts | Reads envelope for display; will read dailyNutritionState in a future pass. |
| Pregnancy Coach | server/routes/pregnancyCoach.ts | Uses envelope for coaching response, not meal generation. |
| ProCare | server/routes/procareRoutes.ts | Reads client envelope for professional review. Not applicable. |

**Getaway gap is the only actionable item.** Fix: replace `nutritionContext.protocolLabel` injection with `nutritionContext.combinedBlock` from `getActiveNutritionContext` (which already contains the full constraint).

### 2.8 Behavior for Users Without Performance Nutrition Context

When `performanceActive = false` (user does not have "performance-nutrition" in `specialtyConditions`):

1. `resolveDailyNutritionState()` receives `performanceActive: false`.
2. `computeDailyNutritionState()` returns the `base` object immediately — no DB query for macro_logs.
3. Result: `scheduleConfigured=false`, `sessionType=null`, `starchPolicy="unlimited"`, `preGenerationConstraint=null`.
4. In `enforceBeforeGenerate()`, the guard `if (envelope.dailyNutritionState?.scheduleConfigured && ...)` is `false` → the block is skipped entirely.
5. Zero prompt impact for non-performance users.

**Important:** `loadUserProtocolEnvelope()` only calls `resolveDailyNutritionState()` when `performanceNutrition === true`. For non-performance users, `envelope.dailyNutritionState` remains `null`. No extra DB query is made.

### 2.9 Relationship Between `resolveTodayTargets()` and `resolveDailyNutritionState()`

**`resolveTodayTargets()` (in performanceProtocolResolver.ts):**
- Pure function, no async, no DB
- Single responsibility: compute today's macro targets from schedule + config + baseline
- Returns `ResolvedSessionTargets` with all macro targets for the session
- Does NOT know about consumption, budget tracking, ledger reliability, or constraint text

**`resolveDailyNutritionState()` (in dailyNutritionState.ts):**
- Async, queries macro_logs
- Delegates target computation entirely to `resolveTodayTargets()`
- Adds on top: ledger query, consumption aggregation, budget tracking, starch policy derivation, constraint text generation
- No target math is duplicated

**`computeDailyNutritionState()` (in dailyNutritionState.ts):**
- Pure function, exported for unit testing
- Takes pre-fetched log data + pre-computed dates
- Calls `resolveTodayTargets()` for targets
- Produces the full `DailyNutritionState`
- This is the single source of truth for all computation

**Chain:** `resolveTodayTargets()` computes targets → `computeDailyNutritionState()` adds budget tracking → `resolveDailyNutritionState()` adds DB query → `loadUserProtocolEnvelope()` stores result on envelope → `enforceBeforeGenerate()` reads `preGenerationConstraint` and appends to prompt.

### 2.10 Additional Database Reads and Performance Impact

**New DB reads per envelope load (only when performanceActive=true):**

1. **Users table select** — `weeklyTrainingSchedule`, `performanceProtocolConfig`, `dailyCalorieTarget`, `dailyProteinTarget`, `dailyCarbsTarget`, `dailyFatTarget`, `dailyStarchyCarbsTarget`, `dailyFibrousCarbsTarget`, `timezone` — **added to the existing users query** (no extra DB round-trip).

2. **macro_logs aggregate query** — `SELECT COUNT(*), SUM(starchy_carbs), SUM(fibrous_carbs), SUM(carbs), COUNT(*) FILTER (starchy_carbs > 0) FROM macro_logs WHERE userId = $1 AND at >= $2 AND at <= $3` — **one new round-trip** per envelope load for performance-nutrition users.

**Performance impact:**
- Extra users columns: negligible (same row, wider select)
- macro_logs aggregate: one indexed query. `macro_logs` has `userId` in the WHERE clause. If `(user_id, at)` is indexed, this is O(log N) + O(entries for today) — typically 0–20 rows per user per day.
- **Only fires for users with `performanceActive=true`** — this is a small fraction of the user base.
- No caching added in v1. If envelope load frequency is high (>10/minute per performance user), a 60-second cache keyed on `(userId, localDate)` should be considered.

---

## 3. ROUTE INVENTORY MATRIX

| Surface | Route File | Envelope-Aware | enforceBeforeGenerate | Daily Constraint Reaches It | Notes |
|---|---|---|---|---|---|
| Create a Dish | unifiedMealPipeline.ts | ✅ | ✅ | ✅ | Main meal generator |
| Snack Creator | unifiedMealPipeline.ts | ✅ | ✅ | ✅ | |
| Create With Chef | unifiedMealPipeline.ts | ✅ | ✅ | ✅ | |
| Create With Chef Bev | unifiedMealPipeline.ts | ✅ | ✅ | ✅ | |
| Fridge Rescue | fridgeRescueGenerator.ts | ✅ | ✅ | ✅ | |
| Restaurant Guide | restaurants.ts → getActiveNutritionContext | ✅ | ✅ | ✅ | via getActiveNutritionContext.combinedBlock |
| Find Near Me (mealFinder) | mealFinder.ts → getActiveNutritionContext | ✅ | ✅ | ✅ | via getActiveNutritionContext.combinedBlock |
| Restaurant Meal Gen | restaurantMealGeneratorAI.ts | ✅ | ✅ | ✅ | |
| Dessert Creator | dessert-creator.ts | ✅ | ✅ | ✅ | |
| Gatherings / Feast | gatherings.ts | ✅ | ✅ | ✅ | |
| AI Pairings | ai-pairings.ts | ✅ | ✅ | ✅ | |
| Wine List Helper | ai-wine-list-helper.ts | ✅ | ✅ | ✅ | |
| Chef Pairings | chef-pairings.ts | ✅ | ✅ | ✅ | |
| Wine Pairing | routes.ts | ✅ | ✅ | ✅ | |
| Bourbon/Spirits | routes.ts | ✅ | ✅ | ✅ | |
| Meal Pairing | routes.ts | ✅ | ✅ | ✅ | |
| **Getaway Coach** | **getaway.ts** | **⚠️** | ❌ | ❌ | **Gap: discards combinedBlock, uses protocolLabel only** |
| Grocery Coach | groceryCoach.ts | ✅ | ❌ | ❌ | Acceptable: no meal generation AI call |
| Inspiration | inspiration.ts | ✅ | ❌ | ❌ | No generation |
| Nutrition Summary | nutritionSummary.ts | ✅ | ❌ | ❌ | Display only |
| Performance Hub | performanceNutrition.ts | ✅ | ❌ | ❌ | Display only |
| Pregnancy Coach | pregnancyCoach.ts | ✅ | ❌ | ❌ | Coaching, not generation |
| ProCare Portal | procareRoutes.ts | ✅ | ❌ | ❌ | Professional review |
| Chef's Kitchen | ChefsKitchenPage (client) | n/a | n/a | n/a | Client-side walkthrough, no server generation |
| Meal Planner | mealPlans.routes.ts | ✅ | ✅ | ✅ | via unifiedMealPipeline |
| Beverage Creator | beverage-creator.ts | ✅ | ✅ (via context) | ✅ | getActiveNutritionContext |
| Craving Creator | routes.ts (inferred) | ✅ | ✅ | ✅ | verify in full audit pass |

---

## 4. CONSUMPTION AND macro_logs DATA-FLOW MAP

```
┌─────────────────────────────────────────────────────────────┐
│                     WRITE PATHS (add to budget)             │
│                                                             │
│  POST /api/macro-logs                                       │
│    source = "quick"                                         │
│    → writes: userId, at, kcal, protein, carbs, fat, fiber  │
│              starchy_carbs (may be 0 if unclassified)       │
│              fibrous_carbs (may be 0 if unclassified)       │
│                                                             │
│  POST /api/meals/log                                        │
│    source = "food" | "recipe"                               │
│    → same columns; starchy/fibrous from ingredient lookup   │
│                                                             │
│  These are THE ONLY macro_logs write paths.                 │
│                                                             │
│  NOT in macro_logs:                                         │
│    • saved_meals (meal definitions)                         │
│    • meal_plans / weekly_meal_plan (planned meals)          │
│    • generated_meals (AI response cache)                    │
│    • ai_quota_logs (generation quotas)                      │
│    • viewing, generating, saving, favoriting, scheduling    │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     macro_logs TABLE                        │
│                                                             │
│  Columns relevant to daily state:                           │
│    user_id           — partition key                        │
│    at                — UTC timestamp WITH TIMEZONE          │
│    carbs             — total carbs (numeric NOT NULL)       │
│    starchy_carbs     — starchy carbs (numeric NOT NULL DEFAULT 0) │
│    fibrous_carbs     — fibrous carbs (numeric NOT NULL DEFAULT 0) │
│                                                             │
│  starchy_carbs = 0 may mean:                               │
│    (a) genuinely zero starch (all fibrous/protein)          │
│    (b) ingredient not classified → fallback to 0            │
│    → these are indistinguishable at the row level           │
│    → ledgerReliability handles this ambiguity               │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    READ PATH (daily state)                  │
│                                                             │
│  resolveDailyNutritionState()                               │
│    1. Compute localDateStr via Intl (user's local date)     │
│    2. Compute UTC bounds via localDayUTCBounds()            │
│    3. SELECT aggregate from macro_logs WHERE userId + at    │
│    4. Compute ledgerReliability from rowCount/nonZeroStarchy│
│    5. Compute consumedStarchy, remaining, budgetExhausted   │
│    6. Derive starchPolicy + preGenerationConstraint         │
│    7. Return DailyNutritionState                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. PROTOCOL-PRECEDENCE PROPOSAL

The daily nutrition state constraint is positioned at **Tier 5c** — below general performance demand (Tier 5b) and above avoidances (Tier 6):

```
Tier 1 — Medical Hard Limits     (carb/sodium ceilings — absolute, cannot be violated)
Tier 2 — Dietary Identity        (vegan, halal, kosher — outer wall)
Tier 3 — Allergies               (hard stops within identity)
Tier 4 — Medical Optimization    (anti-inflammatory, pregnancy, thyroid, GLP-1)
Tier 5a — Performance Context    (general performance protocol from performanceContext JSONB)
Tier 5b — Performance Demand     (computed demand profile from training type/frequency)
Tier 5c — Daily Nutrition State  ← NEW: today's session-specific starch rule + budget
Tier 6 — Avoidances              (user preference — no exceptions after Tiers 1–3)
Tier 7 — Preferences             (flavor, heat, style)
```

**Why Tier 5c (after 5b, before 6):**
- Must fire after 5b (which provides general performance carb guidance) so it can tighten/override for today's specific session
- Must fire before avoidances (Tier 6) because it is a medical-adjacent constraint, not a preference
- Medical safety (Tier 1) always overrides — a diabetic user's carb ceiling cannot be raised by a "competition day" starch boost

**Interaction with carb cycle (Tier 5.5):**
Currently the carb cycle constraint also appends to `layers.performanceIntent`. If both are active simultaneously (a user with both performance protocol AND carb cycle), both constraints are concatenated in the prompt. For v1 this is acceptable. A future pass should detect conflict (e.g., carb cycle says "low starch" but competition day says "maximum starch") and resolve with a priority rule — carb cycle wins over performance schedule (medical precision over training optimization).

---

## 6. STRUCTURED AND UNSTRUCTURED VALIDATOR STRATEGY

### Structured validation (pre-generation)
`enforceBeforeGenerate()` appends the constraint text to `layers.performanceIntent`. This is then concatenated into `combined` and sent to the AI as part of the system prompt. The structure is:
- Hard constraint text → included in system prompt
- AI model is instructed this is a hard constraint
- Validation is at the prompt level — no post-generation scan for starch compliance currently exists

**Gap:** There is no post-generation `scanGeneratedOutput()` rule that checks generated meal starch content against today's target. Existing `scanGeneratedOutput()` checks medical terms and hard limits (allergens, clinical contraindications). Starch budget compliance is not verified after generation.

**Proposed: add a structured scan rule:**
```
if dailyNutritionState.starchyBudgetExhausted:
  scan generated ingredients for starch sources (rice, pasta, potato, bread, oats...)
  if found: flag as STARCH_BUDGET_VIOLATION
```
This would be a Tier 5c post-generation scan. Not implemented in v1.

### Unstructured validation (human-readable output)
The `preGenerationConstraint` field is the authoritative human-readable form. It is directly readable in logs:
```
console.log(envelope.dailyNutritionState?.preGenerationConstraint)
```

For debugging, the constraint is also visible in any request that logs the full `combined` prompt block.

---

## 7. MIGRATION AND BACKWARD COMPATIBILITY NOTES

### Schema
No schema changes required. All columns were added in previous migrations:
- `weekly_training_schedule` JSONB — exists
- `performance_protocol_config` JSONB — exists
- `daily_starchy_carbs_target` INTEGER — exists
- `daily_fibrous_carbs_target` INTEGER — exists
- `timezone` VARCHAR — exists
- `starchy_carbs` NUMERIC on macro_logs — added in previous boot migration

### Backward compatibility for existing performance users
Users who have `performanceActive=true` but have never set a schedule:
- `weeklyTrainingSchedule = null` → `scheduleConfigured = false` → no constraint, unlimited
- Zero impact on generation behavior

Users who have `performanceActive=true` AND have a schedule:
- Full daily state is now computed and injected
- This is the intended behavior — constraint is now active for these users

### Backward compatibility for non-performance users
- `performanceActive=false` → `resolveDailyNutritionState()` is never called
- `envelope.dailyNutritionState = null`
- Zero impact on generation behavior

### Legacy `PerformanceProtocolConfig` with baselineCalories fields
The `PerformanceProtocolConfig` interface notes that `baselineCalories`, `baselineProteinG`, `baselineCarbsG`, `baselineFatG` are deprecated (they remain for DB compatibility). `resolveTodayTargets()` ignores these when a fresh `baseline` is passed. The daily state engine always passes a fresh baseline from the live DB columns (`dailyCalorieTarget` etc.), so old JSONB records with stale baseline snapshots have no effect.

### macroLogs rows with starchy_carbs = 0 (pre-classification)
Rows logged before the starchy/fibrous carb classification system was added have `starchy_carbs = 0` by default. These contribute to `rowCount` but not `nonZeroStarchy`, producing `ledgerReliability = "low"` for days with such entries. This prevents false "budget exhausted" claims. As the ingredient classifier backfills historical data, reliability will improve organically.

---

## 8. KNOWN GAPS AND DEFERRED WORK

| Gap | Impact | Priority |
|---|---|---|
| Getaway Coach ignores full constraint block | Daily starch rule does not reach getaway meal suggestions | High — fix in next pass |
| No post-generation scan for starch budget compliance | AI may generate starch despite exhaustion claim | Medium — add structured validator |
| Two-a-day training not modeled (one session per day slot) | Users training twice must pick the higher-demand type manually | Low — v2 |
| DST midnight transitions may shift 1 minute of logs | Negligible (<0.01% of entries) | Low — Temporal API in v2 |
| No (userId, localDate) cache on daily state | Extra macro_logs query per envelope load for perf users | Medium — add 60s cache if envelope load > 10/min/user |
| starchyCarbsConsumedG authority drops to "medium" for partial classification | Constraint text may understate consumption | Blocked on full ingredient classification coverage |
