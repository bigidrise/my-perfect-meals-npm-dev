import { pgTable, uuid, varchar, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const savedMeals = pgTable("saved_meals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  title: text("title").notNull(),
  sourceType: varchar("source_type", { length: 48 }).notNull().default("unknown"),
  signatureHash: varchar("signature_hash", { length: 64 }).notNull(),
  mealData: jsonb("meal_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index("saved_meals_user_idx").on(t.userId),
  uniqueMealPerUser: uniqueIndex("saved_meals_user_sig_idx").on(t.userId, t.signatureHash),
}));
