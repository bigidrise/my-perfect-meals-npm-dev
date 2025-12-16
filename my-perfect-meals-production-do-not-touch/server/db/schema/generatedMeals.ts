import { pgTable, uuid, text, timestamp, integer, jsonb, index, varchar } from "drizzle-orm/pg-core";

export const generatedMealsCache = pgTable("generated_meals_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  signatureHash: varchar("signature_hash", { length: 32 }).notNull(),
  signature: text("signature").notNull(),
  mealType: text("meal_type").notNull(),
  source: text("source").notNull().default("ai"),
  mealData: jsonb("meal_data").notNull(),
  calories: integer("calories").notNull(),
  protein: integer("protein").notNull(),
  carbs: integer("carbs").notNull(),
  fat: integer("fat").notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  signatureIdx: index("generated_meals_signature_idx").on(t.signatureHash),
  mealTypeIdx: index("generated_meals_type_idx").on(t.mealType),
}));
