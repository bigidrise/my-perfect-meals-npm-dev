jest.mock("../db", () => ({ db: mockDb }));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.fixtureUser = req.headers["x-fixture-user"] || "synthetic-a"; next(); },
}));
jest.mock("../utils/getAuthUserId", () => ({ getAuthUserId: (req: any) => req.fixtureUser }));
jest.mock("../services/shopping-list/metadataPersistence", () => ({
  shoppingMetadataDevelopment: () => false,
  developmentShoppingPost: () => { throw new Error("Development persistence must remain off"); },
  metadataInputFailure: (error: any, res: any) => {
    if (error?.name !== "ZodError") return false;
    res.status(400).json({ error: "Invalid metadata" }); return true;
  },
}));
jest.mock("../services/shopping-list/builder-v2", () => ({ normalizeShopping: jest.fn() }));
jest.mock("../utils/languageInstruction", () => ({ getLanguageInstruction: () => "" }));
jest.mock("drizzle-orm", () => ({
  ...jest.requireActual("drizzle-orm"),
  eq: (column: any, value: any) => ({ key: column.name.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase()), value }),
  and: (...parts: any[]) => ({ parts }),
}));

import express from "express";
import request from "supertest";
import fs from "node:fs";
import ts from "typescript";
import { z } from "zod";
import { shoppingListItems } from "../../shared/schema";
import { groceryCoachSelectedProductMetadata } from "../../client/src/lib/groceryCoachShoppingTransfer";
import { groceryCoachProductMetadata } from "../../shared/shoppingIngredientMetadata";
import type { IngredientScanResult } from "../../client/src/lib/photoIngredientCapture";

let rows: any[] = [];
const clone = (v: any) => JSON.parse(JSON.stringify(v));
const matches = (row: any, condition: any): boolean => !condition || (condition.parts
  ? condition.parts.every((p: any) => matches(row, p)) : row[condition.key] === condition.value);
const ops = {
  eq: (column: any, value: any) => ({ key: column.name.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase()), value }),
  and: (...parts: any[]) => ({ parts }),
};
const mockDb: any = {
  insert: () => ({ values: (values: any[]) => ({ returning: async () => {
    const created = values.map((v, n) => ({ ...clone(v), id: `row-${rows.length + n}` }));
    rows.push(...created); return clone(created);
  } }) }),
  select: () => ({ from: () => ({ where: (condition: any) => ({ orderBy: async () => clone(rows.filter(r => matches(r, condition))) }) }) }),
  query: { shoppingListItems: {
    findMany: async ({ where }: any) => clone(rows.filter(r => matches(r, where({ userId: { name: "user_id" } }, ops)))),
    findFirst: async ({ where }: any) => clone(rows.find(r => matches(r, where({ id: { name: "id" }, userId: { name: "user_id" } }, ops))) || null),
  } },
  update: () => ({ set: (updates: any) => ({ where: async (condition: any) => {
    rows.filter(r => matches(r, condition)).forEach(r => Object.assign(r, updates));
  } }) }),
};
const router = require("../routes/shoppingList").default;
const { shoppingRouter } = require("../routes/shoppingListV2");
const app = express().use(express.json()).use("/api", router).use("/api/shopping-list-v2", shoppingRouter);

