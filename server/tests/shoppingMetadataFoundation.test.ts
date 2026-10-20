import { readFileSync } from "node:fs";
import express from "express";
import request from "supertest";
import ts from "typescript";
import {
  makeIngredientMetadata, parseIngredientMetadata, shoppingIdentityKey, mergeIngredientMetadata,
} from "../../shared/shoppingIngredientMetadata";
import { shoppingListItems, shoppingListSources } from "../../shared/schema";
import {
  developmentShoppingPost, developmentItemPatch, developmentMealCommit,
  developmentSavedProductFields,
  developmentPlanMeals, developmentMealIngredients,
} from "../services/shopping-list/metadataPersistence";

jest.mock("drizzle-orm", () => ({
  ...jest.requireActual("drizzle-orm"),
  eq: (column: any, value: any) => ({ column: column.name, value }),
  and: (...parts: any[]) => ({ parts }),
}));
jest.mock("../db", () => ({ db: mockDatabase }));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.authUser = { id: req.headers["x-fixture-account"] || "synthetic-a" }; next(); },
}));
jest.mock("../utils/getAuthUserId", () => ({ getAuthUserId: (req: any) => req.authUser?.id }));
jest.mock("../utils/languageInstruction", () => ({ getLanguageInstruction: () => "" }));

const state = { rows: [] as any[], sources: [] as any[], writes: [] as any[] };
function matches(row: any, condition: any): boolean {
  if (condition.parts) return condition.parts.every((p: any) => matches(row, p));
  const key = condition.column.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
  return row[key] === condition.value;
}
const ops = {
  eq: (column: any, value: any) => ({ column: column.name, value }),
  and: (...parts: any[]) => ({ parts }),
};
const mockDatabase: any = {
  transaction: async (run: any) => {
    const before = structuredClone(state);
    try { return await run(mockDatabase); }
    catch (e) { Object.assign(state, before); throw e; }
  },
  insert: (table: any) => ({ values: (value: any) => {
    const rows = (Array.isArray(value) ? value : [value]).map((v: any) => ({ id: `synthetic-${state.rows.length + state.sources.length + Math.random()}`, ...v }));
    state.writes.push({ action: "insert", rows: structuredClone(rows) });
    (table === shoppingListSources ? state.sources : state.rows).push(...rows);
    return { returning: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
  } }),
  select: () => ({ from: () => ({ where: (condition: any) => {
    const rows = state.rows.filter(r => matches(r, condition));
    return Object.assign(Promise.resolve(rows), { orderBy: async () => rows });
  } }) }),
  update: () => ({ set: (updates: any) => ({ where: (condition: any) => {
    const rows = state.rows.filter(r => matches(r, condition));
    rows.forEach(r => Object.assign(r, updates));
    state.writes.push({ action: "update", ids: rows.map(r => r.id), updates });
    return Object.assign(Promise.resolve(rows), { returning: async () => rows });
  } }) }),
  delete: () => ({ where: async (condition: any) => {
    state.writes.push({ action: "delete" });
    state.rows = state.rows.filter(r => !matches(r, condition));
  } }),
  query: {
    shoppingListItems: {
      findMany: async (config: any) => state.rows.filter(r => matches(r, config.where(shoppingListItems, ops))),
      findFirst: async (config: any) => state.rows.find(r => matches(r, config.where(shoppingListItems, ops))),
    },
    shoppingListSources: {
      findMany: async (config: any) => state.sources.filter(r => matches(r, config.where(shoppingListSources, ops))),
    },
  },
};
const classic = require("../routes/shoppingList").default;
const v2 = require("../routes/shoppingListV2").shoppingRouter;
const auth = require("../middleware/requireAuth").requireAuth;

function app(order: "classic-first" | "enhanced-first" = "classic-first") {
  const a = express();
  a.use(express.json());
  const enhanced = (req: any, res: any) => developmentShoppingPost(req, res, mockDatabase, req.authUser.id);
  if (order === "enhanced-first") a.post("/api/shopping-list", auth, enhanced);
  a.use("/api", classic);
  if (order === "classic-first") a.post("/api/shopping-list", auth, enhanced);
  a.use("/api/shopping-list-v2", v2);
  return a;
}
const originalEnvironment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; state.rows = []; state.sources = []; state.writes = []; });
afterAll(() => { process.env.NODE_ENV = originalEnvironment; });

