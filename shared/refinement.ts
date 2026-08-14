/**
 * shared/refinement.ts
 *
 * Shared types for the Universal Meal Refinement API (Stage 1: Weekly Meal Board).
 * Used by both server (routes/refinement.ts) and client (hooks/useMealRefinement.ts).
 *
 * The Weekly Meal Board stores meals in JSONB under board.days[dayISO][slot][].
 * SlotContext identifies the specific meal using the week, day, slot, and meal ID;
 * all slot data is validated server-side against the board record in the DB.
 */

// ── Component target types ────────────────────────────────────────────────────

/**
 * The component of the meal being replaced. Only one component changes per refinement.
 * The remaining components (protein, vegetables, sauce, prep) are preserved.
 */
export type MealComponent = "protein" | "starch" | "vegetable" | "sauce" | "side";

export const MEAL_COMPONENT_LABELS: Record<MealComponent, string> = {
  protein:   "Protein",
  starch:    "Starch",
  vegetable: "Vegetable",
  sauce:     "Sauce / Dressing",
  side:      "Side",
};

// ── Slot context ──────────────────────────────────────────────────────────────

/**
 * Identifies the specific meal slot being refined on the Weekly Meal Board.
 * The server loads the board for weekStartISO, then finds the meal in
 * board.days[dayISO][slot] by mealId.  Nothing is trusted from the client
 * beyond these four identifiers.
 */
export interface SlotContext {
  weekStartISO: string;   // "YYYY-MM-DD" — start of the week board
  dayISO:       string;   // "YYYY-MM-DD" — specific day being refined
  slot:         "breakfast" | "lunch" | "dinner" | "snacks";
  mealId:       string;   // meal.id within that day's slot array
}

// ── Preview ───────────────────────────────────────────────────────────────────

export interface RefinementPreviewRequest {
  slotContext:       SlotContext;
  componentTarget:   MealComponent;
  /** Natural-language request, e.g. "something lighter" or "a different starch". */
  userInstruction:   string;
}

export interface MacroDiff {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

export interface RefinementPreviewMeal {
  title:          string;
  macros:         { calories: number; protein: number; carbs: number; fat: number };
  ingredients:    Array<{ name: string; qty: string }>;
  changesSummary: string;
  protocolNote:   string | null;
}

export interface RefinementPreviewResponse {
  previewMeal:  RefinementPreviewMeal;
  macroDiff:    MacroDiff;
  /** Signed 10-minute token. Pass to POST /confirm. */
  confirmToken: string;
}

// ── Confirm ───────────────────────────────────────────────────────────────────

export interface RefinementConfirmRequest {
  confirmToken: string;
}

export interface RefinementConfirmResponse {
  ok:          true;
  newMealId:   string;
  /** Signed 60-minute token. Pass to POST /restore to undo. */
  restoreToken: string;
}

// ── Restore ───────────────────────────────────────────────────────────────────

export interface RefinementRestoreRequest {
  restoreToken: string;
}

export interface RefinementRestoreResponse {
  ok:              true;
  restoredMealId:  string;
}

// ── Token payloads (server-internal) ─────────────────────────────────────────

/**
 * Payload embedded in the confirm token (10-min TTL).
 *
 * Carries the minimum data to locate and replace the original meal.
 * `originalMealId` is verified against the current board state at confirm time
 * so a double-tap or replay returns 409 without modifying the board.
 *
 * `boardVersion` enables a version CAS: the server rejects the confirm if the
 * board was modified between preview and confirm (concurrent edit protection).
 */
export interface ConfirmTokenPayload {
  type:           "refinement_confirm";
  exp:            number;   // unix seconds
  userId:         string;
  weekStartISO:   string;
  dayISO:         string;
  slot:           string;
  originalMealId: string;   // meal.id of the item being replaced
  /** New meal ID assigned at preview time (used for restore replay guard). */
  newMealId:      string;
  /** Board version at preview time — used for version CAS at confirm. */
  boardVersion:   number;
  /** The refined meal object to INSERT into the slot. */
  refinedMeal:    Record<string, unknown>;
}

/**
 * Payload embedded in the restore token (60-min TTL).
 *
 * Carries the minimum data to locate the refined meal and swap it back.
 * `newMealId` is verified against the current board state at restore time.
 */
export interface RestoreTokenPayload {
  type:          "refinement_restore";
  exp:           number;   // unix seconds
  userId:        string;
  weekStartISO:  string;
  dayISO:        string;
  slot:          string;
  newMealId:     string;   // refined meal's ID — verified at restore time
  /** The original meal object to re-insert. */
  originalMeal:  Record<string, unknown>;
}
