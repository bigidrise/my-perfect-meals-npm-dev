import { pgTable, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";

export const mealShares = pgTable("meal_shares", {
  shareToken:      text("share_token").primaryKey(),
  userId:          text("user_id").notNull(),
  mealName:        text("meal_name").notNull(),
  mealDescription: text("meal_description"),
  mealImage:       text("meal_image"),
  calories:        integer("calories"),
  protein:         numeric("protein", { precision: 5, scale: 1 }),
  carbs:           numeric("carbs",   { precision: 5, scale: 1 }),
  fat:             numeric("fat",     { precision: 5, scale: 1 }),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MealShare = typeof mealShares.$inferSelect;
