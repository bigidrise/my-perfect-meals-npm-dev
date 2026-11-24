import { and, desc, eq, sql } from "drizzle-orm";
import type { db } from "../db";
import { userGroceryChoiceMemory, userSavedGroceryItems } from "../../shared/schema";
import { boundedProductNames, type GroceryChoiceStore } from "./groceryChoiceMemory";

export function createGroceryChoiceMemoryStore(database: Pick<typeof db, "select" | "insert">): GroceryChoiceStore {
  return {
    async read(owner, key, query) {
      const [row] = await database.select({
        shownNames: userGroceryChoiceMemory.shownNames,
        preferredName: userGroceryChoiceMemory.preferredName,
      }).from(userGroceryChoiceMemory).where(and(
        eq(userGroceryChoiceMemory.userId, owner), eq(userGroceryChoiceMemory.ingredientKey, key),
      )).limit(1);
      let preferredName = row?.preferredName ?? null;
      if (!preferredName && query) {
        // Existing explicit bookmarks are useful intent, not a cache of shown
        // options and never permanent dietary approval. Match the exact query;
        // do not guess broad categories or merge distinct oils and sauces.
        const [saved] = await database.select({
          name: userSavedGroceryItems.productName, brand: userSavedGroceryItems.brand,
        }).from(userSavedGroceryItems).where(and(
          eq(userSavedGroceryItems.userId, owner),
          sql`lower(trim(${userSavedGroceryItems.category})) = lower(trim(${query}))`,
          sql`coalesce(${userSavedGroceryItems.productMeta}->>'subjectKind', 'human') <> 'companion'`,
        )).orderBy(desc(userSavedGroceryItems.savedAt)).limit(1);
        if (saved) preferredName = saved.brand && !saved.name.toLowerCase().startsWith(saved.brand.toLowerCase())
          ? `${saved.brand} ${saved.name}` : saved.name;
      }
      return row || preferredName ? { shownNames: boundedProductNames(row?.shownNames ?? []), preferredName } : null;
    },
    async observe(owner, key, query, names) {
      const shownNames = boundedProductNames(names);
      if (!shownNames.length) return; // Empty/error results must not erase useful history.
      await database.insert(userGroceryChoiceMemory).values({
        userId: owner, ingredientKey: key, query: query.slice(0, 200), shownNames,
      }).onConflictDoUpdate({
        target: [userGroceryChoiceMemory.userId, userGroceryChoiceMemory.ingredientKey],
        set: { shownNames, updatedAt: sql`now()` },
      });
    },
    async prefer(owner, key, query, name) {
      const preferredName = boundedProductNames([name])[0];
      if (!preferredName) throw new Error("Invalid preferred product");
      await database.insert(userGroceryChoiceMemory).values({
        userId: owner, ingredientKey: key, query: query.slice(0, 200), shownNames: [], preferredName,
      }).onConflictDoUpdate({
        target: [userGroceryChoiceMemory.userId, userGroceryChoiceMemory.ingredientKey],
        set: { preferredName, updatedAt: sql`now()` },
      });
    },
  };
}
