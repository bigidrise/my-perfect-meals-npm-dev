import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creatorStatusEnum = pgEnum("creator_status", [
  "not_started",
  "invited",
  "intake_submitted",
  "active",
  "rejected",
]);

export const creatorTierEnum = pgEnum("creator_tier", [
  "self_serve",
  "gifted",
]);

export const creators = pgTable("creators", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  displayName: text("display_name").notNull(),
  type: varchar("type", { length: 40 }).notNull().default("chef"),
  status: creatorStatusEnum("status").notNull().default("not_started"),
  tier: creatorTierEnum("tier").notNull().default("self_serve"),
  isActive: boolean("is_active").notNull().default(false),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Creator = typeof creators.$inferSelect;
export type InsertCreator = typeof creators.$inferInsert;
