import { pgTable, uuid, varchar, text, timestamp, jsonb, index, uniqueIndex, integer, boolean } from "drizzle-orm/pg-core";

export const savedMeals = pgTable("saved_meals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  title: text("title").notNull(),
  sourceType: varchar("source_type", { length: 48 }).notNull().default("unknown"),
  signatureHash: varchar("signature_hash", { length: 64 }).notNull(),
  mealData: jsonb("meal_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Diabetic Meal Memory — populated when meal is saved from the Diabetic Builder
  generatedBglMgdl: integer("generated_bgl_mgdl"),
  glucoseContext: varchar("glucose_context", { length: 24 }),
  protocolType: text("protocol_type"),
  bglBucket: varchar("bgl_bucket", { length: 16 }),
  savedFromDiabeticBuilder: boolean("saved_from_diabetic_builder").notNull().default(false),
  // Media Asset lifecycle — FK to media_assets.id; null for legacy rows
  mediaAssetId: uuid("media_asset_id"),
}, (t) => ({
  userIdx: index("saved_meals_user_idx").on(t.userId),
  uniqueMealPerUser: uniqueIndex("saved_meals_user_sig_idx").on(t.userId, t.signatureHash),
}));