// registerRoutes mounts an earlier POST before the shared router. Execute its
// exact callback with allowlisted dependencies, without booting live services.
function primaryApp() {
  const source = ts.createSourceFile("routes.ts", fs.readFileSync(`${__dirname}/../routes.ts`, "utf8"), ts.ScriptTarget.Latest, true);
  let callback: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "app.post"
      && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/api/shopping-list") {
      expect(node.arguments.slice(1, -1).map(a => a.getText(source))).toEqual(["requireAuth", "requireEssentialAccess"]);
      callback = node.arguments[node.arguments.length - 1];
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!callback) throw new Error("Production-effective shopping POST not found");
  const compiled = ts.transpileModule(`const handler = ${callback.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const deps = {
    db: mockDb, shoppingListItems, groceryCoachProductMetadata, z,
    shoppingMetadataDevelopment: () => false,
    developmentShoppingPost: () => { throw new Error("Development persistence must stay disabled"); },
    emitActivityEvent: jest.fn(async () => undefined), ...ops,
  };
  const handler = new Function(...Object.keys(deps), `${compiled}; return handler;`)(...Object.values(deps));
  return express().use(express.json()).post("/api/shopping-list", (req: any, _res: any, next: any) => {
    req.authUser = { id: "synthetic-a" }; next();
  }, handler).use("/api", router).use("/api/shopping-list-v2", shoppingRouter);
}

function item(name = "Whole wheat spaghetti", product = "Example pasta") {
  return {
    name, quantity: .5, unit: "cups",
    ingredientMetadata: groceryCoachSelectedProductMetadata(
      { item: name, quantity: "1/2", unit: "cups" },
      { name: product, byNameAnalysis: { educationalFooter: "Check current label." } as IngredientScanResult },
      { id: "synthetic-recipe", name: "Synthetic dinner" },
    ),
  };
}
beforeEach(() => { rows = []; });

test("actual Production POST and both GET paths preserve multiple ingredient and product associations", async () => {
  const inputs = [item(), item("Parmesan cheese", "Example cheese"), item("Whole wheat spaghetti", "Other pasta")];
  const saved = await request(app).post("/api/shopping-list").send({ items: inputs, scopeType: "adhoc", scopeKey: "cross-device" });
  expect(saved.status).toBe(200);
  expect(saved.body.items).toHaveLength(3);
  const reloaded = await request(app).get("/api/shopping-list-v2/");
  expect(reloaded.body.items.map((r: any) => r.ingredientMetadata)).toEqual(inputs.map(i => i.ingredientMetadata));
  const grouped = await request(app).get("/api/shopping-list?scopeType=adhoc&scopeKey=cross-device");
  expect(grouped.body.aggregated).toHaveLength(3);
  expect(grouped.body.aggregated[0].ingredientMetadata).toEqual(inputs[0].ingredientMetadata);
  const other = await request(app).get("/api/shopping-list-v2/").set("x-fixture-user", "synthetic-b");
  expect(other.body.items).toEqual([]);
});

test("legacy rows stay compatible and keep existing generic aggregation", async () => {
  const saved = await request(app).post("/api/shopping-list").send({ items: [
    { name: "Cucumber", quantity: 1, unit: "" }, { name: "Cucumber", quantity: 2, unit: "" },
  ] });
  expect(saved.status).toBe(200);
  const read = await request(app).get("/api/shopping-list");
  expect(read.body.aggregated).toHaveLength(1);
  expect(read.body.aggregated[0].quantity).toBe("3");
});

test("quantity edits retain association; replacement, renaming and cross-account edits cannot overwrite it", async () => {
  const original = item();
  await request(app).post("/api/shopping-list").send({ items: [original] });
  expect((await request(app).patch("/api/shopping-list-v2/row-0").send({ quantity: "1" })).status).toBe(200);
  expect(rows[0].ingredientMetadata).toEqual(original.ingredientMetadata);
  expect((await request(app).patch("/api/shopping-list-v2/row-0").send({ name: "Different ingredient" })).status).toBe(400);
  expect((await request(app).patch("/api/shopping-list-v2/row-0").send({ ingredientMetadata: item("Spaghetti sauce").ingredientMetadata })).status).toBe(400);
  expect((await request(app).patch("/api/shopping-list-v2/row-0").set("x-fixture-user", "synthetic-b").send({ quantity: "99" })).status).toBe(404);
});

test.each(["wrongIngredient", "clearance", "catalog"])("rejects %s metadata atomically before any write", async variant => {
  const input = item();
  if (variant === "wrongIngredient") input.name = "Parmesan cheese";
  if (variant === "clearance") input.ingredientMetadata.selectedProduct!.assessment.status = "profile_matched";
  if (variant === "catalog") input.ingredientMetadata.selectedProduct!.source.source = "Unrelated catalog";
  const saved = await request(app).post("/api/shopping-list").send({ items: [item(), input] });
  expect(saved.status).toBe(400);
  expect(rows).toHaveLength(0);
});

test("compatibility validation uses the existing schema and never grants safety eligibility", () => {
  const input = item();
  expect(groceryCoachProductMetadata(input.ingredientMetadata, input.name)?.selectedProduct?.assessment.status).toBe("review_required");
  expect(groceryCoachProductMetadata(undefined, "Cucumber")).toBeUndefined();
});

test("earlier Production-effective POST retains metadata and reloads through the real v2 GET", async () => {
  const production = primaryApp();
  const inputs = [item(), item("Parmesan cheese", "Example cheese"), item("Whole wheat spaghetti", "Other pasta")];
  const saved = await request(production).post("/api/shopping-list").send({ items: inputs });
  expect(saved.status).toBe(201);
  expect(saved.body.items.map((r: any) => r.ingredientMetadata)).toEqual(inputs.map(i => i.ingredientMetadata));
  const loaded = await request(production).get("/api/shopping-list-v2/");
  expect(loaded.body.items.map((r: any) => r.ingredientMetadata)).toEqual(inputs.map(i => i.ingredientMetadata));
});

test("earlier Production-effective POST rejects bad associations before replace_scope can delete anything", async () => {
  const bad = item();
  bad.name = "Wrong ingredient";
  const saved = await request(primaryApp()).post("/api/shopping-list").send({ items: [bad], strategy: "replace_scope" });
  expect(saved.status).toBe(400);
  expect(rows).toEqual([]);
});
