import { db } from "../db";
import { userSavedGroceryItems } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { SavedAnalysisStore } from "./savedGroceryAnalysis";

export const savedGroceryAnalysisStore: SavedAnalysisStore = {
  async withItem(owner, id, change) {
    return db.transaction(async tx => {
      const predicate = and(eq(userSavedGroceryItems.userId, owner), eq(userSavedGroceryItems.id, id));
      const [row] = await tx.select().from(userSavedGroceryItems).where(predicate).for("update");
      const meta = row?.productMeta;
      const mutation = change(row ? { ...row, productMeta: meta && typeof meta === "object" && !Array.isArray(meta) ? meta : null } : null);
      if (mutation.productMeta && row) await tx.update(userSavedGroceryItems).set({ productMeta: mutation.productMeta }).where(predicate);
      return mutation.value;
    });
  },
};
