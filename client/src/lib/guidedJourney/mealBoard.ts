import { WeekBoardSchema } from "../../../../shared/schema/weeklyBoard";
import type { JourneySnapshot } from "../../../../shared/guidedJourney";
import { isPersonalJourneyDashboard, journeyMealBuilderAllowed, type JourneyDashboardAccount, type JourneyDashboardContext } from "./dashboardScope";

export interface BoardSaveObservation {
  operation?: object;
  state: "saving" | "saved" | "failed";
  weekStartISO: string;
  namespace?: string;
  proClientId?: string;
  householdProfileId?: string;
}
export type BoardSaveObserver = (event: BoardSaveObservation) => void;
export function notifyBoardSave(observer: BoardSaveObserver | undefined, event: BoardSaveObservation) {
  try { observer?.(event); } catch { console.warn("[Guided Journey] board observer unavailable."); }
}
export function validPlanningWeek(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.getUTCDay() === 1 && date.toISOString().slice(0, 10) === value;
}
/** Opaque local comparison only; never shown, persisted, or sent in progress. */
export function boardPlacementSignature(value: unknown, week: string): string {
  try {
  if (!validPlanningWeek(week)) return "";
  const parsed = WeekBoardSchema.safeParse(value);
  if (!parsed.success) return value == null ? "" : "unverified";
  const start = new Date(`${week}T00:00:00Z`).getTime();
  const entries = parsed.data.days === undefined ? [[week, parsed.data.lists] as const] : Object.entries(parsed.data.days);
  const keys: string[] = [];
  for (const [date, slots] of entries) {
    const time = new Date(`${date}T00:00:00Z`).getTime();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time)
      || new Date(time).toISOString().slice(0, 10) !== date || time < start || time >= start + 7 * 86400000) return "unverified";
    for (const [slot, meals] of Object.entries(slots)) {
      for (const meal of meals) {
        if (meal.id.trim() && (meal.title?.trim() || meal.name?.trim())) {
          const stable = (data: any): any => Array.isArray(data) ? data.map(stable)
            : data && typeof data === "object" ? Object.fromEntries(Object.keys(data).sort().map(key => [key, stable(data[key])])) : data;
          const identity = JSON.stringify(stable([date, slot, meal.id, meal.title, meal.name, meal.servings,
            meal.ingredients, meal.instructions, meal.nutrition]));
          let a = 2166136261, b = 5381;
          for (let i = 0; i < identity.length; i++) {
            a = Math.imul(a ^ identity.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ identity.charCodeAt(i);
          }
          keys.push(`${a >>> 0}:${b >>> 0}`);
        }
      }
    }
  }
  return keys.length ? JSON.stringify(keys.sort()) : "";
  } catch { return "unverified"; } // Optional draft inspection cannot break the native Builder.
}
export function personalGeneralBoardAllowed(
  account: (JourneyDashboardAccount & { performanceModeEnabled?: boolean }) | null,
  context: JourneyDashboardContext & { weekStartISO: string; proClientId?: string },
) {
  return context.path === "/general-nutrition-builder/build" && !context.proClientId
    && validPlanningWeek(context.weekStartISO)
    && isPersonalJourneyDashboard(account, { ...context, path: "/dashboard" })
    && !!account && !account.performanceModeEnabled
    && (account.activeBoard ?? account.selectedMealBuilder) === "general_nutrition"
    && journeyMealBuilderAllowed(account);
}
export interface ConfirmedBoardPlan { weekStartISO: string; signature: string }
export async function confirmPersonalBoard(
  snapshot: JourneySnapshot, week: string, localSignature: string, signal?: AbortSignal,
  readBoard?: typeof import("@/lib/boardApi").getGuidedPersonalWeekBoard,
): Promise<ConfirmedBoardPlan | null> {
  if (snapshot.builderKey !== "general_nutrition" || snapshot.steps[2].evidence.state !== "complete") return null;
  async function read(target: string) {
    const fetchBoard = readBoard ?? (await import("@/lib/boardApi")).getGuidedPersonalWeekBoard;
    const data = await fetchBoard(target, signal);
    if (data.weekStartISO !== target || data.boardNamespace !== "generalNutrition"
      || data.subjectId !== snapshot.scope.actorId || data.subjectId !== snapshot.scope.subjectId) {
      throw new Error("Board scope could not be verified.");
    }
    const signature = boardPlacementSignature(data.week, target);
    if (signature === "unverified") throw new Error("Saved board content could not be verified.");
    return data.source === "db" && signature ? { weekStartISO: target, signature } : null;
  }
  const current = await read(week);
  if (current) return current;
  // Never classify an unconfirmed local placement as a saved historical plan.
  if (localSignature || !snapshot.savedPlan || snapshot.savedPlan.namespace !== "generalNutrition") return null;
  const historical = snapshot.savedPlan.weekStartISO;
  return validPlanningWeek(historical) && historical !== week ? read(historical) : null;
}
