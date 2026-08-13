# Universal Meal Refinement — Architecture Design

**Status:** Design only. No implementation.  
**Scope:** How `mealRefinementEngine.ts` evolves into the platform-wide refinement system for My Perfect Meals.  
**Proof target:** Weekly Meal Board (slot-aware). Grocery Coach already uses the engine for `replace_ingredient`.

---

## 1. Problem statement

Every meal-generation surface (17 of 18 at last audit) gives the user a complete result with no way to change part of it. If the user dislikes one ingredient, one component, or the cooking style, the only option is full regeneration — which discards everything they wanted to keep and re-rolls the entire meal.

The engine already exists (`server/services/mealRefinementEngine.ts`) and already handles `replace_ingredient`, `adjust_macros`, and `change_cooking_method`. The fundamental gap is that it is **user-scoped but not slot-scoped**: it receives a `userId` but not the location of the meal in time or on a board. Without that location it cannot:

- look up which `DailyNutritionState` governs the change
- verify the starch replacement fits the slot's remaining starch budget
- enforce GLP-1 targets for *this specific day's* clinical state
- enforce a Performance training-day prescription without knowing the date
- replace exactly the right reservation on confirmation
- update planned/remaining totals exactly once

---

## 2. Preservation invariant (formal)

> **Only change what the user requested. Preserve unaffected ingredients, components, preparation choices, and meal identity unless a medical, dietary, nutrition-budget, or safety constraint requires another change.**

The LLM prompt, the validator, and the UI must all enforce this rule. It is not a style preference — it is a correctness requirement. A refinement that changes unasked-for things is worse than regeneration, because the user loses trust in what "keep" means.

---

## 3. Refinement class taxonomy (v2)

| Class | Replaces | Preserves | Examples |
|---|---|---|---|
| `replace_ingredient` | One named ingredient | Everything else | "No broccoli", "Replace quinoa" |
| `replace_component` | A named role (protein / starch / vegetable / sauce / beverage) | Other components | "Give me another starch", "Different drink", "Keep the steak and change everything else" |
| `adjust_characteristic` | A quality of the dish | All ingredients where possible | "Make this thicker", "Less spicy", "Simpler prep", "This came out watery" |
| `replace_whole_meal` | The entire meal | Only slot/date/constraints | "Give me something completely different" |

Free-form requests such as "Keep the chicken but replace the quinoa" map to `replace_component` (component = starch). The parser (described in §10) determines the class; the user never selects it directly.

`adjust_macros` and `change_cooking_method` (existing) remain. They are conceptually `adjust_characteristic` specializations but are kept as distinct change types because their LLM prompts and validation paths differ.

---

## 4. TypeScript contracts

### 4a. Slot context (new — optional; absent = Grocery Coach mode)

```typescript
/**
 * Identifies where in the board system the meal lives.
 * The server resolves everything else from this.
 * Client must not send macro targets, GLP-1 targets, or prescription values —
 * those are resolved authoritatively from these identifiers.
 */
export interface RefinementSlotContext {
  dateISO: string;                    // "YYYY-MM-DD" — drives DailyNutritionState + Performance day
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | "meal4" | "meal5" | "meal6";
  slot: string;                       // matches mealBoardItems.slot / weekBoard slot key

  // Normalized board system (preferred)
  boardId?: string;                   // meal_boards.id (UUID)
  itemId?: string;                    // meal_board_items.id (UUID) — identifies THIS reservation

  // JSON weekly-board system (fallback if boardId/itemId absent)
  weekStartISO?: string;              // Monday of the week containing dateISO
  mealId?: string;                    // meal.id within boardJSON day slot
}
```

### 4b. Extended request types

