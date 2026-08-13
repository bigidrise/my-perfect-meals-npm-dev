/**
 * boardItemDelete.route.test.ts
 *
 * Route-level tests for the board-item delete endpoints:
 *   DELETE /api/boards/:boardId/items/:itemId          (generic — mealBoards.ts)
 *   DELETE /api/pro/board/clients/:clientId/boards/:boardId/items/:itemId  (Pro — proBoardRoutes.ts)
 *
 * What is exercised by the real route code:
 *   • Authentication gate (401 when unauthenticated)
 *   • Board ownership / access gate (403 / 404 for wrong owner)
 *   • Item-board scope check (404 when itemId doesn't belong to boardId)
 *   • Default delete: board item removed, macro_log preserved (history intact)
 *   • Replace-intent delete (releaseLog: true): board item + macro_log removed atomically
 *   • Board updatedAt stamp written in every successful transaction
 *
 * Mock strategy: mount only the relevant router in a minimal Express app.
 *   requireAuth, requireEssentialAccess, and requireBoardAccess are mocked
 *   so auth does not hit the database. The db module is mocked so deletions
 *   are tracked without touching the real database.
 *
 * ts-jest hoisting rule: all jest.mock() factories must be declared before
 * any imports that depend on the mocked modules.
 */

// ── Mutable singletons captured by mock factories ─────────────────────────────

const mockAuth = {
  user: null as Record<string, unknown> | null,
};

const mockBoardAccess = {
  active: false,
  access: null as Record<string, unknown> | null,
};

/**
 * DB mock state — reset in beforeEach.
 *
 * selectResults: ordered list of arrays returned per db.select() call.
 *   index 0 = first select (board lookup), index 1 = second select (item lookup).
 * deletedFromTables: names of tables targeted inside tx.delete() calls.
 * txExecuted: true once db.transaction() callback runs.
 * updateCalled: true once the board-stamp update runs.
 */
const mockDb = {
  selectResults: [] as Array<Array<Record<string, unknown>>>,
  selectCallIdx: 0,
  deletedFromTables: [] as string[],
  txExecuted: false,
  updateCalled: false,
};

// ── jest.mock declarations (hoisted) ─────────────────────────────────────────

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockAuth.user) {
      return res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    }
    req.authUser = mockAuth.user;
    next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("../middleware/requireEssentialAccess", () => ({
  requireEssentialAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../middleware/requireBoardAccess", () => ({
  requireBoardAccess: (req: any, res: any, next: any) => {
    if (!mockBoardAccess.active || !mockBoardAccess.access) {
      return res.status(403).json({ error: "Board access denied" });
    }
    req.boardAccess = mockBoardAccess.access;
    next();
  },
  BoardAccessRequest: {},
}));

jest.mock("../services/activityLog", () => ({
  logActivityFireAndForget: jest.fn(),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────

jest.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const row = mockDb.selectResults[mockDb.selectCallIdx++];
            return Promise.resolve(row ?? []);
          },
          orderBy: () => Promise.resolve(mockDb.selectResults[mockDb.selectCallIdx++] ?? []),
        }),
      }),
    }),
    delete: (table: any) => ({
      where: () => {
        const name = table?.[Symbol.for("drizzle:Name")] ?? table?._.name ?? String(table);
        mockDb.deletedFromTables.push(name);
        return Promise.resolve([]);
      },
    }),
    update: () => ({
      set: () => ({
        where: () => {
          mockDb.updateCalled = true;
          return Promise.resolve([]);
        },
      }),
    }),
    transaction: async (fn: (tx: any) => Promise<void>) => {
      mockDb.txExecuted = true;
      const tx = {
        delete: (table: any) => ({
          where: () => {
            const name = table?.[Symbol.for("drizzle:Name")] ?? table?._.name ?? String(table);
            mockDb.deletedFromTables.push(name);
            return Promise.resolve([]);
          },
        }),
        update: () => ({
          set: () => ({
            where: () => {
              mockDb.updateCalled = true;
              return Promise.resolve([]);
            },
          }),
        }),
      };
      return fn(tx);
    },
  },
}));

// ── Imports (after mock declarations) ─────────────────────────────────────────

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";

