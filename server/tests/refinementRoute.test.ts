/**
 * refinementRoute.test.ts
 *
 * Route-level integration tests for POST /api/refinement/confirm and /restore.
 * All DB calls and downstream services are mocked; only the route handler logic
 * and token/auth guards are exercised against a real in-memory Express app.
 *
 * Coverage (per code-review feedback):
 *   1. Confirm: stale boardVersion CAS → 409
 *   2. Confirm: replay (original meal already replaced) → 409
 *   3. Confirm: token user ≠ authenticated user → 403
 *   4. Restore: concurrent board edit (CAS miss) → 409
 *   5. Restore: replay (refined meal already gone) → 409
 *   6. Restore: token user ≠ authenticated user → 403
 *   7. Preview: day is locked → 423
 *   8. Preview: unauthenticated → 401
 *   9. Confirm: happy path → 200 + restoreToken
 *  10. Restore: happy path → 200 + restoredMealId
 */

import express, { Request, Response, NextFunction } from "express";
import request from "supertest";

// uuid ships as ESM only; mock it so Jest can import the route module
jest.mock("uuid", () => ({ v4: jest.fn(() => "test-uuid") }));

// ── Mock: DB (locked-days query chain) ────────────────────────────────────────
// The mock is defined before any imports that transitively touch `../db`.
// Per test, configure `mockDbSelect` to control whether a day is locked.

const mockDbSelect = jest.fn();

jest.mock("../db", () => ({
  db: { select: (...a: any[]) => mockDbSelect(...a) },
}));

// Drizzle-orm operators are used only for constructing the WHERE clause;
// the mock DB ignores the values so we just return stubs.
jest.mock("drizzle-orm", () => ({
  eq:  jest.fn((_col: unknown, _val: unknown) => "eq"),
  and: jest.fn((..._a: unknown[]) => "and"),
}));

// biometricsSchema — the lockedDays table descriptor is only needed as a
// token passed to the drizzle chain; a minimal stub is fine.
jest.mock("../../shared/biometricsSchema", () => ({
  lockedDays: { userId: "uid_col", dateISO: "dateISO_col" },
}));

// ── Mock: board repository ────────────────────────────────────────────────────

const mockGetWeekBoard          = jest.fn();
const mockUpsertWeekBoard       = jest.fn();
const mockConditionalUpdate     = jest.fn();

jest.mock("../data/weekBoardsRepo", () => ({
  getWeekBoard:               (...a: any[]) => mockGetWeekBoard(...a),
  upsertWeekBoard:            (...a: any[]) => mockUpsertWeekBoard(...a),
  conditionalUpdateWeekBoard: (...a: any[]) => mockConditionalUpdate(...a),
}));

// ── Mock: slot resolver + refinement engine ───────────────────────────────────

const mockResolveSlotContext = jest.fn();
const mockEngineRefine       = jest.fn();

jest.mock("../services/slotContextResolver", () => ({
  resolveSlotContext: (...a: any[]) => mockResolveSlotContext(...a),
}));

const mockRefineMeal = jest.fn();

jest.mock("../services/mealRefinementEngine", () => ({
  getMealRefinementEngine:      () => ({ refine: mockEngineRefine }),
  MealRefinementRetryableError: class MealRefinementRetryableError extends Error {
    constructor(msg: string) { super(msg); this.name = "MealRefinementRetryableError"; }
  },
  refineMeal: (...a: any[]) => mockRefineMeal(...a),
}));

// ── Imports that depend on mocks ──────────────────────────────────────────────

import { encodeToken } from "../lib/refinementToken";
import type { ConfirmTokenPayload, RestoreTokenPayload } from "../../shared/refinement";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_A = "user-a";
const USER_B = "user-b"; // different user — ownership check
const WEEK   = "2026-08-10";
const DAY    = "2026-08-13";
const SLOT   = "breakfast";

const MEAL_ORIGINAL = { id: "m-orig",    title: "Chicken Rice", macros: { calories: 400, protein: 40, carbs: 30, fat: 10 }, ingredients: [] };
const MEAL_REFINED  = { id: "m-refined", title: "Salmon Bowl",  macros: { calories: 420, protein: 42, carbs: 28, fat: 12 }, ingredients: [] };