```typescript
// ── New: replace_component ───────────────────────────────────────────────────

export interface ReplaceComponentRequest {
  changeType: "replace_component";
  userId: string;
  /** The role to replace: "protein" | "starch" | "vegetable" | "sauce" | "beverage" | "side" */
  componentRole: string;
  /** Current value being replaced — used in the preservation instruction. */
  currentValue?: string;
  /** The complete existing meal snapshot (client-supplied; server validates against DB). */
  existingMeal: ExistingMealSnapshot;
  /** Optional user instruction, e.g. "something grain-free" */
  userRequest?: string;
  /** Where the meal lives — drives authoritative context resolution. */
  slotContext?: RefinementSlotContext;
}

// ── New: adjust_characteristic ───────────────────────────────────────────────

export interface AdjustCharacteristicRequest {
  changeType: "adjust_characteristic";
  userId: string;
  /** Free-text characteristic to change: "thicker", "less spicy", "simpler prep", etc. */
  characteristic: string;
  existingMeal: ExistingMealSnapshot;
  slotContext?: RefinementSlotContext;
}

// ── New: replace_whole_meal ──────────────────────────────────────────────────

export interface ReplaceWholeMealRequest {
  changeType: "replace_whole_meal";
  userId: string;
  existingMeal: ExistingMealSnapshot;
  userRequest?: string;
  slotContext?: RefinementSlotContext;
}

// ── Existing: add slotContext to all existing request types ──────────────────
// ReplaceIngredientRequest, AdjustMacrosRequest, ChangeCookingMethodRequest
// gain an optional `slotContext?: RefinementSlotContext` and
// `existingMeal?: ExistingMealSnapshot` field.

// ── Existing meal snapshot (sent by client) ──────────────────────────────────

export interface ExistingMealSnapshot {
  name: string;
  description?: string;
  ingredients?: Array<{ name: string; quantity?: string; unit?: string }>;
  shoppingList?: Array<{ item: string; quantity?: string; unit?: string; category?: string }>;
  ownedIngredients?: Array<{ item: string; quantity?: string; unit?: string }>;
  macros?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  servings?: number;
  prepTime?: string;
  source?: string;   // "grocery_coach" | "weekly_board" | "create_a_dish" | etc.
}

// ── Updated union ────────────────────────────────────────────────────────────

export type RefinementRequest =
  | ReplaceIngredientRequest      // existing
  | AdjustMacrosRequest           // existing
  | ChangeCookingMethodRequest    // existing
  | ReplaceComponentRequest       // new
  | AdjustCharacteristicRequest   // new
  | ReplaceWholeMealRequest;      // new
```

### 4c. Result types (new)

```typescript
/** Result for replace_component, adjust_characteristic, replace_whole_meal */
export interface FullMealRefinementResult {
  /** The complete refined meal, matching the same schema as the original source. */
  refinedMeal: ExistingMealSnapshot;
  /** What changed (for display and undo). */
  changesSummary: string;
  /** Re-calculated macros for the full meal. */
  macros: { calories: number; protein: number; carbs: number; fat: number };
  /** Clinical note if any constraint was activated during refinement. */
  protocolNote: string | null;
  /** Budget impact relative to the slot's remaining targets. */
  budgetImpact?: {
    caloriesDelta: number;     // refined − original
    proteinDelta: number;
    carbsDelta: number;
    fatDelta: number;
    starchDelta?: number;      // for starch-aware slots
    withinBudget: boolean;
  };
  /** Opaque token the client stores and sends on confirmation. */
  refinementToken: string;
}

export type RefinementResult =
  | SwapRefinementResult           // existing (replace_ingredient)
  | MacroAdjustmentResult          // existing (adjust_macros)
  | CookingMethodResult            // existing (change_cooking_method)
  | FullMealRefinementResult;      // new (replace_component, adjust_characteristic, replace_whole_meal)
```

### 4d. Confirmation and restore contracts

```typescript
// POST /api/refinement/confirm
export interface RefinementConfirmRequest {
  userId: string;
  refinementToken: string;       // token from FullMealRefinementResult
  slotContext?: RefinementSlotContext;
}

export interface RefinementConfirmResult {
  success: true;
  replacedItemId?: string;       // new mealBoardItems.id (normalized system)
  originalSnapshot: ExistingMealSnapshot;  // stored for Restore Original
  restoreToken: string;          // opaque; sent to /api/refinement/restore
}

// POST /api/refinement/restore
export interface RefinementRestoreRequest {
  userId: string;
  restoreToken: string;
}
```

---

## 5. Endpoint contract

### Current (Grocery Coach only)
```
POST /api/meal-refinement
Body: RefinementRequest (userId + changeType + ingredient fields)
Returns: RefinementResult
```