describe("Versioned shopping metadata", () => {
  test.each(["low-sodium soy sauce", "reduced-sugar jam", "gluten-free bread", "vegan cream cheese"])("preserves %s independently of matching normalization", name => {
    const m = makeIngredientMetadata({ name, quantity: "1/2", unit: "cup", recipeName: "Synthetic recipe" });
    expect(m.ingredient.originalName).toBe(name);
    expect(m.ingredient.requirements[0].origin).toBe("explicit_ingredient");
    expect(m.contributions[0].quantity).toBe("1/2");
    expect(parseIngredientMetadata({ ...m, ingredient: { ...m.ingredient, matchingName: "soy sauce", requirements: [] } })?.ingredient.requirements.length).toBeGreaterThan(0);
  });
  test("profile guidance is separate from explicit requirements", () => {
    const m = makeIngredientMetadata({ name: "low sodium broth" });
    m.ingredient.requirements.push({ value: "review sodium", origin: "profile_guidance", authorityReference: "synthetic-policy" });
    expect(parseIngredientMetadata(m)?.ingredient.requirements.map(r => r.origin)).toEqual(["explicit_ingredient", "profile_guidance"]);
  });
  test("rejects malformed versions, products, and duplicated contribution ids", () => {
    const m = makeIngredientMetadata({ name: "Bread" });
    expect(() => parseIngredientMetadata({ ...m, version: 2 })).toThrow();
    expect(() => parseIngredientMetadata({ ...m, selectedProduct: { brand: "Not an exact identity" } })).toThrow();
    expect(() => parseIngredientMetadata({ ...m, contributions: [m.contributions[0], m.contributions[0]] })).toThrow();
  });
  test("retains compatible contributions, rejecting incompatible qualifiers and selections", () => {
    const a = makeIngredientMetadata({ name: "gluten-free bread", quantity: 2, recipeId: "r1" });
    const b = makeIngredientMetadata({ name: "gluten free bread", quantity: 3, recipeId: "r2" });
    expect(mergeIngredientMetadata(a, b)?.contributions).toHaveLength(2);
    expect(() => mergeIngredientMetadata(a, makeIngredientMetadata({ name: "bread" }))).toThrow();
    const selected = developmentSavedProductFields({ id: "s1", productKey: "upc::12345678", productName: "Bread", brand: "Example", barcode: "12345678" }).ingredientMetadata!;
    expect(shoppingIdentityKey({ name: "Bread", ingredientMetadata: selected })).not.toBe(shoppingIdentityKey({ name: "Bread", ingredientMetadata: { ...selected, selectedProduct: { ...selected.selectedProduct!, variant: "different" } } }));
  });
  test("stored retail amounts and evidence never replace recipe quantities", () => {
    const m = developmentSavedProductFields({ id: "s1", productKey: "p1", productName: "Milk", brand: "Example", barcode: null, productMeta: { ingredients: ["milk"], review: "historical" } }).ingredientMetadata!;
    m.contributions[0].quantity = "1/4"; m.contributions[0].unit = "cup";
    m.selectedProduct!.retailQuantity = 2;
    const restored = parseIngredientMetadata(JSON.parse(JSON.stringify(m)))!;
    expect(restored.contributions[0].quantity).toBe("1/4");
    expect(restored.selectedProduct?.retailQuantity).toBe(2);
    expect(restored.selectedProduct?.assessment.status).toBe("review_required");
    expect(restored.selectedProduct?.sourcePayloadJson).toContain("historical");
  });
  test("nested plan transfers preserve names, original strings and fractional amounts", () => {
    const meals = developmentPlanMeals({ days: [{ meals: [{
      id: "recipe-a", name: "Synthetic recipe", ingredients: ["1/2 cup low-sodium soy sauce", "vegan cheese"],
    }] }] });
    const [sauce, cheese] = developmentMealIngredients(meals);
    expect(sauce).toMatchObject({ name: "low-sodium soy sauce", quantity: .5, unit: "cup" });
    expect(sauce.ingredientMetadata.contributions[0].originalText).toBe("1/2 cup low-sodium soy sauce");
    expect(cheese.name).toBe("vegan cheese");
  });
});

