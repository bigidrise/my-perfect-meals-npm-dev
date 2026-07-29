/**
 * NutritionFacts — canonical nutrition model
 *
 * Every feature that generates or logs nutritional data speaks this language.
 * Features may omit unknown fields (null), but the shape is shared across:
 *   - Restaurant Guide, Fast Food Guide, Find Meals Near Me, My Perfect Buffet
 *   - Recipe Scanner, Create a Dish, Chef's Kitchen, Meal Boards
 *   - Macro logging endpoint
 *
 * Derivation rules (enforced server-side, never by AI):
 *   fibrousCarbs = fiber   (fiber is fibrous carbohydrates — same value, different label)
 *   starchyCarbs + fiber ≤ carbohydrates
 *
 * null = unknown (never received or not applicable)
 * 0    = known zero (e.g. pure protein, no carbs)
 * Never substitute 0 for null to avoid false precision in dashboards.
 */
export interface NutritionFacts {
  calories: number | null;
  protein: number | null;
  /** Total carbohydrates */
  carbohydrates: number | null;
  fat: number | null;
  /** Dietary fiber — also used as fibrousCarbs in the macro log (derived, not AI-supplied) */
  fiber: number | null;
  /** Starchy carbohydrates (rice, potato, bread fraction) */
  starchyCarbs: number | null;
  /**
   * Fibrous carbohydrates — always derived as `fiber` in application code.
   * Do not ask AI to produce this value directly.
   */
  fibrousCarbs: number | null;
  sugar: number | null;
  sodium: number | null;
  alcohol: number | null;
}

/**
 * Minimal nutrition snapshot used in macro logging.
 * Omit unknown fields rather than sending null — the service fills nulls.
 */
export interface MacroLogInput {
  calories: number;
  protein: number;
  /** Total carbohydrates */
  carbohydrates: number;
  fat: number;
  /** Dietary fiber — server derives fibrousCarbs = fiber */
  fiber?: number | null;
  /** Starchy carbohydrates, if known */
  starchyCarbs?: number | null;
  /** Feature identifier, e.g. "restaurant_guide", "buffet", "meal_card" */
  source: string;
  /** Human-readable meal name for display in history */
  title?: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  /** ISO date string (YYYY-MM-DD). Defaults to today server-side if omitted. */
  dateIso?: string;
  mealId?: string;
}

/**
 * Derive fibrousCarbs from fiber.
 * This is the canonical rule: fibrous carbs = fiber.
 * Call this in the server service, never in AI prompts.
 */
export function deriveFibrousCarbs(fiber: number | null | undefined): number | null {
  if (fiber == null) return null;
  return fiber;
}
