// Local synthetic acceptance data only. Never reads DATABASE_URL or copies users.
import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { users, shoppingListItems } from "../../shared/schema.ts";
import { makeIngredientMetadata } from "../../shared/shoppingIngredientMetadata.ts";
import { verifyIsolatedDatabase } from "./target.mjs";

const userId = "00000000-0000-4000-8000-000000001901";
const client = await verifyIsolatedDatabase();
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='3s'");
  await client.query("SET LOCAL statement_timeout='10s'");
  // Reuse the already-reviewed memory DDL as isolated fixture schema, not a
  // shared-database migration or a new application storage contract.
  const migration = await readFile("scripts/migrations/add-grocery-choice-memory.mjs", "utf8");
  const ddl = [...migration.matchAll(/client\.query\(`(CREATE (?:TABLE|UNIQUE INDEX) IF NOT EXISTS[\s\S]*?)`\)/g)];
  if (ddl.length !== 2 || ddl.some(match => !match[1].includes("user_grocery_choice_memory"))) {
    throw new Error("Reviewed grocery-memory DDL no longer matches the fixture setup.");
  }
  for (const match of ddl) await client.query(match[1]);
  const db = drizzle(client);
  await db.insert(users).values({
    id: userId, username: "offline-shopping-actions", email: "offline-shopping-actions@example.test",
    password: await bcrypt.hash("Isolated-Shopping-Only-2026!", 10),
    firstName: "Offline", lastName: "Shopping", isFounder: true, isTester: true,
    onboardingCompletedAt: new Date(), dailyCalorieTarget: 2000, dailyProteinTarget: 100,
    dailyCarbsTarget: 250, dailyFatTarget: 67,
  }).onConflictDoNothing();
  for (const [index, name] of ["olive oil", "avocado oil", "low sodium olive oil", "fresh chopped onion"].entries()) {
    const metadata = makeIngredientMetadata({ name, quantity: 2, unit: "tbsp", recipeId: `offline-recipe-${index}` });
    await db.insert(shoppingListItems).values({
      id: `00000000-0000-4000-8000-00000000190${index + 2}`, userId, name, quantity: "2", unit: "tbsp",
      category: "Pantry", sourceMeals: ["Offline acceptance recipe"], ingredientMetadata: metadata,
      scopeType: "adhoc", scopeKey: "inbox", sourceBuilder: "manual",
    }).onConflictDoNothing();
  }
  await client.query("COMMIT");
  console.log("Seeded one synthetic account and four recipe-linked rows in the verified isolated database only.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally { await client.end(); }
