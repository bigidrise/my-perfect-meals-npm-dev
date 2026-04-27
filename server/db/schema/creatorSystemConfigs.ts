import { pgTable, uuid, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creatorSystemConfigs = pgTable("creator_system_configs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: uuid("creator_id").notNull().unique(),
  configJson: jsonb("config_json").notNull(),
  version: integer("version").notNull().default(1),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CreatorSystemConfigRow = typeof creatorSystemConfigs.$inferSelect;
export type InsertCreatorSystemConfig = typeof creatorSystemConfigs.$inferInsert;