// ── App factories ─────────────────────────────────────────────────────────────

async function buildGenericApp() {
  const app = express();
  app.use(express.json());
  const router = (await import("../routes/mealBoards")).default;
  app.use("/api", router);
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });
  return app;
}

async function buildProApp() {
  const app = express();
  app.use(express.json());
  const router = (await import("../routes/proBoardRoutes")).default;
  app.use("/api/pro/board", router);
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWNER_USER_ID  = "user-owner-abc";
const OTHER_USER_ID  = "user-other-xyz";
const CLIENT_USER_ID = "client-user-123";
const PRO_USER_ID    = "pro-user-456";
const BOARD_ID       = "board-uuid-001";
const ITEM_ID        = "item-uuid-001";

const boardRow       = { id: BOARD_ID, userId: OWNER_USER_ID };
const clientBoardRow = { id: BOARD_ID, userId: CLIENT_USER_ID };
const itemRow        = { id: ITEM_ID,  boardId: BOARD_ID };

function asUser(id: string) {
  mockAuth.user = { id, planLookupKey: "mpm_ultimate" };
}

function asProAccess(role = "trainer") {
  mockBoardAccess.active = true;
  mockBoardAccess.access = {
    clientUserId: CLIENT_USER_ID,
    proUserId:    PRO_USER_ID,
    role,
    permissions: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
  };
}

// ── Reset ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockAuth.user             = null;
  mockBoardAccess.active    = false;
  mockBoardAccess.access    = null;
  mockDb.selectResults      = [];
  mockDb.selectCallIdx      = 0;
  mockDb.deletedFromTables  = [];
  mockDb.txExecuted         = false;
  mockDb.updateCalled       = false;
  jest.resetModules();
});

// ── Suite A: Generic delete — authentication gate ─────────────────────────────

describe("DELETE /api/boards/:boardId/items/:itemId — authentication", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildGenericApp();
    const res = await request(app).delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`);
    expect(res.status).toBe(401);
  });
});

// ── Suite B: Generic delete — board ownership gate ───────────────────────────

describe("DELETE /api/boards/:boardId/items/:itemId — board ownership", () => {
  it("returns 404 when board does not exist", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [[]];
    const app = await buildGenericApp();
    const res = await request(app).delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/board not found/i);
  });

  it("returns 403 when authenticated user does not own the board", async () => {
    asUser(OTHER_USER_ID);
    mockDb.selectResults = [[boardRow]]; // owned by OWNER_USER_ID, not OTHER_USER_ID
    const app = await buildGenericApp();
    const res = await request(app).delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden/i);
  });
});

// ── Suite C: Generic delete — item-board scope check ─────────────────────────

describe("DELETE /api/boards/:boardId/items/:itemId — item-board scope", () => {
  it("returns 404 when item does not exist in this board", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [
      [boardRow],  // board exists, owned by caller
      [],          // item not found in this board
    ];
    const app = await buildGenericApp();
    const res = await request(app).delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/board item not found/i);
  });

  it("returns 404 when itemId belongs to a different board (cross-board denial)", async () => {
    // Attacker passes BOARD_ID but ITEM_ID belongs to another board.
    // The item lookup is scoped to AND(id=itemId, boardId=boardId) → returns empty.
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [
      [boardRow],  // board exists, owned by caller
      [],          // item not found when scoped to this board
    ];
    const app = await buildGenericApp();
    const res = await request(app).delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`);
    expect(res.status).toBe(404);
  });
});

// ── Suite D: Generic delete — default path (no releaseLog) ───────────────────

