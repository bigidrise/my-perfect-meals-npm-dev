import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const restaurantGuideSessions = pgTable("restaurant_guide_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  restaurantName: text("restaurant_name").notNull(),
  restaurantInfo: jsonb("restaurant_info"),
  craving: text("craving"),
  cuisine: text("cuisine"),
  zipCode: varchar("zip_code", { length: 10 }),
  meals: jsonb("meals").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index("restaurant_guide_sessions_user_idx").on(t.userId),
  userTimeIdx: index("restaurant_guide_sessions_user_time_idx").on(t.userId, t.generatedAt),
}));
