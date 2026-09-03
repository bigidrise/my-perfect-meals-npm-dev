import express from "express";
import request from "supertest";

const mockState = {
  savedRows: [] as Array<Record<string, any>>,
  listRows: [] as Array<Record<string, any>>,
  insertedSavedRows: [] as Array<Record<string, any>>,
  insertedListRows: [] as Array<Record<string, any>>,
  transactionCalls: 0,
  failListInsertAt: null as number | null,
  blockedIds: new Set<string>(),
};

function asyncRows(rows: Array<Record<string, any>>) {
  const result: any = Promise.resolve(rows);
  result.limit = async (limit: number) => rows.slice(0, limit);
  result.orderBy = async () => rows;
  return result;
}

jest.mock("../services/savedGroceryRevalidation", () => ({
  revalidateSavedGroceriesForUser: async (
    _userId: string,
    items: Array<Record<string, any>>,
  ) => items.map((item) => mockState.blockedIds.has(item.id)
    ? { id: item.id, status: "blocked", reason: "Conflicts with current profile" }
    : { id: item.id, status: "approved", reason: null }),
}));

jest.mock("../db", () => {
  const schema = jest.requireActual("../../shared/schema");

  function createExecutor() {
    return {
      execute: jest.fn(async () => []),
      select: jest.fn(() => ({
        from: (table: unknown) => ({
          where: () => asyncRows(
            table === schema.userSavedGroceryItems
              ? mockState.savedRows
              : mockState.listRows,
          ),
        }),
      })),
      insert: jest.fn((table: unknown) => ({
        values: (value: Record<string, any>) => {
          const insertAndReturn = async () => {
            if (table === schema.userSavedGroceryItems) {
              const row = { id: `saved-${mockState.savedRows.length + 1}`, ...value };
              mockState.savedRows.push(row);
              mockState.insertedSavedRows.push(row);
              return [row];
            }

            const insertNumber = mockState.insertedListRows.length + 1;
            if (mockState.failListInsertAt === insertNumber) {
              throw new Error("simulated insert failure");
            }
            const row = { id: `list-${mockState.listRows.length + 1}`, ...value };
            mockState.listRows.push(row);
            mockState.insertedListRows.push(row);
            return [row];
          };
          return {
            returning: insertAndReturn,
            onConflictDoNothing: () => ({
              returning: async () => {
                if (
                  table === schema.userSavedGroceryItems &&
                  mockState.savedRows.some(
                    (row) =>
                      row.userId === value.userId &&
                      row.productKey === value.productKey,
                  )
                ) {
                  return [];
                }
                return insertAndReturn();
              },
            }),
          };
        },
      })),
      update: jest.fn(() => ({
        set: (values: Record<string, any>) => ({
          where: async () => {
            if (mockState.listRows[0]) Object.assign(mockState.listRows[0], values);
            return [];
          },
        }),
      })),
    };
  }

  const executor = createExecutor();
  return {
    db: {
      ...executor,
      transaction: jest.fn(async (callback: (tx: ReturnType<typeof createExecutor>) => unknown) => {
        mockState.transactionCalls++;
        const listSnapshot = mockState.listRows.map((row) => ({ ...row }));
        const insertedSnapshot = [...mockState.insertedListRows];
        try {
          return await callback(executor);
        } catch (error) {
          mockState.listRows = listSnapshot;
          mockState.insertedListRows = insertedSnapshot;
          throw error;
        }
      }),
    },
  };
});

import savedGroceriesRouter from "../routes/savedGroceries";

const USER_ID = "saved-grocery-user";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).authUser = { id: USER_ID };
    next();
  });
  app.use("/api/saved-groceries", savedGroceriesRouter);
  return app;
}

