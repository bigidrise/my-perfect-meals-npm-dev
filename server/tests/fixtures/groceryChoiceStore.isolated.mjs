import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createGroceryChoiceMemoryStore } from "../../services/groceryChoiceMemoryStore.ts";
import { groceryChoiceKey } from "../../services/groceryChoiceMemory.ts";

// Entirely in memory; no app database import, account creation or provider calls.
const pg = new PGlite();
try {
  await pg.exec("CREATE TABLE users (id varchar PRIMARY KEY); INSERT INTO users VALUES ('owner-a'), ('owner-b');");
  await pg.exec(`CREATE TABLE user_saved_grocery_items (
    user_id varchar, product_name text, brand text, category text, product_meta jsonb, saved_at timestamptz DEFAULT now()
  ); INSERT INTO user_saved_grocery_items (user_id, product_name, brand, category, product_meta) VALUES
    ('owner-a', 'Tomato Sauce', 'Saved Brand', 'tomato sauce', '{"subjectKind":"human"}'),
    ('owner-b', 'Dog Food', 'Companion Brand', 'tomato sauce', '{"subjectKind":"companion"}');`);
  const migration = readFileSync("scripts/migrations/add-grocery-choice-memory.mjs", "utf8");
  const statements = [...migration.matchAll(/client\.query\(`(CREATE[\s\S]*?)`\)/g)].map(match => match[1]);
  assert.equal(statements.length, 2);
  for (const statement of statements) await pg.exec(statement);
  const db = drizzle(pg);
  const first = createGroceryChoiceMemoryStore(db);
  assert.equal((await first.read("owner-a", groceryChoiceKey("tomato sauce"), "tomato sauce")).preferredName, "Saved Brand Tomato Sauce");
  assert.equal(await first.read("owner-b", groceryChoiceKey("tomato sauce"), "tomato sauce"), null);
  const key = groceryChoiceKey("olive oil");
  await first.observe("owner-a", key, "olive oil", ["Alpha Oil", "Beta Oil"]);
  assert.equal((await first.read("owner-a", key)).preferredName, null);
  assert.equal(await first.read("owner-b", key), null);
  await first.prefer("owner-a", key, "olive oil", "Beta Oil");
  await first.observe("owner-a", key, "olive oil", ["Gamma Oil"]);
  const reopened = createGroceryChoiceMemoryStore(db);
  assert.deepEqual(await reopened.read("owner-a", key), { shownNames: ["Gamma Oil"], preferredName: "Beta Oil" });
  await first.observe("owner-b", key, "olive oil", ["Other Oil"]);
  assert.equal((await first.read("owner-b", key)).preferredName, null);
  await first.observe("owner-a", key, "olive oil", []);
  assert.equal((await first.read("owner-a", key)).preferredName, "Beta Oil");
  await assert.rejects(db.transaction(async tx => {
    await createGroceryChoiceMemoryStore(tx).prefer("owner-a", key, "olive oil", "Rolled Back Oil");
    throw new Error("synthetic save failure");
  }));
  assert.equal((await first.read("owner-a", key)).preferredName, "Beta Oil");
  await assert.rejects(first.prefer("foreign-account", key, "olive oil", "Oil"));
  await pg.exec("DELETE FROM users WHERE id = 'owner-a'");
  assert.equal(await first.read("owner-a", key), null);
  assert.notEqual(await first.read("owner-b", key), null);
  console.log("ISOLATED_GROCERY_MEMORY_PASSED");
} finally {
  await pg.close();
}
