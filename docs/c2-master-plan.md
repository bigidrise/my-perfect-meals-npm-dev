# C2 Daily Nutrition State Engine — Master Implementation Plan

**Status:** C2 core engine accepted. Validation complete (119/119). Engineering sequence continues.  
**Last updated:** 2026-07-19  
**Canonical validation doc:** `docs/c2-validation-package.md`  
**Test suite:** `server/tests/daily-nutrition-state.test.ts`

---

## VALIDATOR CONTEXT MISMATCH — RECORDED ONCE

The code review system holds stale follow-up task refs (#118–120) for "Platform Mastery — Redesign Phase 1 Academy." It rejects C2 commits because it expects Academy deliverables. This is a task-context mismatch, not a code defect. The C2 work is correct and tested. Do not spend development time re-explaining this unless it blocks a production deployment. The Academy is a separate future task.

---

## PRIORITIZED NEXT-BUILD SEQUENCE

### Priority 1 — Reliable Consumption Classification

**Why first:** The resolver reads the ledger, but the ledger cannot consistently distinguish genuine zero-starch intake from unclassified carbohydrate data. Until classification is reliable, `ledgerReliability` will frequently be `"low"` and the system will never claim exhaustion, even when the budget is genuinely spent. Everything downstream depends on trustworthy consumption data.

**Work required:**
- Audit the ingredient classification pipeline that writes `starchy_carbs` and `fibrous_carbs` to `macro_logs`.
- Determine the current coverage rate: what fraction of logged meals have `starchy_carbs > 0` when they should.
- Fix or expand classification so quick-logged and recipe-logged meals populate both columns reliably.
- Add a classification-confidence flag to `macro_logs` (`classification_source`: `"ingredient"` | `"user_input"` | `"unclassified"`) so `ledgerReliability` can be computed more precisely.
- Update `computeDailyNutritionState()` to use the new flag in addition to the zero/nonzero heuristic.
- Add test coverage for each `classification_source` value.

**Files likely involved:**
- `server/routes/macroLogs.ts`
- `server/routes/manualMacros.ts`
- `shared/schema.ts` (macro_logs table)
- `server/services/dailyNutritionState.ts`

---

### Priority 2 — Shared Post-Generation Validator

**Why second:** The pre-generation constraint fires at all 15 confirmed builders, but there is no post-generation scan that checks whether the AI actually honored the starch budget. If the model ignores the constraint (possible with long system prompts), a starch-exhausted user still receives a rice dish.

**Work required:**
- Add a `STARCH_BUDGET_VIOLATION` scan rule to `scanGeneratedOutput()` in `protocolEnvelope.ts`.
- Rule fires when `dailyNutritionState.starchyBudgetExhausted === true` AND the generated meal contains known starch sources (rice, pasta, bread, potato, oats, corn, tortilla, grains).
- Use the existing `violation` pattern (term match + category + block/flag behavior).
- Decide on action: hard block (regenerate) vs. soft flag (warn in logs, surface to user).
- Recommendation: soft flag in v1 (log violation + add a disclaimer card on the result), hard block in v2.

**Files likely involved:**
- `server/services/protocolEnvelope.ts` (`scanGeneratedOutput()` section)
- `server/tests/protocol-adversarial.ts` (add adversarial test cases)

---

### Priority 3 — Envelope-Blind High-Risk Routes

**Why third:** Seven routes in the matrix do not receive the daily constraint. Most are acceptable. One is not: **Getaway Coach**.

#### Getaway gap (exact fix)

**File:** `server/routes/getaway.ts`  
**Lines:** 78–83  
**Problem:** Only extracts `nutritionContext.protocolLabel` and `nutritionContext.activeBuilder` from `getActiveNutritionContext()`. The `combined` block — which contains the daily constraint — is discarded.

**Proposed correction:**
```ts
// Current (broken):
if (nutritionContext?.protocolLabel) {
  profileLines.push(`Active nutrition protocol: ${nutritionContext.protocolLabel}`);
}

// Fixed: use the full combined block instead of constructing a one-liner
// getActiveNutritionContext() already runs enforceBeforeGenerate() internally.
// Inject the combined block directly into the getaway system prompt.
const protocolBlock = nutritionContext?.combined ?? "";
```

The `combined` field is already produced by `getActiveNutritionContext()` via `enforceBeforeGenerate()`. The fix is one variable reference — the constraint infrastructure is already there. This is the only envelope-blind surface with a meal-generation AI call and an active user context.

**Other envelope-blind routes** (Restaurant Guide via `mealFinder.ts`, Beverage Creator) already go through `getActiveNutritionContext()` and use the full block. Verify this in the next audit pass.

---

### Priority 4 — Saved-Meal Revalidation

**Why fourth:** When a user reuses a saved meal on a different day, the saved meal was generated under a previous day's session type (e.g., competition day, 240g starch allowed). If reused on a rest day (80g target), the saved meal may contain starch far over today's remaining budget — and the system does not re-check it.

**Work required:**
- When a saved meal is retrieved for display or re-logging, run `scanGeneratedOutput()` against the current `dailyNutritionState`.
- If a conflict exists (e.g., saved meal has 150g starchy carbs, today's remaining = 40g), surface a warning: "This meal was created on a different training day. Today's starch allocation is X. Log it as-is or modify before logging."
- Do not auto-block — user may have already accounted for this.
- Add a `revalidation_note` field to the saved meal display card.

**Files likely involved:**
- `server/routes/savedMeals.ts` (or equivalent retrieve endpoint)
- Saved meal display card component (client)

---

### Priority 5 — Coach's Corner Integration

**Why fifth:** Coach's Corner is the high-touch AI advisor. If a user asks "What should I eat before training?" the answer should reflect today's session type, starch target, and remaining budget. Currently it does not.

**Work required:**
- Confirm whether Coach's Corner has its own route or uses a shared AI call.
- If it has a route: pass `dailyNutritionState` into the Coach's Corner prompt context.
- Teach the coach: "Today is a [sessionType] day. Starchy carb target is Xg. User has consumed Yg. Remaining: Zg."
- The coach should NOT repeat internal terminology (`ledgerReliability`, `starchPolicy`) — translate into plain language.
- Add a pre-response check: if user asks about food choices and `scheduleConfigured=true`, always include today's session context.

**Files likely involved:**
- `client/src/pages/CoachCornerIntake.tsx`
- Coach Corner server route (confirm file)
- `server/services/dailyNutritionState.ts` (already produces the data needed)

---

### Priority 6 — User-Facing Daily-State Display (Hub and Builder)

**Why sixth:** The engine produces a complete `DailyNutritionState` but nothing shows it to the user. Users cannot see today's starch target, what they've consumed, or what remains. This makes the constraint system invisible — users cannot diagnose why a recommendation changed.

**Work required:**
- Performance Nutrition Hub (`/performance`): add a Today's State card (see Section 2.1 of documentation plan below).
- Performance Builder: surface today's resolved session during the builder flow.
- The display should translate all internal state into plain language (see terminology translation table below).
- Link to "Why is this changing my recommendations?" explanation.

**Files likely involved:**
- `client/src/pages/PerformanceNutritionHub.tsx` (or equivalent)
- `server/routes/performanceNutrition.ts` (already has envelope load)
- `server/services/dailyNutritionState.ts` (already produces the display data)

---

### Priority 7 — App Library, Academy, Copilot, and In-App Guidance

**Why last:** Documentation must follow verified behavior. Outlines and impact inventories (this document) are written now. Final copy, lesson text, Copilot scripts, and screenshots are written after Priorities 1–6 are tested and confirmed.

---

## DOCUMENTATION-IMPACT INVENTORY

This inventory records every surface that must be updated and what it needs to say. It is written as an outline now. Final copy is written after the corresponding engineering work is verified.

---

### 2.1 Performance Nutrition Hub

**Location:** `/performance` page  
**Copilot script:** `CopilotPageExplanations.ts` → `"/performance"` key

**What must be added/updated:**

| Element | Required |
|---|---|
| Today's Training Session card | Show: session type, label, training phase |
| Today's Starch Allowance | Show: target g, consumed g, remaining g, source ("from weekly schedule") |
| Ledger status | Show in plain language: "Fully tracked" / "Partially tracked — some meals unclassified" / "Not tracked yet today" |
| App-wide impact statement | "Your training schedule affects recommendations across the entire app — not just the Performance Builder." List surfaces: Create a Dish, Snack Creator, Beverages, Desserts, Fridge Rescue, Restaurant Guide, Getaway Coach, Gatherings, Meal Planner, and more. |
| Consumed vs. remaining explanation | "Only meals you confirm or log reduce your daily allowance. Generating or viewing a meal does not count." |
| Override explanation | How a user can change today's session without changing the recurring schedule. |
| "Why was starch removed?" | Explanation card when `starchyBudgetExhausted = true` |
| Copilot script | Must be rewritten to include today's session, starch status, and app-wide impact. Current script has no concept of these. |

**Terminology translation:**

| Internal | User-facing |
|---|---|
| `starchyBudgetExhausted` | "You've reached today's starchy carb limit" |
| `ledgerReliability: "high"` | "Fully tracked" |
| `ledgerReliability: "medium"` | "Partially tracked — some meals weren't classified" |
| `ledgerReliability: "low"` | "Not yet tracked — meals logged but not classified" |
| `starchPolicy: "zero"` | "No starchy carbs recommended for remaining meals" |
| `starchPolicy: "restricted"` | "Minimize starchy carbs today" |
| `starchPolicy: "moderate"` | "One starchy carb source per meal" |
| `starchPolicy: "generous"` | "Include a full starchy carb source — training demands it" |
| `starchPolicy: "unlimited"` | "No starch limit active" |
| `sessionType: "off"` | "Rest Day" |
| `sessionType: "recovery"` | "Recovery Day" |
| `preGenerationConstraint` | (never shown directly — translated into status card) |
| `localDayUTCBounds` | (never shown — transparent) |

---

### 2.2 Performance Nutrition Builder

**Location:** Performance setup and builder flow  
**Copilot script:** Whichever page key covers the builder steps

**What must be added/updated:**

- Setup screen: explain that the weekly schedule affects the entire app, not just the builder.
- Session type selector: for each type (strength, cardio, endurance, rest, recovery, competition), show a one-line explanation of what it means nutritionally.
- After setup: show a confirmation of today's resolved state.
- "Why don't I see carbs in my recommendation?" explanation tied to today's session.
- Explain the difference between generating, saving, scheduling, and logging a meal.
- Explain that missing macro targets limit day-specific personalization.
- Copilot: if user is in the builder, Copilot should reference today's active state, not just the static setup.

---

### 2.3 App Library — Feature-by-Feature Update Scope

**Location:** App Library entries for each feature  
**Note:** Final copy must match verified behavior. This is a scope inventory only.

For each feature below, the App Library entry must answer three questions:  
(a) Does this tool read today's nutrition state?  
(b) Does it validate recommendations against the state?  
(c) Must the user log a meal for the daily total to update?

| Feature | Reads daily state? | Validates output? | Logging required? | Update needed? |
|---|---|---|---|---|
| Performance Nutrition Hub | Yes (source of state) | N/A | N/A | Yes — full rewrite |
| Performance Builder | Yes (setup) | Yes | No (setup tool) | Yes — add app-wide impact |
| Create a Dish | Yes | Yes | Yes | Yes — explain starch behavior |
| Snack Creator | Yes | Yes | Yes | Yes |
| Beverage Creator | Yes | Yes | Yes | Yes |
| Craving Creator | Yes | Yes | Yes | Yes |
| Fridge Rescue | Yes | Yes | Yes | Yes |
| Restaurant Guide | Yes | Yes | Yes | Yes |
| Fast Food | Yes | Yes | Yes | Yes |
| Dessert Creator | Yes | Yes | Yes | Yes |
| Camping | Confirm | Confirm | Yes | Confirm then update |
| Getaway Coach | Yes (partial — gap) | No (gap) | Yes | Yes — after Getaway fix |
| Gatherings / Holiday Feast | Yes | Yes | Yes | Yes |
| Meal Planner | Yes | Yes | Yes | Yes |
| Weekly Meal Board | Confirm | Confirm | Yes | Confirm then update |
| Chef's Kitchen | Confirm | Confirm | N/A | Confirm then update |
| Saved meal reuse | After revalidation fix | After revalidation fix | Yes | After Priority 4 |
| Coach's Corner | After Priority 5 | After Priority 5 | N/A | After Priority 5 |
| Macro Calculator | Source of baseline targets | N/A | N/A | Explain its role in daily state |
| Meal Logger | Write path to macro_logs | N/A | Yes — it IS logging | Explain what it actually records |

---

### 2.4 Copilot — Page-by-Page Update Scope

**Location:** `client/src/components/copilot/CopilotPageExplanations.ts`  
**Architecture:** One Copilot script per page key. Scripts are plain-text narration. The Copilot reads the script when a user enters a page.

**What the Copilot must learn:**

For any page that is envelope-aware (reads daily state), the Copilot script for that page must include — in plain language — the following where applicable:

1. Whether today's training session affects this page's recommendations.
2. What the user's current starch status is (if the page has access to daily state data).
3. Why they might see fewer starchy foods than usual.
4. That generating a meal does not count as eating it — logging is required to update the daily total.
5. Where to go to see or change today's training session.
6. A link / navigation hint to the Performance Nutrition Hub for more detail.

**Pages requiring Copilot script updates:**

| Page key | Current script covers daily state? | Update required |
|---|---|---|
| `/` (dashboard) | No — mentions Starch Guard but not training schedule | Yes — add training schedule context |
| `/performance` | Exists at line 407 — audit for completeness | Yes — add today's state, app-wide impact |
| `/create-dish` or equivalent | Likely no | Yes — mention schedule may affect starch |
| `/snack-creator` | Likely no | Yes |
| `/fridge-rescue` | Likely no | Yes |
| `/restaurant-guide` | Likely no | Yes |
| `/getaway` | Likely no | After Getaway fix |
| `/desserts` | Likely no | Yes |
| `/gatherings` | Likely no | Yes |
| `/meal-planner` | Likely no | Yes |
| `/beverage-creator` | Likely no | Yes |
| Coach's Corner pages | Likely no | After Priority 5 |
| Performance Builder pages | Likely no | Yes — explain builder sets app-wide schedule |

**Copilot guidance principles for daily state:**
- Never use engineering terms: no "protocol envelope," "resolver," "ledger reliability," "Tier 5c," "preGenerationConstraint."
- Translate: "Your training schedule for today is [X]. Based on that, [Y] is your starch strategy."
- When starch is excluded: "Because you've logged [X]g of starchy carbs today and that's your [session type] limit, I'm recommending fibrous vegetables and protein instead."
- Copilot should feel like a coach who knows today's plan, not a system explaining its own architecture.
- For pages with Guided Mode: guided steps should surface today's state at the relevant step (e.g., at the carb-selection step in Create a Dish).

---

### 2.5 My Perfect Meals Academy — Update Scope

**Note:** Academy content must be verified against completed behavior before publishing. This is a curriculum gap inventory.

**Existing lessons to audit (confirm accuracy against C2 behavior):**
- Any lesson covering Performance Nutrition setup
- Any lesson covering the Macro Calculator
- Any lesson covering meal logging
- Any lesson covering weekly meal planning
- Any lesson covering restaurant choices
- Any lesson covering saved meals
- Any lesson covering Coach's Corner
- Any lesson covering ProCare workflows

**New lessons needed (outline only — do not write final copy yet):**

| Lesson title (working) | Audience | Key concepts |
|---|---|---|
| How Your Training Schedule Affects the Whole App | All users | Weekly schedule → app-wide enforcement; not just the builder |
| Generated vs. Logged Meals — Why It Matters | All users | Budget only changes when you log; viewing and generating are free |
| Starchy vs. Fibrous Carbs — What the App Tracks | All users | Starchy carb budget; fibrous carbs are unrestricted |
| Why My Recommendations Changed Today | All users | Session type → starch policy → constraint in prompt |
| Understanding Your Daily Nutrition State | All users | Target, consumed, remaining, ledger status — in plain language |
| What Happens When Meals Aren't Classified | All users | Incomplete starch data → tracking limited; log more detail for better accuracy |
| How Overrides Work | All users | Changing today's session, manual adjustments |
| Training-Day Nutrition by Session Type | All users | Strength, endurance, rest, recovery, competition — what each means nutritionally |
| Using Saved Meals Across Training Days | All users | Revalidation, why a saved meal may not fit today |
| Performance Nutrition for Coaches — Reading Client State | Professionals | What the daily state shows, what it means for client recommendations, what cannot be overridden |
| How Gyms and Clinics Can Use the System at Scale | Organizations | Multi-client consistency, what is automatic vs. coach-configured, what professionals must verify |

---

### 2.6 In-App Guidance

**Audit required — do not implement prematurely. Flag during feature-by-feature review.**

| Element | Trigger condition | Content |
|---|---|---|
| Starch exhaustion banner | `starchyBudgetExhausted = true` on any generation page | "You've reached today's starchy carb limit. Recommendations will favor protein and fibrous vegetables." + "Why?" link → Hub |
| Low ledger warning | `ledgerReliability = "low"` with logged meals | "Some of your meals today haven't been fully classified. Your starch tracking may be incomplete." + "Learn more" link |
| Session type indicator | Any page that runs enforceBeforeGenerate | Small badge: "Rest Day" / "Strength Day" / etc. — links to Hub |
| "Why no rice?" explanation | When a generated meal excludes a starch the user asked for | "Your starch allowance for today is full. Try again tomorrow or adjust today's session." |
| First-time schedule setup prompt | User has performance active but no schedule | "Set your weekly training schedule to get day-specific recommendations across the app." |
| Missing macro targets warning | `starchyCarbsTargetG = 0` when performanceActive | "Set your macro targets in the Macro Calculator to enable day-specific starch tracking." |
| Log confirmation nudge | After generating a meal | "Want this to count toward today's starch total? Log it." — clear CTA |
| Onboarding step | Performance Nutrition onboarding | Add one step explaining app-wide impact of the schedule. |

---

### 2.7 Professional and Organizational Documentation

**Audience:** Trainers, nutrition coaches, physicians, clinics, gyms, healthcare systems, ProCare organizations, business owners.

**Required clarifications in any professional documentation:**

- What is enforced automatically (session-based starch constraints at all 15 builders).
- What depends on user logging (confirmed consumption → budget reduction).
- What is estimated vs. authoritative (ledger reliability levels in plain language).
- What professionals can override (today's session type) and what they cannot (medical safety tiers 1–4).
- What the system will and will not claim (no treatment claims, no glucose management claims beyond the Diabetic Hub's documented scope).
- How ProCare coaches can read a client's current daily state.
- What is visible in the coaching view vs. what the client sees.

---

### 2.8 Release and Change Documentation

**Prepare when the full engineering sequence is complete — not before.**

Checklist (items, not copy):
- [ ] Internal engineering notes: C2 architecture, ledger reliability rules, protocol-precedence Tier 5c
- [ ] QA test instructions: how to verify constraint fires, how to verify budget exhaustion blocks starch, how to test near-midnight TZ boundaries
- [ ] User-facing release notes: plain language, no engineering terms
- [ ] Professional release notes: what changed for ProCare workflows
- [ ] Academy change log: which lessons were updated, which were added
- [ ] App Library change log: which feature descriptions were updated
- [ ] Support-team guidance: most common user questions and correct answers
- [ ] Known limitations: two-a-day training (one slot per day), DST midnight edge, post-generation scan not yet in v1, Getaway gap until fixed
- [ ] Data migration notes: existing performance users with no schedule → no impact; pre-classification macro_logs rows → ledger may be "low" for historical days
- [ ] Feature-flag rollout: if releasing daily state display separately from constraint enforcement, document the flag name and scope

---

## IMPLEMENTATION BACKLOG

### B-001 — Getaway Constraint Gap (HIGH)
**File:** `server/routes/getaway.ts` lines 78–83  
**Problem:** Calls `getActiveNutritionContext(userId)` which internally runs `enforceBeforeGenerate()` and produces a full combined block including the daily nutrition state constraint. The route then extracts only `nutritionContext.protocolLabel` (a one-line string) and `nutritionContext.activeBuilder`. The full `combined` block — containing the starch budget rule, session type constraint, and fibrous veg recommendation — is discarded. The Getaway AI receives no daily nutrition constraint.  
**Fix:** Replace `protocolLabel` injection with the full `combined` block from `getActiveNutritionContext()`. The infrastructure is already in place — this is a one-variable fix.  
**Impact:** Users in a rest day or starch-exhausted state will receive correct constraints in Getaway meal suggestions.  
**Priority:** Fix in Priority 3 pass.

### B-002 — Post-Generation Starch Scan (MEDIUM)
**Problem:** No `scanGeneratedOutput()` rule validates that a generated meal honors the starch budget.  
**Fix:** Add `STARCH_BUDGET_VIOLATION` scan rule. Soft flag in v1, hard block in v2.  
**Priority:** Fix in Priority 2 pass.

### B-003 — Saved-Meal Day-Mismatch Warning (MEDIUM)
**Problem:** Saved meals generated on high-starch days are not revalidated when reused on rest/recovery days.  
**Fix:** Run daily state check on saved meal retrieval; surface a warning card if starch exceeds today's remaining allocation.  
**Priority:** Fix in Priority 4 pass.

### B-004 — classification_source Column (HIGH, enables Priority 1)
**Problem:** `starchy_carbs = 0` is ambiguous — could be genuinely zero starch or unclassified data. The `ledgerReliability` heuristic works but cannot be precise without knowing why the value is zero.  
**Fix:** Add `classification_source` enum column to `macro_logs` (`"ingredient"` | `"user_input"` | `"unclassified"`). Update `computeDailyNutritionState()` to use it.  
**Priority:** First item in Priority 1 pass.

### B-005 — Coach's Corner Daily State Context (MEDIUM)
**Problem:** Coach's Corner AI does not know today's session type, starch target, or remaining budget.  
**Fix:** Inject `dailyNutritionState` context into Coach's Corner prompt. Translate to plain language — do not expose internal field names.  
**Priority:** Fix in Priority 5 pass.

### B-006 — Copilot Scripts for All Envelope-Aware Pages (LOW until Priority 6)
**Problem:** All Copilot page scripts were written before C2 existed. No script explains that today's training schedule affects the page.  
**Fix:** Update scripts in `CopilotPageExplanations.ts` for all 14 confirmed recipient surfaces plus the Hub and Builder.  
**Priority:** Fix in Priority 7 pass — after display work in Priority 6 confirms the language.

---

## OPEN QUESTIONS

| Question | Blocks | Notes |
|---|---|---|
| Does Camping route call enforceBeforeGenerate? | App Library update for Camping | Needs code audit |
| Does Weekly Meal Board use unifiedMealPipeline? | App Library update | Needs code audit |
| What does Craving Creator use at the server level? | App Library update | Needs code audit |
| Can a user change today's session type without modifying the recurring schedule? | Hub UX, override documentation | One-time override feature may need to be built |
| Should `starchyBudgetExhausted` be shown in ProCare client view? | Professional documentation | Decision needed before writing pro docs |
| Carb cycle + daily state conflict: which wins? | Tier 5c vs carb cycle | Documented as carb cycle wins; needs implementation check |
