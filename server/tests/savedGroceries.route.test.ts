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
  revalidationCalls: 0,
  revalidationFails: false,
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
  ) => {
    mockState.revalidationCalls++;
    if (mockState.revalidationFails) throw new Error("synthetic profile outage");
    return items.map((item) => mockState.blockedIds.has(item.id)
    ? { id: item.id, status: "blocked", reason: "Conflicts with current profile" }
    : { id: item.id, status: "approved", reason: null });
  },
}));

jest.mock("../db", () => {
  const schema = jest.requireActual("../../shared/schema");
  const { PgDialect } = jest.requireActual("drizzle-orm/pg-core");

  function createExecutor() {
    return {
      execute: jest.fn(async () => []),
      select: jest.fn(() => ({
        from: (table: unknown) => ({
          where: (condition: any) => {
            const { sql, params }: { sql: string; params: unknown[] } = new PgDialect().sqlToQuery(condition);
            let rows = table === schema.userSavedGroceryItems
              ? mockState.savedRows
              : mockState.listRows;
            // Honor actual bound owner/identity predicates instead of returning
            // another account's fixtures and accidentally masking authorization.
            for (const [column, field] of [["user_id", "userId"], ["id", "id"], ["product_key", "productKey"]]) {
              const match = sql.match(new RegExp(String.raw`"${column}"\s*=\s*\$(\d+)`));
              if (match) rows = rows.filter(row => row[field] === params[Number(match[1]) - 1]);
            }
            const ids = sql.match(/"id"\s+in\s*\(([^)]+)\)/i);
            if (ids) {
              const values = Array.from(ids[1].matchAll(/\$(\d+)/g), match => params[Number(match[1]) - 1]);
              rows = rows.filter(row => values.includes(row.id));
            }
            return asyncRows(rows);
          },
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

function buildApp(userId: string | null = USER_ID) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (userId) (req as any).authUser = { id: userId };
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
  mockState.revalidationCalls = 0;
  mockState.revalidationFails = false;
});

describe("Saved Groceries routes", () => {
  test("Development list insertion retains saved product evidence and restoration does not erase it", async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const app = buildApp();
      mockState.savedRows = [savedItem({ id: "saved-development" })];
      await request(app).post("/api/saved-groceries/saved-development/add-to-list").send().expect(200);
      expect(mockState.insertedListRows).toHaveLength(1);
      const row = mockState.insertedListRows[0];
      const metadata = structuredClone(row.ingredientMetadata);
      expect(metadata.selectedProduct).toMatchObject({
        productKey: "name::banza::chickpeapasta",
        brand: "Banza",
        assessment: { status: "review_required" },
      });
      expect(JSON.parse(metadata.selectedProduct.sourcePayloadJson)).toEqual({
        productMeta: { ingredients: ["chickpeas", "pea protein"] },
        nutrition: { carbs: 32, fat: 3 },
      });
      row.checked = true;
      await request(app).post("/api/saved-groceries/saved-development/add-to-list").send().expect(200);
      expect(mockState.insertedListRows).toHaveLength(1);
      expect(row.checked).toBe(false);
      expect(row.ingredientMetadata).toEqual(metadata);
    } finally {
      process.env.NODE_ENV = previousEnvironment;
    }
  });

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

describe("Development saved-product shopping intent", () => {
  let previousEnvironment: string | undefined;
  beforeEach(() => {
    previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
  });
  afterEach(() => {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  });

  test("three saved cheeses transfer despite unavailable ingredient evidence without claiming approval", async () => {
    const names = ["Pecorino Romano Cheese", "Asiago Cheese", "Grana Padano Cheese"];
    mockState.savedRows = names.map((productName, index) => savedItem({
      id: `cheese-${index}`, productName, brand: "Fixture Brand",
      productKey: `fixture::cheese-${index}`, productMeta: { evidenceStatus: "unverified", packageSize: "200 g" },
      nutritionJson: null,
    }));
    mockState.savedRows.forEach(row => mockState.blockedIds.add(row.id));
    const response = await request(buildApp()).post("/api/saved-groceries/add-to-list")
      .send({ ids: mockState.savedRows.map(row => row.id) });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ addedCount: 3, blockedCount: 0 });
    expect(mockState.revalidationCalls).toBe(0);
    expect(mockState.savedRows).toHaveLength(3);
    expect(mockState.insertedListRows.map(row => row.name)).toEqual(names.map(name => `Fixture Brand ${name}`));
    for (const row of mockState.insertedListRows) {
      const product = row.ingredientMetadata.selectedProduct;
      expect(product.assessment.status).toBe("review_required");
      expect(product.evidence).toEqual([]);
      expect(JSON.parse(product.sourcePayloadJson).productMeta.packageSize).toBe("200 g");
      expect(mockState.savedRows.some(saved => saved.id === product.source.sourceRecordId &&
        saved.productKey === row.productKey)).toBe(true);
    }
  });

  test("single transfer records shopping intent even for a known conflict or unavailable resolver", async () => {
    mockState.savedRows = [savedItem({ id: "conflicting" })];
    mockState.blockedIds.add("conflicting");
    mockState.revalidationFails = true;
    const response = await request(buildApp()).post("/api/saved-groceries/conflicting/add-to-list").send();
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("added");
    expect(mockState.revalidationCalls).toBe(0);
    expect(mockState.insertedListRows[0].ingredientMetadata.selectedProduct.assessment.status).toBe("review_required");
  });

  test("only requested products transfer; repeated additions deduplicate and checked rows restore", async () => {
    mockState.savedRows = [
      savedItem({ id: "chosen" }),
      savedItem({ id: "not-chosen", productName: "Other Pasta", productKey: "fixture::other" }),
    ];
    const app = buildApp();
    const add = () => request(app).post("/api/saved-groceries/add-to-list").send({ ids: ["chosen", "chosen"] });
    expect((await add()).body.addedCount).toBe(1);
    expect((await add()).body.alreadyOnListCount).toBe(1);
    const originalMetadata = structuredClone(mockState.listRows[0].ingredientMetadata);
    mockState.listRows[0].checked = true;
    expect((await add()).body.restoredCount).toBe(1);
    expect(mockState.insertedListRows).toHaveLength(1);
    expect(mockState.listRows[0].checked).toBe(false);
    expect(mockState.listRows[0].ingredientMetadata).toEqual(originalMetadata);
    expect(mockState.savedRows).toHaveLength(2);
  });

  test("unauthenticated, foreign-account, and mixed-owner requests cannot transfer products", async () => {
    mockState.savedRows = [
      savedItem({ id: "mine" }),
      savedItem({ id: "foreign", userId: "different-synthetic-owner", productKey: "fixture::foreign" }),
    ];
    await request(buildApp(null)).post("/api/saved-groceries/add-to-list").send({ ids: ["mine"] }).expect(401);
    await request(buildApp(null)).post("/api/saved-groceries/mine/add-to-list").send().expect(401);
    const app = buildApp();
    await request(app).post("/api/saved-groceries/foreign/add-to-list").send().expect(404);
    await request(app).post("/api/saved-groceries/add-to-list").send({ ids: ["mine", "foreign"] }).expect(404);
    await request(app).post("/api/saved-groceries/add-to-list").send({ ids: ["missing"] }).expect(404);
    expect(mockState.insertedListRows).toEqual([]);
    expect(mockState.transactionCalls).toBe(0);
    expect(mockState.revalidationCalls).toBe(0);
  });

  test("invalid bulk IDs are rejected before writes", async () => {
    const app = buildApp();
    for (const ids of [[], [""], [123], Array.from({ length: 501 }, () => "id")]) {
      await request(app).post("/api/saved-groceries/add-to-list").send({ ids }).expect(400);
    }
    expect(mockState.transactionCalls).toBe(0);
  });

  test("Development bulk transfer still rolls back every write on failure", async () => {
    mockState.savedRows = [
      savedItem({ id: "one" }),
      savedItem({ id: "two", productName: "Other Pasta", productKey: "fixture::other" }),
    ];
    mockState.failListInsertAt = 2;
    await request(buildApp()).post("/api/saved-groceries/add-to-list").send({ ids: ["one", "two"] }).expect(500);
    expect(mockState.listRows).toEqual([]);
    expect(mockState.insertedListRows).toEqual([]);
  });

  test.each(["production", "test"])("%s retains compatibility enforcement for both endpoints", async environment => {
    process.env.NODE_ENV = environment;
    mockState.savedRows = [savedItem({ id: "blocked" })];
    mockState.blockedIds.add("blocked");
    const app = buildApp();
    const bulk = await request(app).post("/api/saved-groceries/add-to-list")
      .send({ ids: ["blocked"], shoppingIntentOnly: true });
    expect(bulk.body).toMatchObject({ addedCount: 0, blockedCount: 1 });
    const single = await request(app).post("/api/saved-groceries/blocked/add-to-list")
      .send({ shoppingIntentOnly: true });
    expect(single.body.status).toBe("blocked");
    expect(mockState.revalidationCalls).toBe(2);
    expect(mockState.insertedListRows).toEqual([]);
  });

  test("Production remains fail-closed during profile outages", async () => {
    process.env.NODE_ENV = "production";
    mockState.savedRows = [savedItem({ id: "outage" })];
    mockState.revalidationFails = true;
    const app = buildApp();
    await request(app).post("/api/saved-groceries/add-to-list").send({ ids: ["outage"] }).expect(500);
    await request(app).post("/api/saved-groceries/outage/add-to-list").send().expect(500);
    expect(mockState.revalidationCalls).toBe(2);
    expect(mockState.insertedListRows).toEqual([]);
  });

  test("reading the library still uses its existing compatibility contract", async () => {
    mockState.savedRows = [savedItem({ id: "historical" })];
    mockState.blockedIds.add("historical");
    const response = await request(buildApp()).get("/api/saved-groceries");
    expect(response.status).toBe(200);
    expect(response.body.items[0].compliance.status).toBe("blocked");
    expect(mockState.revalidationCalls).toBe(1);
    expect(mockState.insertedListRows).toEqual([]);
  });
});