/**
 * Offline PostgreSQL/WASM contract check. Never imports the application DB.
 * Run: node scripts/tests/meal-shopping-transfers.isolated.mjs
 */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";
import net from "node:net";

const temporary = await mkdtemp(join(tmpdir(), "meal-shopping-offline-"));
const bundle = await build({
  entryPoints: ["server/services/shopping-list/selectionTransfers.ts"], bundle: true,
  platform: "node", format: "esm", write: false,
});
await writeFile(join(temporary, "service.mjs"), bundle.outputFiles[0].text);
const { transferShoppingSelections: transfer, clearShoppingTransferCycle: clear, shoppingTransferSchemaReady: ready } =
  await import(`file://${join(temporary, "service.mjs")}`);
const db = new PGlite();
await db.waitReady;
// WASM is initialized; every subsequent external network attempt is forbidden.
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function() { throw new Error("Network forbidden in isolated shopping checks"); };
globalThis.fetch = async () => { throw new Error("Network forbidden in isolated shopping checks"); };
let releaseNext = Promise.resolve(), fault = false;
const pool = {
  async connect() {
    const previous = releaseNext;
    let unlock;
    releaseNext = new Promise(resolve => { unlock = resolve; });
    await previous;
    return {
      async query(sql, params = []) {
        if (fault && sql.includes("INSERT INTO shopping_transfer_contributions")) throw new Error("Synthetic failed persistence");
        return db.query(sql, params);
      },
      release() { unlock(); },
    };
  },
};
let checks = 0;
const check = (name, condition) => { assert.ok(condition, name); checks++; console.log(`PASS ${name}`); };
const rows = async () => (await db.query("SELECT * FROM shopping_list_items ORDER BY name,id")).rows;
const selection = (id, quantity = 2, more = {}) => ({
  selectionId: id, recipeName: id, source: "synthetic", recipeYield: 3, shoppingServings: 3,
  quantityBasis: "recipe_total", subjectKind: "human",
  ingredients: [{ name: "chicken breast", quantity, unit: "lb" }], ...more,
});
const send = (selections, operation = "add") => transfer(pool, "synthetic-a", { selections, operation });
try {
  await db.exec(`
    CREATE TABLE users(id varchar PRIMARY KEY);
    INSERT INTO users VALUES('synthetic-a'),('synthetic-b');
    CREATE TABLE shopping_list_items(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar REFERENCES users(id),
      name text NOT NULL, quantity text NOT NULL, unit text, scope_type text NOT NULL,
      scope_key text NOT NULL, source_builder text, checked boolean DEFAULT false,
      product_key text, ingredient_metadata jsonb, category text);
    CREATE TABLE shopping_list_sources(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar REFERENCES users(id),
      item_id uuid REFERENCES shopping_list_items(id) ON DELETE CASCADE,
      meal_id text, meal_name text, generator text, qty text, unit text);
  `);
  check("schema unavailable before migration", !await ready(pool));
  await db.exec(await readFile("migrations/20261111_meal_shopping_transfers.sql", "utf8"));
  check("review-only migration works in isolated PostgreSQL", await ready(pool));
  const a = selection("recipe-a"), b = selection("recipe-b");
  await send([a, b]);
  check("two three-serving recipes aggregate to 4 lb, not 12 lb", (await rows()).length === 1 && (await rows())[0].quantity === "4");
  await Promise.all([send([a]), send([a, b]), send([b])]);
  check("repeated/card-versus-bulk requests remain 4 lb", (await rows())[0].quantity === "4");
  // A fresh service call reads durable SQL receipts, not a client 'added' flag.
  check("save/reopen retry reads durable receipt", (await send([a])).results[0].status === "already_added");
  const changed = { ...a, shoppingServings: 6 };
  check("changed servings require explicit update", !(await send([changed])).committed && (await rows())[0].quantity === "4");
  await send([{ ...changed, expectedVersion: 1 }], "replace");
  check("explicit update replaces only that recipe contribution", (await rows())[0].quantity === "6");
  const stale = await send([{ ...a, expectedVersion: 1 }], "replace");
  check("stale update cannot overwrite a newer version", !stale.committed && (await rows())[0].quantity === "6");
  await clear(pool, "synthetic-a");
  for (const q of ["½", "1/2", "1½", "1 1/2"]) {
    await send([selection(`fraction-${q}`, q, { ingredients: [{ name: `flour ${q}`, quantity: q, unit: "cup" }] })]);
  }
  check("unicode, ASCII and mixed fractions stay accurate",
    (await rows()).map(r => Number(r.quantity)).sort().join(",") === "0.5,0.5,1.5,1.5");
  await clear(pool, "synthetic-a");
  await send([a, selection("ounce", 16, { ingredients: [{ name: "chicken breast", quantity: 16, unit: "oz" }] })]);
  check("compatible weights combine", (await rows()).length === 1 && (await rows())[0].quantity === "3");
  await send([selection("volume", 1, { ingredients: [{ name: "chicken breast", quantity: 1, unit: "cup" }] })]);
  check("weight and volume stay separate", (await rows()).length === 2);
  await clear(pool, "synthetic-a");
  await db.query(`INSERT INTO shopping_list_items(user_id,name,quantity,unit,scope_type,scope_key,checked)
    VALUES('synthetic-a','chicken breast','7','lb','adhoc','inbox',false),
    ('synthetic-a','chicken breast','99','lb','adhoc','inbox',true),
    ('synthetic-b','apples','9','','adhoc','inbox',false)`);
  await send([a]);
  check("manual groceries and checked rows are preserved", (await rows()).some(r => r.quantity === "7" && r.name === "chicken breast") &&
    (await rows()).filter(r => r.user_id === "synthetic-a" && !r.checked).reduce((n, r) => n + Number(r.quantity), 0) === 9 &&
    (await rows()).some(r => r.checked && r.quantity === "99"));
  check("another owner's groceries remain untouched", (await rows()).some(r => r.user_id === "synthetic-b" && r.quantity === "9"));
  const before = JSON.stringify(await rows());
  fault = true;
  await assert.rejects(send([selection("failed", 2)]), /Synthetic failed/);
  fault = false;
  check("failed persistence rolls back rows and receipts", JSON.stringify(await rows()) === before &&
    (await db.query("SELECT * FROM shopping_transfer_receipts WHERE selection_id='failed'")).rows.length === 0);
  await assert.rejects(send([selection("unknown", undefined, { ingredients: [{ name: "salt", quantity: "to taste" }] })]), /Review ingredient/);
  check("unknown amounts never become a fabricated one", JSON.stringify(await rows()) === before);
  await clear(pool, "synthetic-a");
  await send([a]);
  check("new shopping cycle permits intentional re-shopping", (await rows()).some(r => r.user_id === "synthetic-a" && r.quantity === "2"));
  await db.query("DELETE FROM shopping_list_items WHERE user_id='synthetic-a'");
  await assert.rejects(send([a]), /deleted/);
  check("deleted contributions do not masquerade as already on the list", true);
  await clear(pool, "synthetic-a");
  await send([a]);
  const evidence = structuredClone((await rows()).find(r => r.user_id === "synthetic-a").ingredient_metadata);
  evidence.selectedProduct = {
    productKey: "synthetic-brand", name: "Synthetic packaged chicken", source: { source: "isolated-fixture" },
    evidence: [], assessment: { status: "review_required", unresolvedRequirements: ["label_review"], reasons: ["Historical fixture, not a clinical approval."] },
  };
  await db.query(`INSERT INTO shopping_list_items(user_id,name,quantity,unit,scope_type,scope_key,product_key,ingredient_metadata)
    VALUES('synthetic-a','chicken breast','5','lb','adhoc','inbox','synthetic-brand',$1)`, [JSON.stringify(evidence)]);
  await send([selection("product", 1, { ingredients: [{ name: "chicken breast", quantity: 1, unit: "lb", ingredientMetadata: evidence }] })]);
  const product = (await rows()).find(r => r.product_key === "synthetic-brand");
  assert.deepEqual(product.ingredient_metadata.selectedProduct, evidence.selectedProduct);
  check("selected product evidence survives aggregation unchanged", product.quantity === "6");
  const rejectedBefore = JSON.stringify(await rows());
  await assert.rejects(send([a, selection("invalid", 0)]));
  check("one invalid selection rejects the entire batch", JSON.stringify(await rows()) === rejectedBefore);

  // Compile the exact router for a Production bundle, then invoke its real
  // Express middleware stack without opening a socket or importing live auth/DB.
  const routeBundle = await build({
    entryPoints: ["server/routes/mealShoppingSelections.ts"], bundle: true,
    platform: "node", format: "esm", write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: `import {createRequire} from "node:module"; const require=createRequire(${JSON.stringify(join(process.cwd(), "package.json"))});` },
  });
  await writeFile(join(temporary, "router.mjs"), routeBundle.outputFiles[0].text);
  const { createMealShoppingSelectionsRouter } = await import(`file://${join(temporary, "router.mjs")}`);
  const authenticate = (req, res, next) => {
    if (!req.syntheticActor) return res.status(401).json({ ok: false });
    req.authUser = { id: req.syntheticActor }; next();
  };
  const invoke = (router, method, url, body, actor = "synthetic-a") => new Promise((resolve, reject) => {
    const req = { method, url, originalUrl: url, headers: {}, body, query: {}, syntheticActor: actor };
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; },
      json(value) { resolve({ status: this.statusCode, body: value }); return this; } };
    router.handle(req, res, error => error ? reject(error) : resolve({ status: 404 }));
  });
  let disabledConnections = 0;
  const disabled = createMealShoppingSelectionsRouter({ authenticate, enabled: () => false,
    pool: async () => { disabledConnections++; throw new Error("Disabled path must not import/connect a DB"); } });
  check("inactive capabilities do not connect to the database",
    (await invoke(disabled, "GET", "/selections/capabilities")).body.available === false && disabledConnections === 0);
  check("inactive transfers fail closed without database access",
    (await invoke(disabled, "POST", "/selections", { selections: [a] })).status === 503 && disabledConnections === 0);
  check("authentication precedes capability or persistence access",
    (await invoke(disabled, "POST", "/selections", { selections: [a] }, null)).status === 401);
  const active = createMealShoppingSelectionsRouter({ authenticate, enabled: () => true, pool: async () => pool });
  check("compiled Production router confirms isolated schema readiness",
    (await invoke(active, "GET", "/selections/capabilities")).body.available === true);
  const result = await invoke(active, "POST", "/selections", { selections: [selection("compiled-route")] });
  check("compiled Production router persists through the same acknowledged service",
    result.status === 200 && result.body.committed && result.body.results[0].status === "added");
  check("submitted owner IDs cannot redirect list ownership",
    (await invoke(active, "POST", "/selections", { ownerId: "synthetic-b", selections: [selection("forged-owner")] })).status === 400);
  const entryMount = /app\.use\(["']\/api\/shopping-list-v2["'],\s*shoppingRouter\)/;
  check("Development and Production entrypoints mount the same protected router",
    entryMount.test(await readFile("server/index.ts", "utf8")) && entryMount.test(await readFile("server/prod.ts", "utf8")));
  console.log(`Completed ${checks} isolated PostgreSQL checks. No application database or customer account was used.`);
} finally {
  net.Socket.prototype.connect = originalConnect;
  await db.close();
  await rm(temporary, { recursive: true, force: true });
}