function savedItem(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? `saved-${mockState.savedRows.length + 1}`,
    userId: USER_ID,
    productName: "Chickpea Pasta",
    brand: "Banza",
    barcode: null,
    productKey: "name::banza::chickpeapasta",
    category: "Grains & Packaged",
    source: "scanner",
    nutritionJson: { carbs: 32, fat: 3 },
    productMeta: { ingredients: ["chickpeas", "pea protein"] },
    imageUrl: null,
    savedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  mockState.savedRows = [];
  mockState.listRows = [];
  mockState.insertedSavedRows = [];
  mockState.insertedListRows = [];
  mockState.transactionCalls = 0;
  mockState.failListInsertAt = null;
  mockState.blockedIds = new Set();
});

describe("Saved Groceries routes", () => {
  test("Product Scan and Grocery Coach save through the same permanent table", async () => {
    const app = buildApp();

    const scanner = await request(app).post("/api/saved-groceries").send({
      productName: "Chickpea Pasta",
      brand: "Banza",
      source: "scanner",
    });
    // The lightweight fluent mock does not parse Drizzle predicates. Clear its
    // query fixture so the second distinct product exercises the insert path.
    mockState.savedRows = [];
    const coach = await request(app).post("/api/saved-groceries").send({
      productName: "Marinara Sauce",
      brand: "Rao's",
      source: "grocery-coach",
    });

    expect(scanner.status).toBe(201);
    expect(coach.status).toBe(201);
    expect(mockState.insertedSavedRows.map((row) => row.source)).toEqual([
      "scanner",
      "grocery-coach",
    ]);
  });

  test("single Add uses product identity instead of display-name equality", async () => {
    const app = buildApp();
    mockState.savedRows = [savedItem()];
    mockState.listRows = [{
      id: "list-existing",
      userId: USER_ID,
      name: "A deliberately different display name",
      productKey: "name::banza::chickpeapasta",
      checked: false,
    }];

    const response = await request(app)
      .post("/api/saved-groceries/saved-1/add-to-list")
      .send();

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("already_on_list");
    expect(mockState.insertedListRows).toHaveLength(0);
  });

  test("parallel identical saves both succeed and persist one row", async () => {
    const app = buildApp();
    const payload = {
      productName: "Double Tap Pasta",
      brand: "Concurrent Foods",
      source: "scanner",
    };

    const responses = await Promise.all([
      request(app).post("/api/saved-groceries").send(payload),
      request(app).post("/api/saved-groceries").send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(responses.map((response) => response.body.created).sort()).toEqual([false, true]);
    expect(mockState.savedRows).toHaveLength(1);
    expect(mockState.insertedSavedRows).toHaveLength(1);
  });

  test("bulk Add is atomic when a database write fails", async () => {
    const app = buildApp();
    mockState.savedRows = [
      savedItem({ id: "saved-1" }),
      savedItem({
        id: "saved-2",
        productName: "Lentil Pasta",
        brand: "Tolerant",
        productKey: "name::tolerant::lentilpasta",
      }),
    ];
    mockState.failListInsertAt = 2;

    const response = await request(app)
      .post("/api/saved-groceries/add-to-list")
      .send({ ids: ["saved-1", "saved-2"] });

    expect(response.status).toBe(500);
    expect(response.body.atomic).toBe(true);
    expect(mockState.transactionCalls).toBe(1);
    expect(mockState.listRows).toEqual([]);
    expect(mockState.insertedListRows).toEqual([]);
  });

  test("blocked items remain saved and are reported without insertion", async () => {
    const app = buildApp();
    mockState.savedRows = [
      savedItem({ id: "saved-approved" }),
      savedItem({
        id: "saved-blocked",
        productName: "Egg Noodles",
        productKey: "name::::eggnoodles",
      }),
    ];
    mockState.blockedIds.add("saved-blocked");

    const response = await request(app)
      .post("/api/saved-groceries/add-to-list")
      .send({ ids: ["saved-approved", "saved-blocked"] });

    expect(response.status).toBe(200);
    expect(response.body.addedCount).toBe(1);
    expect(response.body.blockedCount).toBe(1);
    expect(response.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "saved-blocked",
        status: "blocked",
        reason: "Conflicts with current profile",
      }),
    ]));
    expect(mockState.savedRows).toHaveLength(2);
    expect(mockState.insertedListRows).toHaveLength(1);
  });
});