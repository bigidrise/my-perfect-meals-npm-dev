import { WeekBoardSchema } from "../../../shared/schema/weeklyBoard";
import type { JourneyEvidence } from "../../../shared/guidedJourney";

export interface TargetRecord {
  dailyCalorieTarget: unknown;
  dailyProteinTarget: unknown;
  dailyCarbsTarget: unknown;
  dailyFatTarget: unknown;
}
export interface SavedBoardRecord {
  weekStartISO: string;
  boardJSON: unknown;
}
export const complete = (reason: string): JourneyEvidence => ({ state: "complete", reason });
export const incomplete = (reason: string): JourneyEvidence => ({ state: "incomplete", reason });
export const unknown = (reason: string): JourneyEvidence => ({ state: "unknown", reason });
export const notApplicable = (reason: string): JourneyEvidence => ({ state: "not_applicable", reason });

export function onboardingEvidence(value: unknown): JourneyEvidence {
  if (value == null) return incomplete("onboarding_not_saved");
  if (!(value instanceof Date) && typeof value !== "string") return unknown("invalid_onboarding_evidence");
  return Number.isFinite(new Date(value).getTime())
    ? complete("onboarding_saved") : unknown("invalid_onboarding_evidence");
}

export function targetEvidence(record: TargetRecord): JourneyEvidence {
  const values = [record.dailyCalorieTarget, record.dailyProteinTarget,
    record.dailyCarbsTarget, record.dailyFatTarget];
  if (values.every(value => value == null)) return incomplete("targets_not_saved");
  // Recognition only, never a nutrition validator or new clinical threshold.
  // Raw nulls remain distinguishable; zero-carb targets are valid evidence.
  if (values.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0)
    || (record.dailyCalorieTarget as number) <= 0) {
    return unknown("targets_require_review");
  }
  return complete("targets_saved");
}

export function savedBoardEvidence(record: SavedBoardRecord): JourneyEvidence {
  const week = new Date(`${record.weekStartISO}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.weekStartISO)
    || !Number.isFinite(week.getTime()) || week.getUTCDay() !== 1
    || week.toISOString().slice(0, 10) !== record.weekStartISO) {
    return unknown("invalid_saved_board");
  }
  const parsed = WeekBoardSchema.safeParse(record.boardJSON);
  if (!parsed.success) return unknown("invalid_saved_board");
  const board = parsed.data;
  // Calendar days own modern boards; lists are only the legacy fallback.
  const dayEntries = board.days === undefined ? null : Object.entries(board.days);
  if (dayEntries?.some(([date]) => {
    const time = new Date(`${date}T00:00:00Z`).getTime();
    return !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time)
      || new Date(time).toISOString().slice(0, 10) !== date
      || time < week.getTime() || time >= week.getTime() + 7 * 86400000;
  })) return unknown("invalid_saved_board");
  const lists = dayEntries ? dayEntries.map(([, slots]) => slots) : [board.lists];
  const meals = lists.flatMap(slots => Object.values(slots).flat());
  if (meals.some(meal => meal.id.trim() &&
    ((meal.title?.trim() ?? "") || (meal.name?.trim() ?? "")))) {
    return complete("meal_plan_saved");
  }
  return meals.length ? unknown("invalid_saved_meal") : incomplete("saved_board_empty");
}