### Proposed additions
```
POST /api/refinement/preview
Body: RefinementRequest (any changeType, optional slotContext)
Returns: FullMealRefinementResult | (existing result types for backward compat)
Auth: requireAuth
Side effects: NONE — no board mutation

POST /api/refinement/confirm
Body: RefinementConfirmRequest
Returns: RefinementConfirmResult
Auth: requireAuth
Side effects: replaces board slot (normalized DELETE+POST or JSON replace), stores original snapshot

POST /api/refinement/restore
Body: RefinementRestoreRequest
Returns: { success: true }
Auth: requireAuth
Side effects: reverses the confirmation, restores original snapshot to slot
```

The existing `POST /api/meal-refinement` remains for Grocery Coach backward compat. It is internally re-routed through the engine's updated `refine()` dispatcher.

---

## 6. Changes required to `mealRefinementEngine.ts`

### 6a. Add slot-aware context resolution

```typescript
/**
 * New loader — used when slotContext is present.
 * Resolves DailyNutritionState, Performance prescription,
 * and GLP-1 overlay for a specific date.
 * Never degrades silently for clinical contexts — throws
 * MealRefinementRetryableError on resolver failure.
 */
async function loadSlotAwareContext(
  userId: string,
  slotContext: RefinementSlotContext,
): Promise<SlotAwareContext>
```

`SlotAwareContext` extends the existing protocol context shape with:
- `dailyNutritionState: DailyNutritionState`
- `performancePrescription: PerformancePrescription | null`
- `remainingStarchMeals: number | null`   // from prescription
- `slotBudget: { calories: number; protein: number; carbs: number; fat: number }`

### 6b. Add new change-type handlers (three new private methods)

```typescript
private async _replaceComponent(req: ReplaceComponentRequest): Promise<FullMealRefinementResult>
private async _adjustCharacteristic(req: AdjustCharacteristicRequest): Promise<FullMealRefinementResult>
private async _replaceWholeMeal(req: ReplaceWholeMealRequest): Promise<FullMealRefinementResult>
```

### 6c. Update `refine()` dispatcher

Add the three new cases. No change to existing case handling.

### 6d. Refinement token

After a successful preview, the engine mints an opaque short-lived token (signed JWT, 10-minute TTL) containing:
- `userId`, `slotContext`, `refinedMeal`, `originalMeal`, `macros`
- Signed with `SESSION_SECRET` so it cannot be tampered

This token travels client→server on confirm. Server verifies signature + expiry before any board mutation.

### 6e. What does NOT change

- `loadProtocolContext` (lenient, for Grocery Coach)
- `loadProtocolContextStrict` (fail-closed, for existing macros/cooking handlers)
- `MealRefinementRetryableError`
- `extractIngredientNames`, `extractAllStrings`, `ALLERGEN_TAXONOMY`
- The GLP-1 fat-ceiling validation block in `_replaceIngredient`
- NDE post-gen scan integration

---

## 7. Authoritative server-resolution sequence

When `slotContext` is present, the server resolves in this order before any LLM call:

```
1. Verify ownership — confirm userId owns the board (boardId) or week (weekStartISO).
   Reject 403 if not.

2. Load DailyNutritionState — resolveDailyNutritionState(userId, dateISO).
   Derives: consumed, planned, remaining, prescription.
   Throws MealRefinementRetryableError if unavailable.

3. Load Performance prescription — getResolvedTargets(userId, dateISO) if active.
   Determines: training day? starchMealsAllowed for this day?

4. Load GLP-1 context — resolveGLP1GlobalContext(userId, dateISO). Fail-closed.
   If active and no resolvedTargets → throw MealRefinementRetryableError.

5. Load protocol envelope — loadUserProtocolEnvelope(userId).
   Allergies, dietary identity, avoidances, conditions.

6. Compute slot budget:
   slotBudget = remainingMacros − (planned macros for OTHER slots this day)
   = DailyNutritionState.remaining − (sum of planned items excluding THIS itemId/mealId)

   This is the maximum the refined meal may consume.

7. Compute starch allowance:
   If Performance is active: starchMealsAllowed for today from prescription.
   If GLP-1 active: apply GLP-1 starch constraints on top.
   If diabetic starch gate active: apply starchBudget.

8. Build system prompt — inject all resolved context as authoritative blocks.
   Client-supplied macro targets are IGNORED if server has authoritative state.

9. LLM call → parse → full-schema validate → NDE scan.
   If scan fails → retry with correction instruction (same pattern as grocery_coach).

10. Compute budgetImpact = refinedMacros − existingMeal.macros.
    Warn (not block) if withinBudget = false; include in FullMealRefinementResult.

11. Mint refinement token (JWT, 10-min TTL). Return preview.
```

