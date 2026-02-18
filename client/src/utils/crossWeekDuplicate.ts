import { getWeekStartFromDate } from "@/utils/midnight";
import { setDayLists, cloneDayLists, type WeekBoard, type WeekLists } from "@/lib/boardApi";
import { apiJSON } from "@/lib/api";

const TZ = "America/Chicago";

export interface CrossWeekDuplicateResult {
  currentWeekBoard: WeekBoard | null;
  currentWeekDayCount: number;
  otherWeeksSaved: number;
  totalDays: number;
  errors: string[];
}

export async function duplicateAcrossWeeks({
  sourceLists,
  targetDates,
  currentBoard,
  currentWeekStartISO,
}: {
  sourceLists: WeekLists;
  targetDates: string[];
  currentBoard: WeekBoard;
  currentWeekStartISO: string;
}): Promise<CrossWeekDuplicateResult> {
  const datesByWeek = new Map<string, string[]>();
  for (const dateISO of targetDates) {
    const weekStart = getWeekStartFromDate(dateISO, TZ);
    const existing = datesByWeek.get(weekStart) || [];
    existing.push(dateISO);
    datesByWeek.set(weekStart, existing);
  }

  let updatedCurrentBoard: WeekBoard | null = null;
  let currentWeekDayCount = 0;
  let otherWeeksSaved = 0;
  const errors: string[] = [];

  const currentDates = datesByWeek.get(currentWeekStartISO);
  if (currentDates && currentDates.length > 0) {
    let board = currentBoard;
    for (const dateISO of currentDates) {
      const cloned = cloneDayLists(sourceLists);
      board = setDayLists(board, dateISO, cloned);
    }
    updatedCurrentBoard = board;
    currentWeekDayCount = currentDates.length;
  }

  const otherWeeks = Array.from(datesByWeek.entries()).filter(
    ([weekStart]) => weekStart !== currentWeekStartISO
  );

  for (const [weekStart, dates] of otherWeeks) {
    try {
      const response = await apiJSON<{ week: WeekBoard }>(
        `/api/weekly-board?week=${encodeURIComponent(weekStart)}`,
        { method: "GET" }
      );
      let remoteBoard: WeekBoard = response.week;

      for (const dateISO of dates) {
        const cloned = cloneDayLists(sourceLists);
        remoteBoard = setDayLists(remoteBoard, dateISO, cloned);
      }

      await apiJSON(
        `/api/weekly-board?week=${encodeURIComponent(weekStart)}`,
        { method: "PUT", json: { week: remoteBoard } }
      );

      otherWeeksSaved += dates.length;
    } catch (err: any) {
      console.error(`Cross-week duplicate failed for week ${weekStart}:`, err);
      errors.push(`Week of ${weekStart}: ${err.message || "Unknown error"}`);
    }
  }

  return {
    currentWeekBoard: updatedCurrentBoard,
    currentWeekDayCount,
    otherWeeksSaved,
    totalDays: targetDates.length,
    errors,
  };
}