function makeBoard(version: number, breakfastMeals: any[] = [MEAL_ORIGINAL]) {
  return {
    id: "board-1",
    version,
    meta: { createdAt: DAY, lastUpdatedAt: DAY },
    lists: {},
    days: { [DAY]: { breakfast: breakfastMeals, lunch: [], dinner: [], snacks: [] } },
  };
}

function makeConfirmToken(overrides: Partial<ConfirmTokenPayload> = {}): string {
  return encodeToken({
    type:           "refinement_confirm",
    exp:            Math.floor(Date.now() / 1000) + 600,
    userId:         USER_A,
    weekStartISO:   WEEK,
    dayISO:         DAY,
    slot:           SLOT,
    originalMealId: MEAL_ORIGINAL.id,
    newMealId:      MEAL_REFINED.id,
    boardVersion:   1,
    refinedMeal:    MEAL_REFINED as Record<string, unknown>,
    ...overrides,
  } as ConfirmTokenPayload);
}

function makeRestoreToken(overrides: Partial<RestoreTokenPayload> = {}): string {
  return encodeToken({
    type:          "refinement_restore",
    exp:           Math.floor(Date.now() / 1000) + 3600,
    userId:        USER_A,
    weekStartISO:  WEEK,
    dayISO:        DAY,
    slot:          SLOT,
    newMealId:     MEAL_REFINED.id,
    originalMeal:  MEAL_ORIGINAL as Record<string, unknown>,
    ...overrides,
  } as RestoreTokenPayload);
}

// ── Helper: build a minimal Express app with the refinement router ─────────────
// Auth is simulated by injecting authUser before the route handler runs.
// requireAuth is NOT mocked — authUserId() reads req.authUser directly.

async function buildApp(authUserId: string | null) {
  const app = express();
  app.use(express.json());
  // Inject authenticated user (bypasses requireAuth — authUserId() reads req.authUser)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (authUserId) (req as any).authUser = { id: authUserId };
    next();
  });
  const { default: router } = await import("../routes/refinement");
  app.use("/api/refinement", router);
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });
  return app;
}

// ── Helpers: configure the DB mock ───────────────────────────────────────────

function dbNotLocked() {
  mockDbSelect.mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    }),
  });
}

function dbDayLocked() {
  mockDbSelect.mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([{ dateISO: DAY }]),
      }),
    }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockGetWeekBoard.mockReset();
  mockUpsertWeekBoard.mockReset();
  mockConditionalUpdate.mockReset();
  mockResolveSlotContext.mockReset();
  mockEngineRefine.mockReset();
  mockRefineMeal.mockReset();
  mockDbSelect.mockReset();
  dbNotLocked(); // default: day not locked
});

// ── § 1: Preview — authentication ─────────────────────────────────────────────

describe("POST /api/refinement/preview — auth + lock", () => {
  it("401 when no auth user", async () => {
    const app = await buildApp(null);
    const res = await request(app)
      .post("/api/refinement/preview")
      .send({ slotContext: { weekStartISO: WEEK, dayISO: DAY, slot: SLOT, mealId: MEAL_ORIGINAL.id }, componentTarget: "starch", userInstruction: "lighter starch" });
    expect(res.status).toBe(401);
  });

  it("423 when the target day is locked", async () => {
    dbDayLocked();
    const app = await buildApp(USER_A);
    const res = await request(app)
      .post("/api/refinement/preview")
      .send({ slotContext: { weekStartISO: WEEK, dayISO: DAY, slot: SLOT, mealId: MEAL_ORIGINAL.id }, componentTarget: "starch", userInstruction: "lighter starch" });
    expect(res.status).toBe(423);
    expect(res.body.code).toBe("DAY_LOCKED");
  });
});

// ── § 2a: Confirm — locked-day enforcement (preview-then-lock-then-confirm) ───

describe("POST /api/refinement/confirm — locked-day enforcement", () => {
  it("423 when day was locked after the confirm token was minted", async () => {
    // Scenario: user minted a valid token while the day was unlocked, then
    // locked the day in another tab. Confirm must still be refused.
    dbDayLocked();
    const token = makeConfirmToken({ boardVersion: 1 });
    const app   = await buildApp(USER_A);
    const res   = await request(app).post("/api/refinement/confirm").send({ confirmToken: token });
    expect(res.status).toBe(423);
    expect(res.body.code).toBe("DAY_LOCKED");
    // Board must NOT have been touched
    expect(mockGetWeekBoard).not.toHaveBeenCalled();
    expect(mockConditionalUpdate).not.toHaveBeenCalled();
  });
});

