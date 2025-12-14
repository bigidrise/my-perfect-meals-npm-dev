import type { Express, Request, Response } from "express";
import { getWeekStartISO, isValidISODate } from '../utils/week';
import { buildShoppingList } from '../services/shopping-list/list-builder';
import { resolveUserId, getWeekBoard, upsertWeekBoard } from '../data/weekBoardsRepo';

// Type definition for WeekBoard
type WeekBoard = {
  id: string;
  version: number;
  lists: { breakfast: any[]; lunch: any[]; dinner: any[]; snacks: any[] };
  meta: { createdAt: string; lastUpdatedAt: string };
};

// Legacy store (keep for backward compatibility)
const store: { board: any|null } = { board: null };

// NEW: week storage keyed by weekStartISO (YYYY-MM-DD)
const weekStore: Record<string, WeekBoard> = {};

// Enhanced Meal normalizer with support for unlimited snacks (orderIndex + name)
function normalizeMeal(meal: any, idx: number = 0) {
  const m = meal && typeof meal === "object" ? { ...meal } : {};
  
  // Core meal properties
  m.id = String(m?.id ?? `m-${idx}`);
  m.title = String(m?.title ?? 'Untitled');
  m.servings = Number(m?.servings ?? 1);
  
  // ensure ingredients array of { item, amount, unit }
  const src = Array.isArray(m.ingredients) ? m.ingredients : [];
  m.ingredients = src
    .map((ing: any) => {
      if (!ing) return null;
      if (typeof ing === "string") return { item: ing.trim(), amount: "", unit: "" };
      const item = String(ing.item ?? ing.name ?? "").trim();
      const amount = String(ing.amount ?? ing.quantity ?? "").trim();
      const unit = String(ing.unit ?? "").trim();
      return item ? { item, amount, unit } : null;
    })
    .filter(Boolean);

  // instructions must be array of strings
  m.instructions = Array.isArray(m.instructions) ? m.instructions.map(String) : [];

  // nutrition required
  const n = m.nutrition || {};
  m.nutrition = {
    calories: Number(n.calories) || 0,
    protein:  Number(n.protein)  || 0,
    carbs:    Number(n.carbs)    || 0,
    fat:      Number(n.fat)      || 0,
  };

  // badges optional
  m.badges = Array.isArray(m.badges) ? m.badges.map(String) : undefined;
  m.technique = m?.technique ? String(m.technique) : undefined;
  m.cuisine = m?.cuisine ? String(m.cuisine) : undefined;

  // NEW: Support for unlimited snacks with ordering + custom labels
  m.orderIndex = typeof m?.orderIndex === 'number' ? m.orderIndex : undefined;
  m.name = m?.name ? String(m.name) : undefined;

  // AI Meal Creator fields
  m.description = m?.description ? String(m.description) : undefined;
  m.imageUrl = m?.imageUrl ? String(m.imageUrl) : undefined;
  m.cookingTime = m?.cookingTime ? String(m.cookingTime) : undefined;
  m.difficulty = m?.difficulty ? String(m.difficulty) : undefined;
  m.medicalBadges = Array.isArray(m?.medicalBadges) ? m.medicalBadges : undefined;

  return m;
}