describe("DELETE /api/boards/:boardId/items/:itemId — default delete (history preserved)", () => {
  it("returns 200 and executes a transaction", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [[boardRow], [itemRow]];
    const app = await buildGenericApp();
    const res = await request(app).delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("runs deletion atomically inside a transaction", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [[boardRow], [itemRow]];
    const app = await buildGenericApp();
    await request(app).delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`);
    expect(mockDb.txExecuted).toBe(true);
  });

  it("does NOT delete the macro_log when releaseLog is omitted (history preserved)", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [[boardRow], [itemRow]];
    const app = await buildGenericApp();
    await request(app)
      .delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`)
      .send({});   // no releaseLog field

    const logDeleted = mockDb.deletedFromTables.some(t => t.includes("macro_log"));
    expect(logDeleted).toBe(false);
  });

  it("does NOT delete the macro_log when releaseLog is explicitly false", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [[boardRow], [itemRow]];
    const app = await buildGenericApp();
    await request(app)
      .delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`)
      .send({ releaseLog: false });

    const logDeleted = mockDb.deletedFromTables.some(t => t.includes("macro_log"));
    expect(logDeleted).toBe(false);
  });

  it("deletes the board item in the transaction", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [[boardRow], [itemRow]];
    const app = await buildGenericApp();
    await request(app).delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`);
    const itemDeleted = mockDb.deletedFromTables.some(
      t => t.includes("board_item") || t.includes("meal_board_item")
    );
    expect(itemDeleted).toBe(true);
  });

  it("stamps the board updatedAt in the transaction", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [[boardRow], [itemRow]];
    const app = await buildGenericApp();
    await request(app).delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`);
    expect(mockDb.updateCalled).toBe(true);
  });
});

// ── Suite E: Generic delete — replace-intent path (releaseLog: true) ──────────

describe("DELETE /api/boards/:boardId/items/:itemId — replace intent (releaseLog: true)", () => {
  it("returns 200 when releaseLog is true", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [[boardRow], [itemRow]];
    const app = await buildGenericApp();
    const res = await request(app)
      .delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`)
      .send({ releaseLog: true });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("deletes the macro_log before the board item (starch slot released first)", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [[boardRow], [itemRow]];
    const app = await buildGenericApp();
    await request(app)
      .delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`)
      .send({ releaseLog: true });

    const logIdx  = mockDb.deletedFromTables.findIndex(t => t.includes("macro_log"));
    const itemIdx = mockDb.deletedFromTables.findIndex(
      t => t.includes("board_item") || t.includes("meal_board_item")
    );
    expect(logIdx).toBeGreaterThanOrEqual(0);
    expect(itemIdx).toBeGreaterThanOrEqual(0);
    expect(logIdx).toBeLessThan(itemIdx);
  });

  it("both log and board-item deletion run inside the same transaction", async () => {
    asUser(OWNER_USER_ID);
    mockDb.selectResults = [[boardRow], [itemRow]];
    const app = await buildGenericApp();
    await request(app)
      .delete(`/api/boards/${BOARD_ID}/items/${ITEM_ID}`)
      .send({ releaseLog: true });
    expect(mockDb.txExecuted).toBe(true);
    expect(mockDb.deletedFromTables.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Suite F: Pro board delete — access gate ───────────────────────────────────

describe("DELETE /api/pro/board/clients/:clientId/boards/:boardId/items/:itemId — access gate", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildProApp();
    const res = await request(app).delete(
      `/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when requireBoardAccess denies the request", async () => {
    asUser(PRO_USER_ID);
    // boardAccess.active = false → requireBoardAccess middleware returns 403
    const app = await buildProApp();
    const res = await request(app).delete(
      `/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when the pro user lacks canEditPlan permission", async () => {
    asUser(PRO_USER_ID);
    mockBoardAccess.active = true;
    mockBoardAccess.access = {
      clientUserId: CLIENT_USER_ID,
      proUserId:    PRO_USER_ID,
      role:         "viewer",
      permissions: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
    };
    const app = await buildProApp();
    const res = await request(app).delete(
      `/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`
    );
    expect(res.status).toBe(403);
  });
});

// ── Suite G: Pro board delete — board/item scope ──────────────────────────────

describe("DELETE /api/pro/board/clients/:clientId/boards/:boardId/items/:itemId — scope", () => {
  it("returns 404 when board does not belong to the client", async () => {
    asUser(PRO_USER_ID);
    asProAccess();
    mockDb.selectResults = [[{ id: BOARD_ID, userId: "wrong-client" }]];
    const app = await buildProApp();
    const res = await request(app).delete(
      `/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when item does not exist in this board (cross-board denial)", async () => {
    asUser(PRO_USER_ID);
    asProAccess();
    mockDb.selectResults = [
      [clientBoardRow],  // board belongs to client
      [],                // item not in this board
    ];
    const app = await buildProApp();
    const res = await request(app).delete(
      `/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`
    );
    expect(res.status).toBe(404);
  });
});

