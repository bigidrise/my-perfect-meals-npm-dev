import { pgTable, text, timestamp, uuid, varchar, index } from "drizzle-orm/pg-core";

/** Durable queue for replacement of confirmed-broken Object Storage meal images. */
export const mealImageRecoveryJobs = pgTable("meal_image_recovery_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  savedMealId: uuid("saved_meal_id").notNull(),
  assetId: uuid("asset_id").notNull(),
  reportedUrl: text("reported_url").notNull(),
  recipeFingerprint: text("recipe_fingerprint").notNull(),
  status: text("status").notNull().default("pending"), // pending | processing | ready | failed
  resultImageUrl: text("result_image_url"),
  error: text("error"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  leaseToken: text("lease_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  ownerIdx: index("meal_image_recovery_jobs_owner_idx").on(t.userId, t.createdAt),
  assetIdx: index("meal_image_recovery_jobs_asset_idx").on(t.savedMealId, t.assetId),
}));