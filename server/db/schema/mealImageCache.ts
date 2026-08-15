import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const mealImageCache = pgTable("meal_image_cache", {
  cacheKey: text("cache_key").primaryKey(),
  imageUrl: text("image_url").notNull(),
  mealName: text("meal_name").notNull(),
  promptUsed: text("prompt_used"),
  // Vision validation columns — a cached image means "generated for this recipe
  // contract and passed fidelity validation", not just "generated before".
  validationStatus: text("validation_status"),   // PASS | FAIL | SKIPPED
  validationModel: text("validation_model"),
  validationReason: text("validation_reason"),
  recipeSignature: text("recipe_signature"),     // SHA-256 of sorted ingredient list
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  mealNameIdx: index("meal_image_cache_name_idx").on(t.mealName),
}));
