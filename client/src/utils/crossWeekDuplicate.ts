import { getWeekStartFromDate } from "@/utils/midnight";
import { apiUrl } from "@/lib/resolveApiBase";
import { getDayLists, setDayLists, cloneDayLists, type WeekBoard } from "@/lib/boardApi";

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
    const fetchUrl = apiUrl(`/api/weekly-board?week=${encodeURIComponent(weekStart)}`);
    const res = await fetch(fetchUrl, { credentials: "include" });
    let remoteBoard: WeekBoard;

    if (res.ok) {
      const json = await res.json();
      remoteBoard = json.week;
    } else {
      remoteBoard = {
        id: `week-${weekStart}`,
        version: 1,
        lists: { breakfast: [], lunch: [], dinner: [], snacks: [] },
        meta: {
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
        },
      } as WeekBoard;
    }

    for (const dateISO of dates) {
      const cloned = cloneDayLists(sourceLists);
      remoteBoard = setDayLists(remoteBoard, dateISO, cloned);
    }

    const saveUrl = apiUrl(`/api/weekly-board?week=${encodeURIComponent(weekStart)}`);
    const saveRes = await fetch(saveUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ week: remoteBoard }),
    });

    if (!saveRes.ok) {
      throw new Error(`Failed to save week ${weekStart}: HTTP ${saveRes.status}`);
    }

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
