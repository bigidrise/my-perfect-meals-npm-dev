import { pgTable, uuid, text, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creatorMeals = pgTable("creator_meals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: uuid("creator_id").notNull(),
  creatorSystemId: text("creator_system_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  mealJson: jsonb("meal_json").notNull(),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  creatorIdx: index("creator_meals_creator_idx").on(t.creatorId),
  systemIdx: index("creator_meals_system_idx").on(t.creatorSystemId),
}));

export type CreatorMeal = typeof creatorMeals.$inferSelect;
export type InsertCreatorMeal = typeof creatorMeals.$inferInsert;
