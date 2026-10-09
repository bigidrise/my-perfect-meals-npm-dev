import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { savedMeals } from "../db/schema/savedMeals";

type GroceryCardInsert = typeof savedMeals.$inferInsert & {
  userId: string;
  signatureHash: string;
};

/** Reuses the existing user/signature unique constraint; no schema changes. */
export async function saveGroceryCardOnce(row: GroceryCardInsert): Promise<string> {
  const findExisting = async () => {
    const [existing] = await db.select({ id: savedMeals.id })
      .from(savedMeals)
      .where(and(
        eq(savedMeals.userId, row.userId),
        eq(savedMeals.signatureHash, row.signatureHash),
      ))
      .limit(1);
    return existing?.id;
  };
  const existingId = await findExisting();
  if (existingId) return existingId;
  const [inserted] = await db.insert(savedMeals)
    .values(row)
    .onConflictDoNothing({ target: [savedMeals.userId, savedMeals.signatureHash] })
    .returning({ id: savedMeals.id });
  if (inserted?.id) return inserted.id;
  // Another tab or a lost-response recovery won the concurrent save.
  const winnerId = await findExisting();
  if (!winnerId) throw new Error("Meal card save could not be confirmed. Please retry.");
  return winnerId;
}