The client stores the token and shows the preview. No board mutation has occurred.

---

## 8. Weekly Meal Board reservation lifecycle

### Proof scenario
> **Tuesday / Performance training day / GLP-1 active / Meal 2 (lunch) / chicken + quinoa + vegetables → "Keep everything but replace quinoa"**

**Request**
```typescript
POST /api/refinement/preview
{
  changeType: "replace_component",
  userId: "u-xxx",
  componentRole: "starch",
  currentValue: "quinoa",
  userRequest: "keep everything but replace quinoa",
  existingMeal: { name: "Grilled Chicken Bowl", ingredients: [...], macros: {...} },
  slotContext: {
    dateISO: "2026-08-18",           // Tuesday
    mealType: "lunch",
    slot: "lunch",
    boardId: "b-xxx",
    itemId: "i-xxx"
  }
}
```

**Server resolution (steps 1–11 above)**

1. Confirm userId owns board b-xxx ✓
2. `resolveDailyNutritionState("u-xxx", "2026-08-18")`:
   - prescription: 2400 cal, 180g protein, 240g carbs, 80g fat
   - consumed (breakfast): 620 cal, 45g protein, 68g carbs, 18g fat
   - planned (other items this day): 520 cal (dinner, not yet logged)
   - remaining = 2400 − 620 − 520 = 1260 cal for lunch + snacks
   - slot budget for lunch (item i-xxx excluded from planned): 680 cal, 52g protein, 88g carbs, 22g fat
3. Performance prescription: Tuesday = training day. `starchMealsAllowed = 2`. One starch already consumed at breakfast → 1 remaining. Starch must stay ≤ remaining allowance.
4. GLP-1 active: `maximumToleratedFatGrams = 20g` per meal.
5. Protocol envelope: no allergies, Performance profile.
6. Slot budget established.
7. Starch allowance: 1 starch meal remaining today → replacement starch IS allowed; must stay within slot carb budget (88g).
8. System prompt includes:
   - `AUTHORITATIVE PERFORMANCE PRESCRIPTION: Training day. Starch budget for this meal: ≤ 88g carbs.`
   - `GLP-1 ACTIVE: Fat ceiling 20g this meal.`
   - `PRESERVATION RULE: Replace ONLY the starch component (currently quinoa). Keep chicken, vegetables, all sauces and preparation unchanged.`
9. LLM suggests: sweet potato (52g carbs, 12g fat) → schema valid, NDE scan passes.
10. budgetImpact: Δcal = −40, Δcarbs = −12, Δfat = +2, withinBudget = true.
11. Token minted. Preview returned.

**User sees:**
```
Refined: Grilled Chicken Bowl with Sweet Potato
                  Original  →  Refined
  Calories:         720    →    680
  Protein:           52g   →     52g
  Carbs:            100g   →     88g
  Fat:               14g   →     16g

[Confirm]   [Cancel]
```

**On Confirm** (`POST /api/refinement/confirm`)

Server verifies token (signature + expiry). Then:

```
1. Store original snapshot:
   UPDATE meal_board_items
     SET original_meal_snapshot = <existingMeal JSON>,
         refinement_token = <token>
   WHERE id = 'i-xxx'

2. Replace reservation:
   DELETE /api/boards/b-xxx/items/i-xxx  (releaseLog: false — preserve any consumed log)
   POST   /api/boards/b-xxx/items        { dayIndex, slot, mealId (new UUID), title, macros (refined), ingredients (refined) }

3. Respond with { success: true, replacedItemId: "i-yyy", originalSnapshot: {...}, restoreToken: "..." }
```

**Planned/remaining update** happens automatically — `resolveDailyNutritionState` recomputes next time it is called. No manual total update needed; the normalized board items are the source of truth.

**On Cancel:** No action. Token expires in 10 minutes.

**On Restore Original** (`POST /api/refinement/restore`)

```
1. Verify restoreToken (signed, contains originalSnapshot + slotContext).
2. DELETE new item i-yyy.
3. Re-insert original item data (preserving original macros and ingredients).
4. Respond { success: true }.
```

Planned/remaining revert automatically on next `resolveDailyNutritionState` call.

---

## 9. Shared Refine UI component

One component, `<MealRefinementPanel>`, used across all surfaces. Props-driven; knows nothing about board internals.

