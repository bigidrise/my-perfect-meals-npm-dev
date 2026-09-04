/**
 * Ownership regression coverage for the consumer board mutation endpoints.
 * Each endpoint must load and authorize its board before it can inspect or
 * mutate board items.
 */

const OWNER_ID = "board-owner";
const UNRELATED_ID = "unrelated-user";
const BOARD_ID = "board-1";

const auth = { user: null as { id: string } | null };
const state = {
  selectResults: [] as Array<Array<Record<string, unknown>>>,
  selectIndex: 0,
  itemReads: 0,
  itemWrites: 0,
  boardWrites: 0,
  boardCreates: 0,
};

const nextSelectResult = () => state.selectResults[state.selectIndex++] ?? [];

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!auth.user) return res.status(401).json({ error: "Authentication required" });
    req.authUser = auth.user;
    next();
  },
}));

jest.mock("../middleware/requireEssentialAccess", () => ({
  requireEssentialAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../middleware/studioAccess", () => ({
  enforceBuilderFromParam: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../services/activityLog", () => ({
  logActivityFireAndForget: jest.fn(),
}));

jest.mock("../db", () => ({
  db: {
    select: () => ({
      from: (table: any) => {
        const tableName = table?.[Symbol.for("drizzle:Name")] ?? table?._?.name;
        const isItemTable = tableName === "meal_board_items";
        const whereResult = {
          limit: () => Promise.resolve(nextSelectResult()),
          orderBy: () => {
            if (isItemTable) state.itemReads++;
            return Promise.resolve(nextSelectResult());
          },
          then: (resolve: any, reject: any) => {
            if (isItemTable) state.itemReads++;
            return Promise.resolve(nextSelectResult()).then(resolve, reject);
          },
        };
        return { where: () => whereResult };
      },
    }),
    insert: (table: any) => ({
      values: () => {
        const tableName = table?.[Symbol.for("drizzle:Name")] ?? table?._?.name;
        if (tableName === "meal_board_items") state.itemWrites++;
        if (tableName === "meal_boards") state.boardCreates++;
        return {
          returning: () => Promise.resolve([{ id: "new-item", boardId: BOARD_ID }]),
        };
      },
    }),
    delete: (table: any) => ({
      where: () => {
        const tableName = table?.[Symbol.for("drizzle:Name")] ?? table?._?.name;
        if (tableName === "meal_board_items") state.itemWrites++;
        return Promise.resolve([]);
      },
    }),
    update: () => ({
      set: () => ({
        where: () => {
          state.boardWrites++;
          return Promise.resolve([]);
        },
      }),
    }),
  },
}));

import express from "express";
import request from "supertest";

async function buildApp() {
  const app = express();
  app.use(express.json());
  const router = (await import("../routes/mealBoards")).default;
  app.use("/api", router);
  return app;
}

const board = { id: BOARD_ID, userId: OWNER_ID, days: 2 };
const sourceItem = {
  id: "source-item",
  boardId: BOARD_ID,
  dayIndex: 0,
  slot: "breakfast",
  mealId: "meal-1",
  title: "Breakfast",
  servings: "1",
  macros: { kcal: 100, protein: 10, carbs: 10, fat: 2 },
  ingredients: [],
};

beforeEach(() => {
  auth.user = null;
  state.selectResults = [];
  state.selectIndex = 0;
  state.itemReads = 0;
  state.itemWrites = 0;
  state.boardWrites = 0;
  state.boardCreates = 0;
});

const candidates = [
  {
    name: "POST /api/boards/:boardId/items",
    request: (app: express.Express) => request(app).post(`/api/boards/${BOARD_ID}/items`).send({
      dayIndex: 0, slot: "breakfast", mealId: "meal-1", title: "Breakfast", macros: {},
    }),
    ownerResults: [[board]],
  },
  {
    name: "POST /api/boards/:boardId/repeat-day",
    request: (app: express.Express) => request(app).post(`/api/boards/${BOARD_ID}/repeat-day`).send({
      sourceDayIndex: 0,
    }),
    ownerResults: [[board], [sourceItem]],
  },
  {
    name: "POST /api/boards/:boardId/commit",
    request: (app: express.Express) => request(app).post(`/api/boards/${BOARD_ID}/commit`).send({
      scope: "week",
    }),
    ownerResults: [[board], [sourceItem]],
  },
];

describe("consumer meal board mutation ownership", () => {
  it("denies an unrelated current-board read/create before database access", async () => {
    auth.user = { id: UNRELATED_ID };

    const res = await request(await buildApp()).get(
      `/api/users/${OWNER_ID}/boards/diabetic/current`,
    );

    expect(res.status).toBe(403);
    expect(state.selectIndex).toBe(0);
    expect(state.itemReads).toBe(0);
    expect(state.boardCreates).toBe(0);
  });

  it("permits the owner to read their current board", async () => {
    auth.user = { id: OWNER_ID };
    state.selectResults = [[board], [sourceItem]];

    const res = await request(await buildApp()).get(
      `/api/users/${OWNER_ID}/boards/diabetic/current`,
    );

    expect(res.status).toBe(200);
    expect(res.body.board).toEqual(board);
  });

  for (const candidate of candidates) {
    it(`${candidate.name} permits the board owner`, async () => {
      auth.user = { id: OWNER_ID };
      state.selectResults = candidate.ownerResults;

      const res = await candidate.request(await buildApp());

      expect(res.status).toBe(200);
    });

    it(`${candidate.name} denies an unrelated user without reading or mutating board items`, async () => {
      auth.user = { id: UNRELATED_ID };
      state.selectResults = [[board]];

      const res = await candidate.request(await buildApp());

      expect(res.status).toBe(403);
      expect(state.itemReads).toBe(0);
      expect(state.itemWrites).toBe(0);
      expect(state.boardWrites).toBe(0);
    });
  }
});