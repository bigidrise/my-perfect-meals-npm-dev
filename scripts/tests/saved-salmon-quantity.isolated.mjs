/**
 * Actual classic POST callback + HTTP + isolated durable PostgreSQL/WASM +
 * actual Saved Meals transport, hydration, aggregation and retail formatting.
 * No app boot, shared database connection, customer writes or paid services.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import ts from "typescript";
import express from "express";
import { PGlite } from "@electric-sql/pglite";

const directory = await mkdtemp(join(tmpdir(), "saved-salmon-"));
const memory = new Map([["userId", "synthetic-salmon"]]);
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};
let database = new PGlite(join(directory, "postgres"));
let server;
let checks = 0;
const check = (name, value) => { assert.ok(value, name); console.log(`PASS ${name}`); checks++; };
try {
  await database.waitReady;
  await database.exec(`CREATE TABLE shopping_list_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
    name text, quantity text, unit text, category text, scope_type text,
    scope_key text, source_builder text, checked boolean DEFAULT false);`);
  await writeFile(join(directory, "request.ts"),
    "export const apiRequest = (...args) => globalThis.__shoppingRequest(...args);");
  await writeFile(join(directory, "account.ts"),
    'export const shoppingAccount = () => localStorage.getItem("userId");');
  const bundle = await build({
    stdin: { contents: `
      export {sendSavedMealToShopping} from "./client/src/lib/savedMealShopping";
      export {createDevelopmentShoppingListStore} from "./client/src/stores/developmentShoppingListStore";
      export {buildConsolidatedItems} from "./client/src/lib/shoppingConsolidation";
      export {getRetailQuantity} from "./client/src/lib/retailIntelligence";
      export {selectionForRecipe} from "./shared/mealShoppingSelection";
    `, resolveDir: process.cwd(), loader: "ts" },
    alias: { "@/lib/apiRequest": join(directory, "request.ts"), "@/lib/mealShoppingApi": join(directory, "account.ts") },
    define: { "import.meta.env.DEV": "true" }, bundle: true, platform: "node", format: "esm", write: false,
  });
  await writeFile(join(directory, "pipeline.mjs"), bundle.outputFiles[0].text);
  const pipeline = await import(`file://${join(directory, "pipeline.mjs")}`);
  const source = ts.createSourceFile("routes.ts", await readFile("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "app.post" &&
        ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/api/shopping-list") {
      assert.deepEqual(node.arguments.slice(1, -1).map(a => a.getText(source)), ["requireAuth", "requireEssentialAccess"]);
      callback = node.arguments.at(-1);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback);
  const compiled = ts.transpileModule(`const handler = ${callback.getText(source)};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const db = {
    insert: () => ({ values: rows => ({ returning: async () => {
      const inserted = [];
      for (const row of rows) {
        const result = await database.query(`INSERT INTO shopping_list_items
          (user_id,name,quantity,unit,category,scope_type,scope_key,source_builder,checked)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [row.userId,row.name,row.quantity,row.unit,row.category,row.scopeType,row.scopeKey,row.sourceBuilder,row.checked]);
        inserted.push(...result.rows);
      }
      return inserted;
    } }) }),
    delete: () => { throw new Error("This test must never replace/delete a scope"); },
  };
  const deps = { db, shoppingListItems: {}, shoppingMetadataDevelopment: () => false,
    groceryCoachProductMetadata: () => undefined, emitActivityEvent: async () => {} };
  const handler = new Function(...Object.keys(deps), `${compiled}; return handler;`)(...Object.values(deps));
  const app = express().use(express.json());
  // Synthetic identity belongs only to this loopback test, never the real app.
  app.post("/api/shopping-list", (req, _res, next) => { req.authUser = { id: "synthetic-salmon" }; next(); }, handler);
  app.get("/api/shopping-list-v2/", async (_req, res) => {
    const result = await database.query("SELECT * FROM shopping_list_items WHERE user_id=$1", ["synthetic-salmon"]);
    res.json({ items: result.rows });
  });
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  globalThis.__shoppingRequest = async (path, options) => {
    const response = await fetch(origin + path, { ...options, headers: { "Content-Type": "application/json" } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Synthetic API failed");
    return body;
  };
  const recipe = { id: "salmon-a", name: "Baked Salmon", servings: 2,
    ingredients: [
      { name: "salmon fillet", quantity: "12", unit: "oz" },
      { name: "zucchini", quantity: "2", unit: "cup" },
      { name: "bell pepper", quantity: "2", unit: "cup" },
      { name: "asparagus", quantity: "2", unit: "cup" },
      { name: "olive oil", quantity: "4", unit: "tbsp" },
      { name: "garlic", quantity: "4", unit: "cloves" },
      { name: "lemon juice", quantity: "2", unit: "tbsp" },
      { name: "black pepper", quantity: "1", unit: "tsp" },
      { name: "fresh thyme", quantity: "2", unit: "tsp" },
    ] };
  const selection = pipeline.selectionForRecipe(recipe, "create-dish").selection;
  await pipeline.sendSavedMealToShopping(selection, true);
  let rows = (await database.query("SELECT * FROM shopping_list_items")).rows;
  check("all nine two-serving recipe requirements persist unchanged, including exactly 12 oz salmon",
    rows.length === 9 && recipe.ingredients.every(i => rows.some(r =>
      r.name === i.name && r.quantity === i.quantity && r.unit === i.unit)));
  await database.close();
  database = new PGlite(join(directory, "postgres")); await database.waitReady;
  const store = pipeline.createDevelopmentShoppingListStore(globalThis.__shoppingRequest);
  await store.getState().hydrate();
  let display = pipeline.buildConsolidatedItems(store.getState().items);
  let salmon = display.find(i => i.name === "salmon fillet");
  check("fresh hydration displays Needed 12 oz / Buy 0.75 lb", salmon.requiredAmounts[0].quantity === 12 &&
    salmon.requiredAmounts[0].unit === "oz" && pipeline.getRetailQuantity(salmon) === "0.75 lb");
  const repeated = await pipeline.sendSavedMealToShopping(selection, true);
  rows = (await database.query("SELECT * FROM shopping_list_items")).rows;
  check("reopening the same saved meal adds no extra database rows", repeated.alreadyAdded && rows.length === 9);
  const second = pipeline.selectionForRecipe({ ...recipe, id: "salmon-b", name: "Second salmon meal",
    ingredients: [{ name: "salmon fillet", quantity: 0.5, unit: "lb" }] }, "create-dish").selection;
  await pipeline.sendSavedMealToShopping(second, true);
  await store.getState().hydrate();
  display = pipeline.buildConsolidatedItems(store.getState().items);
  salmon = display.find(i => i.name === "salmon fillet");
  check("second meal preserves 12 oz + 0.5 lb as one exact 1.25 lb combined purchase",
    display.filter(i => i.name === "salmon fillet").length === 1 &&
    salmon.requiredAmounts.length === 2 && pipeline.getRetailQuantity(salmon) === "1.25 lb");
  check("second meal leaves exactly two persisted salmon contributions, not servings multiplied twice",
    (await database.query("SELECT count(*)::int AS count FROM shopping_list_items WHERE name='salmon fillet'")).rows[0].count === 2);
  console.log(`${checks} isolated end-to-end checks passed.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await database.close();
  await rm(directory, { recursive: true, force: true });
}