// ── § 2: Confirm — ownership guard ────────────────────────────────────────────

describe("POST /api/refinement/confirm — ownership", () => {
  it("403 when token userId does not match authenticated user", async () => {
    // Token minted for USER_A, but request authenticated as USER_B
    const token = makeConfirmToken({ userId: USER_A });
    const app   = await buildApp(USER_B);
    const res   = await request(app).post("/api/refinement/confirm").send({ confirmToken: token });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/user/i);
  });
});

// ── § 3: Confirm — replay protection ─────────────────────────────────────────

describe("POST /api/refinement/confirm — replay (originalMealId missing)", () => {
  it("409 when the board no longer contains the original meal", async () => {
    // Board already has the refined meal in breakfast; original is gone
    mockGetWeekBoard.mockResolvedValue(makeBoard(2, [MEAL_REFINED]));
    const token = makeConfirmToken({ boardVersion: 1 });
    const app   = await buildApp(USER_A);
    const res   = await request(app).post("/api/refinement/confirm").send({ confirmToken: token });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already been applied/i);
  });
});

// ── § 4: Confirm — stale boardVersion CAS ────────────────────────────────────

describe("POST /api/refinement/confirm — stale CAS", () => {
  it("409 when board was concurrently edited between preview and confirm", async () => {
    // Board has original meal (not a replay), but CAS update misses (concurrent edit)
    mockGetWeekBoard.mockResolvedValue(makeBoard(3, [MEAL_ORIGINAL])); // version 3 now
    mockConditionalUpdate.mockResolvedValue({ updated: false }); // concurrent edit → CAS miss
    const token = makeConfirmToken({ boardVersion: 1 }); // token from preview at version 1
    const app   = await buildApp(USER_A);
    const res   = await request(app).post("/api/refinement/confirm").send({ confirmToken: token });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/updated between preview and confirm/i);
    // Verify conditionalUpdateWeekBoard was called with the token's boardVersion (1)
    expect(mockConditionalUpdate).toHaveBeenCalledWith(
      USER_A, WEEK, expect.any(Object), 1, ""
    );
  });
});

// ── § 5: Confirm — happy path ─────────────────────────────────────────────────

describe("POST /api/refinement/confirm — success", () => {
  it("200 with restoreToken and no unrelated slot mutation", async () => {
    const LUNCH_MEAL = { id: "lunch-meal", title: "Salad", macros: {}, ingredients: [] };
    const board = {
      ...makeBoard(1, [MEAL_ORIGINAL]),
      days: {
        [DAY]: {
          breakfast: [MEAL_ORIGINAL],
          lunch:     [LUNCH_MEAL],
          dinner:    [],
          snacks:    [],
        },
      },
    };
    mockGetWeekBoard.mockResolvedValue(board);
    mockConditionalUpdate.mockResolvedValue({ updated: true });

    const token = makeConfirmToken({ boardVersion: 1 });
    const app   = await buildApp(USER_A);
    const res   = await request(app).post("/api/refinement/confirm").send({ confirmToken: token });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.restoreToken).toBeDefined();
    expect(res.body.newMealId).toBe(MEAL_REFINED.id);

    // The board written to the DB should have lunch untouched
    const writtenBoard = mockConditionalUpdate.mock.calls[0][2];
    expect(writtenBoard.days[DAY].lunch[0].id).toBe(LUNCH_MEAL.id);
    expect(writtenBoard.days[DAY].breakfast[0].id).toBe(MEAL_REFINED.id);
  });
});

// ── § 5b: Restore — locked-day enforcement ────────────────────────────────────

describe("POST /api/refinement/restore — locked-day enforcement", () => {
  it("423 when day was locked after the restore token was minted", async () => {
    // Scenario: user minted a restore token before the day was locked.
    // The 60-min token should not be usable to revert a locked board.
    dbDayLocked();
    const token = makeRestoreToken();
    const app   = await buildApp(USER_A);
    const res   = await request(app).post("/api/refinement/restore").send({ restoreToken: token });
    expect(res.status).toBe(423);
    expect(res.body.code).toBe("DAY_LOCKED");
    // Board must NOT have been touched
    expect(mockGetWeekBoard).not.toHaveBeenCalled();
    expect(mockConditionalUpdate).not.toHaveBeenCalled();
  });
});

