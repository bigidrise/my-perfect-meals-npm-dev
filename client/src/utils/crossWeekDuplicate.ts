import { getWeekStartFromDate } from "@/utils/midnight";
import { getDayLists, setDayLists, cloneDayLists, type WeekBoard, type WeekLists } from "@/lib/boardApi";
import { apiJSON } from "@/lib/api";

const TZ = "America/Chicago";

export interface CrossWeekDuplicateResult {
  currentWeekBoard: WeekBoard | null;
  currentWeekDates: string[];
  otherWeeksSaved: number;
  totalDays: number;
}

export async function duplicateAcrossWeeks({
  sourceLists,
  targetDates,
  currentBoard,
  currentWeekStartISO,
}: {
  sourceLists: ReturnType<typeof getDayLists>;
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
  const currentWeekDates: string[] = [];
  let otherWeeksSaved = 0;

  const currentDates = datesByWeek.get(currentWeekStartISO);
  if (currentDates && currentDates.length > 0) {
    let board = currentBoard;
    for (const dateISO of currentDates) {
      const cloned = cloneDayLists(sourceLists);
      board = setDayLists(board, dateISO, cloned);
    }
    updatedCurrentBoard = board;
    currentWeekDates.push(...currentDates);
  }

  const otherWeeks = Array.from(datesByWeek.entries()).filter(
    ([weekStart]) => weekStart !== currentWeekStartISO
  );

  const otherWeekPromises = otherWeeks.map(async ([weekStart, dates]) => {
    const response = await apiJSON<{ week: WeekBoard }>(`/api/weekly-board?week=${encodeURIComponent(weekStart)}`, {
      method: "GET",
    });
    let remoteBoard: WeekBoard = response.week;

    for (const dateISO of dates) {
      const cloned = cloneDayLists(sourceLists);
      remoteBoard = setDayLists(remoteBoard, dateISO, cloned);
    }

    await apiJSON(`/api/weekly-board?week=${encodeURIComponent(weekStart)}`, {
      method: "PUT",
      json: { week: remoteBoard },
    });

    return dates.length;
  });

  const results = await Promise.all(otherWeekPromises);
  otherWeeksSaved = results.reduce((a, b) => a + b, 0);

  return {
    currentWeekBoard: updatedCurrentBoard,
    currentWeekDates,
    otherWeeksSaved,
    totalDays: targetDates.length,
  };
}