```typescript
interface MealRefinementPanelProps {
  existingMeal: ExistingMealSnapshot;
  slotContext?: RefinementSlotContext;   // present on board surfaces; absent on Grocery Coach
  onConfirmed: (result: RefinementConfirmResult) => void;
  onCancelled: () => void;
  // Trigger mode: "button" (floating Refine button) | "inline" (contextual menu on ingredient tap)
  mode?: "button" | "inline";
  initialIngredient?: string;   // pre-fills ingredient when opened from an inline tap
}
```

**States:**
1. **Idle** — "Refine this meal" button visible (or inline ingredient tap)
2. **Input** — user types free-form request; parser classifies to changeType in real-time (shown as a pill: "Replace starch", "Adjust texture", etc.)
3. **Loading** — POST /api/refinement/preview in flight; spinner
4. **Preview** — refined meal + diff table + budget impact shown; [Confirm] [Cancel] visible
5. **Confirming** — POST /api/refinement/confirm in flight
6. **Confirmed** — success state; parent callback fires; "Restore Original" link visible for 30 seconds
7. **Error** — retry button + friendly message; 503 shows "Clinical guidance temporarily unavailable — try again in a moment"

**Free-form request parser (client-side, lightweight):**
Heuristic classification before the API call — for UI label only. Server classification is authoritative.
```
"replace" + component keyword → replace_component
"keep [X] and" → replace_component (derive component from what's NOT kept)
"no [ingredient]" or "without [ingredient]" → replace_ingredient
"thicker" | "thinner" | "crunchier" | "simpler" | "watery" → adjust_characteristic
"something completely different" → replace_whole_meal
```

---

## 10. How Chef/Coach conversational refinement calls the same engine

**Grocery Coach** currently has its own `/api/grocery-coach/swap-ingredient` route that calls `refineMeal()` (the function export). This is already the engine — it just lacks slotContext.

**Chef/Coach chat** surfaces (Create a Dish, Pregnancy Coach, Grocery Coach) accept free-form follow-ups like "actually make it vegetarian" or "less spicy." Currently each surface handles this via a fresh full generation.

**Target behavior:** When a coach surface has an existing result in context and the user sends a modification request, the server:
1. Detects the request is a refinement (not a new generation) — heuristic + LLM classifier
2. Calls `engine.refine()` with `changeType` derived from classification and `existingMeal` from session context
3. Returns `FullMealRefinementResult` rather than a full new result
4. The chat renders the diff, not a complete new meal from scratch

**Contract:** The coach route sends `slotContext` only when it knows the meal is board-slotted (e.g., if Grocery Coach has been enhanced to connect to a board). For standalone coaches, `slotContext` is absent and the engine operates in Grocery Coach mode (lenient context, no slot budget).

---

## 11. Version / restore strategy

**Short-term (confirmation window):** `restoreToken` in the confirmation response allows restore within the token's TTL (suggested: 60 minutes, longer than preview's 10 minutes). After expiry, restore is no longer available from the token.

**Long-term:** Add `original_meal_snapshot` JSONB column to `meal_board_items`. Populated on first refinement; never overwritten (tracks the "what the AI originally generated" state). A separate "Restore to AI original" action can always revert to this snapshot regardless of how many subsequent refinements occurred.

**Multiple sequential refinements:** Each confirm replaces the current item with a new item. The `original_meal_snapshot` on the first item is preserved. Restore reverts to that first snapshot.

---

## 12. Validation and retry behavior

All new change types use the same validation pipeline as existing handlers:

1. **Schema validation** — `invalidReason()` on the LLM response
2. **Preservation check** — verify non-requested components haven't changed (ingredient-name diff; warn if delta exceeds threshold)
3. **NDE scan** (`scanGeneratedOutput`) — same as Grocery Coach; skipAdaptableConflicts: true
4. **Starch gate** — if Performance or diabetic protocol active and starch is involved, verify refined carbs ≤ slot starch budget
5. **GLP-1 fat ceiling** — for all change types when GLP-1 is active (not just replace_ingredient)
6. **Budget impact check** — compute Δ; if refinedMacros > slotBudget × 1.15, surface warning (not block)

**Retry:** One automatic retry with correction instruction appended to system prompt. If retry also fails validation, return the retry result with `protocolNote` flagging the issue rather than blocking (same as existing behavior for adaptable conflicts).