// ── § 6: Restore — ownership guard ───────────────────────────────────────────

describe("POST /api/refinement/restore — ownership", () => {
  it("403 when token userId does not match authenticated user", async () => {
    const token = makeRestoreToken({ userId: USER_A });
    const app   = await buildApp(USER_B);
    const res   = await request(app).post("/api/refinement/restore").send({ restoreToken: token });
    expect(res.status).toBe(403);
  });
});

// ── § 7: Restore — replay protection ─────────────────────────────────────────

describe("POST /api/refinement/restore — replay (refined meal already gone)", () => {
  it("409 when the board no longer contains the refined meal", async () => {
    // Board already has the original meal back; refined meal is gone
    mockGetWeekBoard.mockResolvedValue(makeBoard(3, [MEAL_ORIGINAL]));
    const token = makeRestoreToken();
    const app   = await buildApp(USER_A);
    const res   = await request(app).post("/api/refinement/restore").send({ restoreToken: token });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no longer in the board/i);
  });
});

// ── § 8: Restore — stale boardVersion CAS ────────────────────────────────────

describe("POST /api/refinement/restore — concurrent board edit", () => {
  it("409 when board was concurrently edited between confirm and restore", async () => {
    // Board has refined meal (restore precondition), but CAS update misses
    mockGetWeekBoard.mockResolvedValue(makeBoard(5, [MEAL_REFINED]));
    mockConditionalUpdate.mockResolvedValue({ updated: false });
    const token = makeRestoreToken();
    const app   = await buildApp(USER_A);
    const res   = await request(app).post("/api/refinement/restore").send({ restoreToken: token });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/concurrently/i);
    // Verify the CAS was attempted with the current board version (5)
    expect(mockConditionalUpdate).toHaveBeenCalledWith(
      USER_A, WEEK, expect.any(Object), 5, ""
    );
  });
});

// ── § 9: Restore — happy path ─────────────────────────────────────────────────

describe("POST /api/refinement/restore — success", () => {
  it("200 with restoredMealId and unrelated slots preserved", async () => {
    const DINNER_MEAL = { id: "dinner-meal", title: "Stew", macros: {}, ingredients: [] };
    const board = {
      ...makeBoard(2, [MEAL_REFINED]),
      days: {
        [DAY]: {
          breakfast: [MEAL_REFINED],
          lunch:     [],
          dinner:    [DINNER_MEAL],
          snacks:    [],
        },
      },
      version: 2,
    };
    mockGetWeekBoard.mockResolvedValue(board);
    mockConditionalUpdate.mockResolvedValue({ updated: true });

    const token = makeRestoreToken();
    const app   = await buildApp(USER_A);
    const res   = await request(app).post("/api/refinement/restore").send({ restoreToken: token });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // CAS called with the loaded board version (2)
    expect(mockConditionalUpdate).toHaveBeenCalledWith(
      USER_A, WEEK, expect.any(Object), 2, ""
    );
    // Written board: breakfast restored, dinner untouched
    const writtenBoard = mockConditionalUpdate.mock.calls[0][2];
    expect(writtenBoard.days[DAY].breakfast[0].id).toBe(MEAL_ORIGINAL.id);
    expect(writtenBoard.days[DAY].dinner[0].id).toBe(DINNER_MEAL.id);
  });
});

// ── § 10: freeform-preview — error translation ────────────────────────────────
//
// These tests exercise the error-classification logic added to the
// POST /api/refinement/freeform-preview catch block.  Each clinical violation
// must produce the correct HTTP status, `code`, and a patient-readable `error`
// message — not the raw engine string.

const EXISTING_MEAL = { title: "Test Meal", macros: { calories: 400, protein: 30, carbs: 40, fat: 18 }, ingredients: [] };