// ── Suite H: Pro board delete — default path (history preserved) ──────────────

describe("DELETE /api/pro/board/clients/:clientId/boards/:boardId/items/:itemId — default delete", () => {
  it("returns 200 and executes a transaction", async () => {
    asUser(PRO_USER_ID);
    asProAccess();
    mockDb.selectResults = [[clientBoardRow], [itemRow]];
    const app = await buildProApp();
    const res = await request(app).delete(
      `/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("does NOT delete the macro_log by default (client nutrition history preserved)", async () => {
    asUser(PRO_USER_ID);
    asProAccess();
    mockDb.selectResults = [[clientBoardRow], [itemRow]];
    const app = await buildProApp();
    await request(app).delete(
      `/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`
    );
    const logDeleted = mockDb.deletedFromTables.some(t => t.includes("macro_log"));
    expect(logDeleted).toBe(false);
  });

  it("client role can delete their own board item (role=client bypasses canEditPlan)", async () => {
    asUser(CLIENT_USER_ID);
    mockBoardAccess.active = true;
    mockBoardAccess.access = {
      clientUserId: CLIENT_USER_ID,
      proUserId:    PRO_USER_ID,
      role:         "client",
      permissions: { canViewMacros: true, canAddMeals: true, canEditPlan: false },
    };
    mockDb.selectResults = [[clientBoardRow], [itemRow]];
    const app = await buildProApp();
    const res = await request(app).delete(
      `/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`
    );
    expect(res.status).toBe(200);
  });
});

// ── Suite I: Pro board delete — replace-intent path (releaseLog: true) ────────

describe("DELETE /api/pro/board/clients/:clientId/boards/:boardId/items/:itemId — replace intent", () => {
  it("deletes the macro_log when releaseLog is true (starch slot released for client)", async () => {
    asUser(PRO_USER_ID);
    asProAccess();
    mockDb.selectResults = [[clientBoardRow], [itemRow]];
    const app = await buildProApp();
    await request(app)
      .delete(`/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`)
      .send({ releaseLog: true });

    const logDeleted = mockDb.deletedFromTables.some(t => t.includes("macro_log"));
    expect(logDeleted).toBe(true);
  });

  it("deletes macro_log before board item (slot released first in transaction)", async () => {
    asUser(PRO_USER_ID);
    asProAccess();
    mockDb.selectResults = [[clientBoardRow], [itemRow]];
    const app = await buildProApp();
    await request(app)
      .delete(`/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`)
      .send({ releaseLog: true });

    const logIdx  = mockDb.deletedFromTables.findIndex(t => t.includes("macro_log"));
    const itemIdx = mockDb.deletedFromTables.findIndex(
      t => t.includes("board_item") || t.includes("meal_board_item")
    );
    expect(logIdx).toBeGreaterThanOrEqual(0);
    expect(itemIdx).toBeGreaterThanOrEqual(0);
    expect(logIdx).toBeLessThan(itemIdx);
  });

  it("does NOT delete macro_log when releaseLog is false (history preserved even via Pro route)", async () => {
    asUser(PRO_USER_ID);
    asProAccess();
    mockDb.selectResults = [[clientBoardRow], [itemRow]];
    const app = await buildProApp();
    await request(app)
      .delete(`/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`)
      .send({ releaseLog: false });

    const logDeleted = mockDb.deletedFromTables.some(t => t.includes("macro_log"));
    expect(logDeleted).toBe(false);
  });

  it("runs atomically inside a transaction on the Pro replace path", async () => {
    asUser(PRO_USER_ID);
    asProAccess();
    mockDb.selectResults = [[clientBoardRow], [itemRow]];
    const app = await buildProApp();
    await request(app)
      .delete(`/api/pro/board/clients/${CLIENT_USER_ID}/boards/${BOARD_ID}/items/${ITEM_ID}`)
      .send({ releaseLog: true });
    expect(mockDb.txExecuted).toBe(true);
  });
});