---

## 13. Failure behavior

| Failure | Response |
|---|---|
| Resolver unavailable (GLP-1, DailyNutritionState) | 503 `{ retryable: true }` — `MealRefinementRetryableError` |
| Protocol envelope load failure | 503 (strict mode) or degrade gracefully (lenient mode, Grocery Coach only) |
| Board ownership mismatch | 403 |
| Token expired or invalid signature | 400 `{ error: "Refinement session expired. Please try again." }` |
| LLM parse failure after retry | 500, preserve existing meal |
| Hard protocol violation after retry | 422 with `ndeSummary` |
| Board mutation failure during confirm | 500; original meal still in slot (atomicity: DELETE is only attempted after INSERT succeeds) |
| Restore after board mutation failure | 500 with guidance to contact support; original snapshot still in DB |

---

## 14. Exact files that would change

**New files:**
- `server/services/slotContextResolver.ts` — `loadSlotAwareContext()`, `computeSlotBudget()`, `mintRefinementToken()`, `verifyRefinementToken()`
- `server/routes/refinement.ts` — three new endpoints (`/preview`, `/confirm`, `/restore`)
- `client/src/components/MealRefinementPanel.tsx` — shared UI component
- `client/src/hooks/useMealRefinement.ts` — state machine for preview/confirm/restore lifecycle
- `shared/refinement.ts` — shared TypeScript contracts (all new types from §4)

**Modified files:**
- `server/services/mealRefinementEngine.ts` — add three new handlers, update dispatcher, add token support
- `server/routes/groceryCoach.ts` — `/swap-ingredient` routes to `POST /api/refinement/preview` internally (or keeps own route; engine is the shared layer)
- `server/routes/mealRefinement.ts` — (if it exists separately) mount new routes
- `server/prod.ts` — mount `/api/refinement` router
- `server/index.ts` (dev) — mount `/api/refinement` router
- `server/db/schema/mealBoards.ts` — add `originalMealSnapshot` JSONB column to `mealBoardItems`
- `shared/schema.ts` — migration for `original_meal_snapshot` column

---

## 15. Staged rollout after Weekly Meal Board

**Stage 1 — Weekly Meal Board only, `replace_component` only**
- Implement `replace_component`, slot-aware context resolution, preview/confirm/restore lifecycle
- Board-connected `<MealRefinementPanel>` on the board card (floating button)
- Internal dogfood / QA only

**Stage 2 — Expand change types on the board**
- Add `adjust_characteristic` and `replace_whole_meal` to the board surface
- Refinement panel gets full input mode + parser

**Stage 3 — Grocery Coach**
- Connect existing swap-ingredient UI to the new engine
- Add `slotContext` support for when Grocery Coach results have been added to a board

**Stage 4 — Create a Dish / chef builders**
- `<MealRefinementPanel>` mounted on builder result sheets (no slotContext initially)
- Conversational refinement for already-generated results

