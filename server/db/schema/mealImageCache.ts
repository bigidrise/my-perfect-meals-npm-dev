import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const mealImageCache = pgTable("meal_image_cache", {
  cacheKey: text("cache_key").primaryKey(),
  imageUrl: text("image_url").notNull(),
  mealName: text("meal_name").notNull(),
  promptUsed: text("prompt_used"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  mealNameIdx: index("meal_image_cache_name_idx").on(t.mealName),
}));