describe("POST /api/refinement/freeform-preview — GLP-1 fat limit violation", () => {
  it("422 with code GLP1_FAT_LIMIT and friendly message when engine throws GLP-1 fat-limit PROTOCOL_VIOLATION", async () => {
    mockRefineMeal.mockRejectedValue(
      new Error('PROTOCOL_VIOLATION: Could not apply "add butter" within your GLP-1 fat limit (15g). Try a lighter modification.')
    );
    const app = await buildApp(USER_A);
    const res = await request(app)
      .post("/api/refinement/freeform-preview")
      .send({ existingMeal: EXISTING_MEAL, changeInstruction: "add butter" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("GLP1_FAT_LIMIT");
    expect(res.body.error).toMatch(/GLP-1 fat limit/i);
    expect(res.body.error).toMatch(/lower-fat/i);
    // Must NOT expose internal PROTOCOL_VIOLATION prefix to the patient
    expect(res.body.error).not.toMatch(/^PROTOCOL_VIOLATION/);
  });
});

describe("POST /api/refinement/freeform-preview — diabetic starch limit violation", () => {
  it("422 with code DIABETIC_STARCH_LIMIT and starch-specific message when engine throws diabetic starch PROTOCOL_VIOLATION", async () => {
    mockRefineMeal.mockRejectedValue(
      new Error('PROTOCOL_VIOLATION: Could not apply "add rice" within your diabetic starch limit. Try requesting a lower-carb modification.')
    );
    const app = await buildApp(USER_A);
    const res = await request(app)
      .post("/api/refinement/freeform-preview")
      .send({ existingMeal: EXISTING_MEAL, changeInstruction: "add rice" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("DIABETIC_STARCH_LIMIT");
    expect(res.body.error).toMatch(/diabetic carb limit/i);
    // Must NOT claim this is a GLP-1 fat limit — different clinical condition
    expect(res.body.error).not.toMatch(/GLP-1/i);
    expect(res.body.error).not.toMatch(/^PROTOCOL_VIOLATION/);
  });
});

describe("POST /api/refinement/freeform-preview — generic protocol violation", () => {
  it("422 with code PROTOCOL_VIOLATION and generic message for other PROTOCOL_VIOLATION errors", async () => {
    mockRefineMeal.mockRejectedValue(
      new Error("PROTOCOL_VIOLATION: Some other constraint was violated.")
    );
    const app = await buildApp(USER_A);
    const res = await request(app)
      .post("/api/refinement/freeform-preview")
      .send({ existingMeal: EXISTING_MEAL, changeInstruction: "some change" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("PROTOCOL_VIOLATION");
    // Must NOT claim GLP-1 or diabetic starch specifically
    expect(res.body.error).not.toMatch(/GLP-1/i);
    expect(res.body.error).not.toMatch(/diabetic/i);
    expect(res.body.error).not.toMatch(/^PROTOCOL_VIOLATION/);
  });
});

describe("POST /api/refinement/freeform-preview — retryable failure", () => {
  it("503 with code REFINEMENT_UNAVAILABLE and retry message when engine throws MealRefinementRetryableError", async () => {
    const { MealRefinementRetryableError } = await import("../services/mealRefinementEngine");
    mockRefineMeal.mockRejectedValue(
      new MealRefinementRetryableError("Clinical guidance temporarily unavailable. Please try again.")
    );
    const app = await buildApp(USER_A);
    const res = await request(app)
      .post("/api/refinement/freeform-preview")
      .send({ existingMeal: EXISTING_MEAL, changeInstruction: "lighter sauce" });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("REFINEMENT_UNAVAILABLE");
    expect(res.body.retryable).toBe(true);
    expect(res.body.error).toMatch(/try again/i);
  });
});

describe("POST /api/refinement/freeform-preview — success", () => {
  it("200 with updatedMeal when refineMeal resolves", async () => {
    const updatedMeal = { title: "Lighter Meal", macros: { calories: 350, protein: 30, carbs: 38, fat: 10 }, ingredients: [] };
    mockRefineMeal.mockResolvedValue({ updatedMeal, changesSummary: "Reduced fat content", protocolNote: null });
    const app = await buildApp(USER_A);
    const res = await request(app)
      .post("/api/refinement/freeform-preview")
      .send({ existingMeal: EXISTING_MEAL, changeInstruction: "reduce fat" });

    expect(res.status).toBe(200);
    expect(res.body.updatedMeal).toMatchObject({ title: "Lighter Meal" });
    expect(res.body.changesSummary).toBe("Reduced fat content");
  });
});

describe("POST /api/refinement/freeform-preview — auth", () => {
  it("401 when no auth user", async () => {
    const app = await buildApp(null);
    const res = await request(app)
      .post("/api/refinement/freeform-preview")
      .send({ existingMeal: EXISTING_MEAL, changeInstruction: "lighter" });
    expect(res.status).toBe(401);
    expect(mockRefineMeal).not.toHaveBeenCalled();
  });
});
