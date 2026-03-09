import { pgTable, varchar, integer, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const aiUsage = pgTable("ai_usage", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  feature: varchar("feature", { length: 100 }).notNull(),
  usageDate: date("usage_date").notNull().default(sql`CURRENT_DATE`),
  count: integer("count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at").notNull().default(sql`NOW()`),
}, (table) => [
  uniqueIndex("ai_usage_user_feature_date_idx").on(table.userId, table.feature, table.usageDate),
]);