describe("Development routes use synthetic database only", () => {
  test.each(["classic-first", "enhanced-first"] as const)("duplicate POST order %s saves exactly once and hydrates metadata", async order => {
    const a = app(order);
    const m = makeIngredientMetadata({ name: "low-sodium soy sauce", quantity: "1/2", unit: "tbsp" });
    const response = await request(a).post("/api/shopping-list").send({ userId: "someone-else", items: [{ name: "low-sodium soy sauce", quantity: .5, unit: "tbsp", ingredientMetadata: m }] });
    expect(response.status).toBe(201);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].userId).toBe("synthetic-a");
    const get = await request(a).get("/api/shopping-list-v2/");
    expect(get.body.items[0].ingredientMetadata).toEqual(m);
    const updated = await request(a).patch(`/api/shopping-list-v2/${state.rows[0].id}`).send({ quantity: "2", ingredientMetadata: m });
    expect(updated.status).toBe(200);
    expect(state.rows[0].ingredientMetadata.contributions[0].quantity).toBe("1/2");
    const classicGet = await request(a).get("/api/shopping-list");
    expect(classicGet.body.aggregated[0].ingredientMetadata).toEqual(m);
  });
  test("the actual enhanced registration delegates to the same Development handler", () => {
    const source = readFileSync("server/routes.ts", "utf8");
    expect(source.slice(source.indexOf('app.post("/api/shopping-list"'), source.indexOf("// Holiday Feast Routes")))
      .toContain("return await developmentShoppingPost(req, res, db, userId)");
  });
  test("validates before replace_scope and never accepts ownership updates", async () => {
    state.rows = [{ id: "protected", userId: "synthetic-b", name: "Existing item" }];
    const a = app();
    const bad = await request(a).post("/api/shopping-list").send({ strategy: "replace_scope", items: [{ name: "Bread", ingredientMetadata: { version: 999 } }] });
    expect(bad.status).toBe(400);
    expect(state.writes).toHaveLength(0);
    const wrongAccount = await request(a).patch("/api/shopping-list-v2/protected").send({ checked: true });
    expect(wrongAccount.status).toBe(404);
    expect(state.writes).toHaveLength(0);
    expect(() => developmentItemPatch({ userId: "synthetic-b" }, {})).toThrow();
  });
  test("classic metadata updates and V2 commits preserve contributions and isolate accounts", async () => {
    const a = app();
    await request(a).post("/api/shopping-list-v2/commit").send({ meals: [
      { mealId: "m1", name: "Meal one", ingredients: [{ name: "gluten-free bread", quantity: 1, unit: "slice" }] },
      { mealId: "m2", name: "Meal two", ingredients: [{ name: "gluten-free bread", quantity: 2, unit: "slice" }] },
    ] }).expect(200);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].ingredientMetadata.contributions).toHaveLength(2);
    await request(a).patch(`/api/shopping-list/${state.rows[0].id}`).send({ checked: true }).expect(200);
    expect(state.rows[0].checked).toBe(true);
    const other = await request(a).get("/api/shopping-list-v2/").set("x-fixture-account", "synthetic-b").expect(200);
    expect(other.body.items).toEqual([]);
  });
  test("old Production replace_scope drops metadata, without breaking nullable-column inserts", async () => {
    const m = makeIngredientMetadata({ name: "Bread" });
    state.rows = [{ id: "old", userId: "synthetic-a", scopeType: "adhoc", scopeKey: "inbox", name: "Bread", ingredientMetadata: m }];
    // Execute the deployed handler's saved delete/insert mapping, with all
    // dependencies synthetic. No Production request or real DB is involved.
    const source = readFileSync("server/routes.ts", "utf8");
    const start = source.indexOf('app.post("/api/shopping-list"');
    const mapping = source.slice(start, source.indexOf("// Holiday Feast Routes", start));
    const block = mapping.slice(mapping.indexOf("// Handle strategy"), mapping.indexOf("res.status(201)"));
    const js = ts.transpileModule(`async function fixture(){${block};return insertedItems}`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const run = new Function("db", "shoppingListItems", "and", "eq", "userId", "items", "scope", "strategy", "multiplier", "sourceBuilder",
      `${js};return fixture()`);
    const rows = await run(mockDatabase, shoppingListItems, ops.and, ops.eq, "synthetic-a", [{ name: "Bread", quantity: 1, ingredientMetadata: m }], { type: "adhoc", key: "inbox" }, "replace_scope", 1, "fixture");
    expect(rows).toHaveLength(1);
    expect(rows[0].ingredientMetadata).toBeUndefined();
    expect(state.rows[0].ingredientMetadata).toBeUndefined();
  });
  test("Production gating does not create metadata", () => {
    process.env.NODE_ENV = "production";
    expect(developmentSavedProductFields({ id: "s", productKey: "p", productName: "Bread", brand: null, barcode: null })).toEqual({});
  });
  test("retail metadata updates retain original contributions even if omitted from the submitted array", () => {
    const ingredientMetadata = makeIngredientMetadata({ name: "Bread", quantity: 2, unit: "slice", recipeId: "original-recipe" });
    const metadata = developmentSavedProductFields({ id: "s1", productKey: "p1", productName: "Bread", brand: null, barcode: null }).ingredientMetadata!;
    metadata.contributions = [];
    const update = developmentItemPatch({ ingredientMetadata: metadata }, { ingredientMetadata });
    expect((update.ingredientMetadata as any).contributions).toEqual(ingredientMetadata.contributions);
    expect(() => developmentItemPatch({ ingredientMetadata: { ...metadata, ingredient: { ...metadata.ingredient, originalName: "Different retail product" } } }, { ingredientMetadata })).toThrow();
  });
});