**Stage 5 — Coach surfaces (Pregnancy Coach, Parent's Corner, etc.)**
- Conversational refinement detection in chat
- Engine called from coach routes when modification intent detected

---

## 16. Regression test matrix

| Area | Scenario | Expected |
|---|---|---|
| Preservation | Replace starch only | Protein, vegetables, sauce, prep unchanged |
| Preservation | "Keep the steak and change everything else" | Only steak ingredient preserved |
| GLP-1 fail-closed | Resolver throws | 503, original meal unchanged |
| GLP-1 fat ceiling | Starch replacement exceeds fat ceiling | Retry; if retry fails, protocolNote warning |
| Performance starch gate | Replace starch on non-starch-meal training day | Blocked with clear reason |
| DailyNutritionState | Lunch refinement after breakfast logged | Slot budget accounts for breakfast consumed |
| Token expiry | Confirm 11 minutes after preview | 400, no board mutation |
| Token tamper | Modified token payload | 400, no board mutation |
| Confirmation atomicity | Board INSERT succeeds, DELETE fails | Retry DELETE; worst case: two items visible, flagged |
| Restore after confirm | Restore token used | Original slot restored; new item deleted |
| Restore after expiry | Restore from `original_meal_snapshot` | Fallback available at any time |
| Planned totals | Confirm refinement | `resolveDailyNutritionState` returns updated remaining |
| No double-count | Confirm + log (consume) | Nutrition counted exactly once |
| JSON board system | Refinement with weekStartISO/mealId | Same preview/confirm lifecycle; JSON replace path |
| Grocery Coach compat | `replace_ingredient` without slotContext | Existing behavior unchanged |
| NDE hard violation | Both attempts fail | 422, original meal unchanged |
| Budget overage warning | Refined meal 10% over slot budget | Preview shows warning; confirm still allowed |
| Free-form parser | "This came out watery" | Classifies as `adjust_characteristic` |
| Free-form parser | "Keep the chicken but replace the quinoa" | Classifies as `replace_component` (starch) |
| Multiple sequential | Refine twice | Second refinement preserves first refinement; original_meal_snapshot unchanged |
| Restore after multiple | Restore after two refinements | Returns to pre-first-refinement state |
| Coach conversational | "Make it vegetarian" after result shown | Engine called; `replace_whole_meal` or `replace_component` based on context |
| Pediatric context | Child profile present | Pediatric resolver consulted in slot context |
| Pregnancy context | Active pregnancy | Pregnancy guidance blocks injected |

---

## 17. Existing architecture risks

**Risk 1 — Two board systems**  
The platform has two co-existing persistence models: the normalized `meal_board_items` system and the JSON `weekBoards` JSONB system. The refinement confirm path must handle both. The JSON system has no `itemId` for stable reference, so the confirm path uses the less-stable `dateISO + slot + mealId` triple. This creates a race condition if the user navigates or another tab modifies the board between preview and confirm.
*Mitigation:* Confirmation for the JSON system should re-validate that the `mealId` still exists in the slot before writing. Long-term: migrate to normalized system.

**Risk 2 — `resolveDailyNutritionState` excludes the current item from planned**  
The slot budget calculation depends on correctly excluding `itemId` from the planned total. The current implementation matches `board_item_reference` in `macro_logs` (consumed) and excludes matched items from planned. The engine must pass `itemId` to the state resolver so it can exclude the item being refined — otherwise the slot budget will be underestimated by the current item's macros.
*Mitigation:* `loadSlotAwareContext` explicitly excludes the `itemId` when computing slot budget.

**Risk 3 — GLP-1 fail-closed only applies to `replace_ingredient` currently**  
The existing `loadProtocolContextStrict` (used by `adjust_macros` and `change_cooking_method`) throws on GLP-1 resolver failure, but the GLP-1 fat-ceiling validation block only lives in `_replaceIngredient`. New handlers (`_replaceComponent`, `_adjustCharacteristic`) must explicitly apply the fat ceiling, not assume it is enforced elsewhere.
*Mitigation:* Extract fat-ceiling validation into a shared helper `validateGLP1FatCompliance()` called from all handlers.

**Risk 4 — Preservation check relies on LLM compliance**  
The engine instructs the LLM to preserve unaffected components but cannot guarantee it. A hallucinating LLM may silently change the protein when asked to change the starch.
*Mitigation:* Post-generation preservation check (ingredient-name diff) that appends a `protocolNote` if unexpected changes are detected. This surfaces the issue to the user rather than silently allowing it.

**Risk 5 — JWT token using SESSION_SECRET**  
`SESSION_SECRET` is the session signing key. Using it for refinement tokens couples two separate concerns. If SESSION_SECRET is rotated, all in-flight refinement tokens are invalidated.
*Mitigation:* Derive a separate signing key: `REFINEMENT_TOKEN_SECRET = HMAC(SESSION_SECRET, "refinement")` so it rotates with SESSION_SECRET without sharing key material.

---

## Summary

The engine exists and is sound. What it needs is:
1. An optional `slotContext` that triggers authoritative server-side resolution of date, nutrition state, and clinical context
2. Two new change types (`replace_component`, `adjust_characteristic`) with the full validation pipeline
3. A stateless preview → confirm → restore lifecycle using a signed short-lived token
4. A single shared `<MealRefinementPanel>` UI component that works on both board-connected and standalone surfaces
5. A `/api/refinement/confirm` route that atomically replaces the board slot and stores the original for restore

Weekly Meal Board is the right first integration because it has stable `itemId` references, a well-defined slot model, and the most complex governing context (Performance + GLP-1 + DailyNutritionState). Proving it there means every simpler surface (Grocery Coach, builders) inherits the same engine with fewer moving parts.