// Enhanced normalizeBoard function with unlimited snacks support
function normalizeBoard(raw: any): any {
  const base = raw ?? {};
  const lists = base.lists ?? {};

  const normalizeMealArray = (arr: any): any[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((m: any, idx: number) => ({
      id: String(m?.id ?? `m-${idx}`),
      title: String(m?.title ?? 'Untitled'),
      servings: Number(m?.servings ?? 1),
      ingredients: Array.isArray(m?.ingredients) ? m.ingredients.map((i: any) => ({
        item: String(i?.item ?? i?.name ?? ''),
        amount: String(i?.amount ?? i?.quantity ?? ''),
        unit: String(i?.unit ?? ''),
      })) : [],
      instructions: typeof m?.instructions === 'string' 
        ? m.instructions 
        : Array.isArray(m?.instructions) 
          ? m.instructions.map((s: any) => String(s)) 
          : [],
      nutrition: {
        calories: Number(m?.nutrition?.calories ?? m?.calories ?? 0),
        protein: Number(m?.nutrition?.protein ?? m?.protein ?? 0),
        carbs: Number(m?.nutrition?.carbs ?? m?.carbs ?? 0),
        fat: Number(m?.nutrition?.fat ?? m?.fat ?? 0),
      },
      badges: Array.isArray(m?.badges) ? m.badges.map(String) : undefined,
      technique: m?.technique ? String(m.technique) : undefined,
      cuisine: m?.cuisine ? String(m.cuisine) : undefined,

      // existing snack ordering
      orderIndex: typeof m?.orderIndex === 'number' ? m.orderIndex : undefined,
      name: m?.name ? String(m.name) : undefined,

      // NEW snack quick-log fields (kept optional)
      entryType: m?.entryType === 'recipe' ? 'recipe' : (m?.entryType === 'quick' ? 'quick' : undefined),
      brand: m?.brand ? String(m.brand) : undefined,
      servingDesc: m?.servingDesc ? String(m.servingDesc) : undefined,
      includeInShoppingList: typeof m?.includeInShoppingList === 'boolean' ? m.includeInShoppingList : undefined,

      // AI Meal Creator fields
      description: m?.description ? String(m.description) : undefined,
      imageUrl: m?.imageUrl ? String(m.imageUrl) : undefined,
      cookingTime: m?.cookingTime ? String(m.cookingTime) : undefined,
      difficulty: m?.difficulty ? String(m.difficulty) : undefined,
      medicalBadges: Array.isArray(m?.medicalBadges) ? m.medicalBadges : undefined,
    }));
  };

  const breakfast = normalizeMealArray(lists.breakfast);
  const lunch     = normalizeMealArray(lists.lunch);
  const dinner    = normalizeMealArray(lists.dinner);

  // 👇 KEY PART: ensure snacks is ALWAYS an array (any length) and stably ordered
  let snacks = normalizeMealArray(lists.snacks);
  // Assign orderIndex if missing, then sort
  snacks = snacks.map((m, idx) => ({
    ...m,
    orderIndex: typeof m.orderIndex === 'number' ? m.orderIndex : idx,
  })).sort((a, b) => (a.orderIndex! - b.orderIndex!));

  // NEW: Ensure 7-day structure exists
  // If this board doesn't have days yet, create them from the legacy lists (backward compatibility)
  let days = base.days ?? {};
  
  // Determine what week this board represents
  const boardId = String(base.id ?? 'current');
  let weekStartISO: string;
  
  if (boardId.startsWith('week-')) {
    weekStartISO = boardId.replace('week-', '');
  } else {
    // Fallback to current week
    weekStartISO = getWeekStartISO();
  }
  
  // Generate all 7 dates for this week (Mon-Sun)
  const weekDates: string[] = [];
  const startDate = new Date(weekStartISO + 'T00:00:00Z');
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + i);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    weekDates.push(`${year}-${month}-${day}`);
  }
  
  // Ensure all 7 days exist
  weekDates.forEach(dateISO => {
    if (!days[dateISO]) {
      // If this is Monday and we have legacy lists, use them for backward compatibility
      if (dateISO === weekDates[0] && (breakfast.length || lunch.length || dinner.length || snacks.length)) {
        days[dateISO] = {
          breakfast: breakfast,
          lunch: lunch,
          dinner: dinner,
          snacks: snacks,
        };
      } else {
        days[dateISO] = {
          breakfast: [],
          lunch: [],
          dinner: [],
          snacks: [],
        };
      }
    } else {
      // Normalize existing days
      const dayLists = days[dateISO];
      let daySnacks = normalizeMealArray(dayLists.snacks);
      daySnacks = daySnacks.map((m, idx) => ({
        ...m,
        orderIndex: typeof m.orderIndex === 'number' ? m.orderIndex : idx,
      })).sort((a, b) => (a.orderIndex! - b.orderIndex!));
      
      days[dateISO] = {
        breakfast: normalizeMealArray(dayLists.breakfast),
        lunch: normalizeMealArray(dayLists.lunch),
        dinner: normalizeMealArray(dayLists.dinner),
        snacks: daySnacks,
      };
    }
  });

  return {
    id: boardId,
    version: Number(base.version ?? 1),
    // Keep legacy lists for backward compatibility (use Monday's data)
    lists: days[weekDates[0]] || { breakfast, lunch, dinner, snacks },
    // NEW: 7-day structure
    days: days,
    meta: {
      createdAt: String(base.meta?.createdAt ?? new Date().toISOString()),
      lastUpdatedAt: String(new Date().toISOString()),
    },
  };
}

// Helper to append snacks safely with proper ordering
function appendSnack(day: any, snack: any): any {
  const current = day.lists.snacks ?? [];
  const nextIndex = current.length > 0
    ? Math.max(...current.map((s: any) => s.orderIndex ?? 0)) + 1
    : 0;

  const newSnack = {
    id: snack.id ?? `snk-${Date.now()}`,
    title: snack.title ?? 'Snack',
    name: snack.name ?? `Snack ${nextIndex + 1}`,
    servings: snack.servings ?? 1,
    ingredients: snack.ingredients ?? [],
    instructions: snack.instructions ?? [],
    nutrition: snack.nutrition ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
    orderIndex: nextIndex,
  };

  return {
    ...day,
    lists: {
      ...day.lists,
      snacks: [...current, newSnack],
    },
    version: (day.version ?? 0) + 1,
    meta: {
      ...day.meta,
      lastUpdatedAt: new Date().toISOString(),
    }
  };
}

