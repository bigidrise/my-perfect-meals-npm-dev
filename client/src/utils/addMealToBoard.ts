import {
  getCurrentWeekBoard,
  getWeekBoardByDate,
  putWeekBoard,
  type ExtendedMeal as BoardMeal,
  type WeekBoard,
  type WeekLists,
  weekDates,
  getDayLists,
  setDayLists,
  cloneDayLists,
} from "@/lib/boardApi";

export type ListType = "breakfast" | "lunch" | "dinner" | "snacks";

export type AddMealParams = {
  sourceMeal: BoardMeal | {
    id?: string;
    title: string;
    servings?: number;
    ingredients?: { item: string; amount: string }[];
    instructions?: string[];
    nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number };
    badges?: string[];
    technique?: string;
    cuisine?: string;
  };
  list: ListType;
  weekStartISO?: string;   // if omitted, use current week
  dateISO?: string | null; // if provided, add to that day within the week; if null/omitted, legacy single-day
};

function toBoardMeal(src: AddMealParams["sourceMeal"]): BoardMeal {
  const base = src as any;
  return {
    id: `fr-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    title: base.name ?? base.title ?? "Untitled",
    servings: Number(base.servings ?? 1),
    ingredients: Array.isArray(base.ingredients) 
      ? base.ingredients.map((ing: any) => ({
          item: ing.item || ing.name || String(ing),
          amount: ing.amount || ing.quantity || ""
        }))
      : [],
    instructions: Array.isArray(base.instructions) 
      ? base.instructions 
      : typeof base.instructions === 'string' 
        ? [base.instructions] 
        : [],
    nutrition: {
      calories: Number(base?.nutrition?.calories ?? 0),
      protein:  Number(base?.nutrition?.protein_g ?? base?.nutrition?.protein ?? 0),
      carbs:    Number(base?.nutrition?.carbs_g ?? base?.nutrition?.carbs ?? 0),
      fat:      Number(base?.nutrition?.fat_g ?? base?.nutrition?.fat ?? 0),
      starchyCarbs: Number(base?.starchyCarbs ?? base?.nutrition?.starchyCarbs ?? 0),
      fibrousCarbs: Number(base?.fibrousCarbs ?? base?.nutrition?.fibrousCarbs ?? 0),
    },
    starchyCarbs: Number(base?.starchyCarbs ?? base?.nutrition?.starchyCarbs ?? 0),
    fibrousCarbs: Number(base?.fibrousCarbs ?? base?.nutrition?.fibrousCarbs ?? 0),
    badges: base.badges,
    technique: base.technique,
    cuisine: base.cuisine,
  };
}

/** Adds a meal to a week (and optional day). Creates day buckets if needed. */
export async function addMealToBoard(params: AddMealParams) {
  const { list, weekStartISO, dateISO } = params;
  const meal = toBoardMeal(params.sourceMeal);

  // 1) Load target week
  const wk = weekStartISO
    ? await getWeekBoardByDate(weekStartISO)
    : await getCurrentWeekBoard();
  let board: WeekBoard = wk.week;

  // 2) Insert into correct container
  if (dateISO) {
    // Per-day planning path
    const listsForDay: WeekLists = getDayLists(board, dateISO); // ensures days exists
    const updatedForDay: WeekLists = {
      ...listsForDay,
      [list]: [...listsForDay[list], meal],
    };
    board = setDayLists(board, dateISO, updatedForDay);
  } else {
    // Legacy single-day path
    const lists = board.lists ?? { breakfast: [], lunch: [], dinner: [], snacks: [] };
    board = {
      ...board,
      lists: {
        ...lists,
        [list]: [...lists[list], meal],
      },
    };
  }

  // 3) Save
  await putWeekBoard(wk.weekStartISO, board);

  // Return useful context
  const dates = weekDates(wk.weekStartISO);
  return { weekStartISO: wk.weekStartISO, dates, addedTo: dateISO ?? "legacy" as const };
}