// Safe default board factory for week-aware storage
function createEmptyWeekBoard(weekStartISO: string): WeekBoard {
  const now = new Date().toISOString();
  return {
    id: `week-${weekStartISO}`,
    version: 1,
    lists: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    meta: { createdAt: now, lastUpdatedAt: now },
  };
}

function getOrCreateWeek(weekStartISO: string): WeekBoard {
  if (!weekStore[weekStartISO]) {
    weekStore[weekStartISO] = createEmptyWeekBoard(weekStartISO);
  }
  return weekStore[weekStartISO];
}

export default function weekBoardRoutes(app: Express) {
  app.get("/api/week-board", (req: Request, res: Response) => {
    if (!store.board) {
      const today = new Date().toISOString().slice(0,10);
      store.board = {
        id: "current",
        version: 1,
        lists: { breakfast: [], lunch: [], dinner: [], snacks: [] },
        meta: { createdAt: today, lastUpdatedAt: today }
      };
    }
    res.json(store.board);
  });

  app.put("/api/week-board", (req: Request, res: Response) => {
    const b = req.body || {};
    b.version = (b.version|0) + 1;
    b.meta = { ...(b.meta||{}), lastUpdatedAt: new Date().toISOString() };
    store.board = normalizeBoard(b);
    res.json(store.board);
  });

  app.post("/api/week-board/add", (req: Request, res: Response) => {
    const { list, meal } = req.body || {};
    if (!store.board) return res.status(400).json({ error: "board not initialized" });
    if (!["breakfast","lunch","dinner","snacks"].includes(list)) return res.status(400).json({ error: "invalid list" });
    
    // For snacks, use the appendSnack helper to maintain proper ordering
    if (list === "snacks") {
      store.board = appendSnack(store.board, meal);
    } else {
      const normalized = normalizeMeal(meal, store.board.lists[list].length);
      store.board.lists[list].push(normalized);
      store.board.version++;
      store.board.meta.lastUpdatedAt = new Date().toISOString();
    }
    
    res.json(store.board);
  });

  app.post("/api/week-board/remove", (req: Request, res: Response) => {
    const { list, mealId } = req.body || {};
    if (!store.board) return res.status(400).json({ error: "board not initialized" });
    store.board.lists[list] = store.board.lists[list].filter((m:any) => m.id !== mealId);
    store.board.version++;
    store.board.meta.lastUpdatedAt = new Date().toISOString();
    res.json(store.board);
  });

  // NEW WEEK-AWARE ENDPOINTS

  // GET current week board (America/Chicago Monday)
  app.get("/api/week-boards/current-week", async (req: Request, res: Response) => {
    const userId = resolveUserId(req);
    const weekStartISO = getWeekStartISO();
    let board = await getWeekBoard(userId, weekStartISO);
    if (!board) {
      board = getOrCreateWeek(weekStartISO);
      await upsertWeekBoard(userId, weekStartISO, board);
    }
    return res.json({ weekStartISO, week: normalizeBoard(board) });
  });

  // GET specific week board by weekStartISO (YYYY-MM-DD)
  app.get("/api/week-board/:weekStartISO", async (req: Request, res: Response) => {
    const { weekStartISO } = req.params;
    if (!isValidISODate(weekStartISO)) {
      return res.status(400).json({ error: 'Invalid weekStartISO format (YYYY-MM-DD)' });
    }
    const userId = resolveUserId(req);
    let board = await getWeekBoard(userId, weekStartISO);
    if (!board) {
      board = getOrCreateWeek(weekStartISO);
      await upsertWeekBoard(userId, weekStartISO, board);
    }
    return res.json({ weekStartISO, week: normalizeBoard(board) });
  });

  // PUT specific week board (save/replace the week)
  app.put("/api/week-board/:weekStartISO", async (req: Request, res: Response) => {
    const { weekStartISO } = req.params;
    if (!isValidISODate(weekStartISO)) {
      return res.status(400).json({ error: 'Invalid weekStartISO format (YYYY-MM-DD)' });
    }

    const userId = resolveUserId(req);
    // Accept the same shape your current /api/week-board expects
    const incoming = normalizeBoard(req.body?.week ?? req.body);
    // enforce id + timestamps for consistency
    const now = new Date().toISOString();
    const saved: WeekBoard = {
      ...incoming,
      id: `week-${weekStartISO}`,
      meta: {
        createdAt: (await getWeekBoard(userId, weekStartISO))?.meta?.createdAt ?? now,
        lastUpdatedAt: now,
      },
    };
    await upsertWeekBoard(userId, weekStartISO, saved);
    return res.json({ weekStartISO, week: normalizeBoard(saved) });
  });

  // BULLETPROOF WEEKLY BOARD API (guarantees response, create-if-missing)
  
  // GET weekly board with guaranteed response (query param version)
  app.get("/api/weekly-board", async (req: Request, res: Response) => {
    const weekParam = req.query.week as string | undefined;
    const weekStartISO = weekParam && isValidISODate(weekParam) ? weekParam : getWeekStartISO();
    
    const userId = resolveUserId(req);
    let board = await getWeekBoard(userId, weekStartISO);
    let source = "db";
    
    if (!board) {
      board = getOrCreateWeek(weekStartISO);
      await upsertWeekBoard(userId, weekStartISO, board);
      source = "seed";
    }
    
    return res.json({ 
      weekStartISO, 
      week: normalizeBoard(board),
      source 
    });
  });

  // PUT weekly board with idempotent saves (query param version)
  app.put("/api/weekly-board", async (req: Request, res: Response) => {
    const weekParam = req.query.week as string | undefined;
    const weekStartISO = weekParam && isValidISODate(weekParam) ? weekParam : getWeekStartISO();
    
    const userId = resolveUserId(req);
    const incoming = normalizeBoard(req.body?.week ?? req.body);
    const opId = req.body?.opId; // Idempotent operation ID (for future use)
    
    const now = new Date().toISOString();
    const saved: WeekBoard = {
      ...incoming,
      id: `week-${weekStartISO}`,
      meta: {
        createdAt: (await getWeekBoard(userId, weekStartISO))?.meta?.createdAt ?? now,
        lastUpdatedAt: now,
      },
    };
    
    await upsertWeekBoard(userId, weekStartISO, saved);
    
    return res.json({ 
      weekStartISO, 
      week: normalizeBoard(saved),
      source: "db"
    });
  });

  // SHOPPING LIST ENDPOINT

  // Helper functions for shopping list endpoint
  function toMondayISO(iso: string): string {
    const d = new Date(`${iso}T00:00:00Z`);
    // Normalize to UTC Monday (ISO week start)
    const weekday = d.getUTCDay(); // 0..6
    const backToMon = (weekday + 6) % 7; // Sun->6, Mon->0, Tue->1...
    d.setUTCDate(d.getUTCDate() - backToMon);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function isYYYYMMDD(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  // GET shopping list for specific week
  app.get("/api/shopping-list/:weekStartISO", async (req: Request, res: Response) => {
    const { weekStartISO } = req.params;

    // Basic shape check first (keeps error messages clear)
    if (!isYYYYMMDD(weekStartISO)) {
      return res.status(400).json({ error: "Invalid weekStartISO format (YYYY-MM-DD)" });
    }

    // Normalize to Monday (UTC) so server always works with a canonical key
    const mondayISO = toMondayISO(weekStartISO);

    const userId = resolveUserId(req);
    let board = await getWeekBoard(userId, mondayISO);
    if (!board) {
      board = getOrCreateWeek(mondayISO);
      await upsertWeekBoard(userId, mondayISO, board);
    }

    const week = normalizeBoard(board);
    const excludedItems = (board.meta as any)?.excludedItems || [];
    const list = buildShoppingList(week, excludedItems);

    // Return the normalized canonical weekStartISO
    return res.json({ weekStartISO: mondayISO, list });
  });

  // DELETE shopping list item for specific week
  app.delete("/api/shopping-list/:weekStartISO/item", async (req: Request, res: Response) => {
    const { weekStartISO } = req.params;
    const { type, name, amount } = req.body;

    // Validate input
    if (!isYYYYMMDD(weekStartISO)) {
      return res.status(400).json({ error: "Invalid weekStartISO format (YYYY-MM-DD)" });
    }

    if (!type || !name || (type !== "pantry" && type !== "groceries")) {
      return res.status(400).json({ error: "Missing or invalid type/name in request body" });
    }

    // Normalize to Monday (UTC)
    const mondayISO = toMondayISO(weekStartISO);

    const userId = resolveUserId(req);
    let board = await getWeekBoard(userId, mondayISO);
    
    if (!board) {
      return res.status(404).json({ error: "Week board not found" });
    }

    // Initialize excludedItems if it doesn't exist
    if (!board.meta) {
      board.meta = { createdAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString() };
    }
    if (!(board.meta as any).excludedItems) {
      (board.meta as any).excludedItems = [];
    }

    // Create a unique key for the excluded item
    const excludedKey = type === "pantry" 
      ? `pantry||${name}`
      : `groceries||${name}||${amount ?? ''}`;

    // Add to excluded items if not already there
    const excludedItems = (board.meta as any).excludedItems as string[];
    if (!excludedItems.includes(excludedKey)) {
      excludedItems.push(excludedKey);
    }

    // Update the board
    board.meta.lastUpdatedAt = new Date().toISOString();
    await upsertWeekBoard(userId, mondayISO, board);

    return res.json({ success: true, weekStartISO: mondayISO });
  });
}