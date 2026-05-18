import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
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

export const creatorSourceEnum = pgEnum("creator_source", [
  "self_serve",
  "admin_created",
]);

export const creatorCategoryEnum = pgEnum("creator_category", [
  "standard_creator",
  "chef_kitchen",
  "supplement_partner",
  "athlete_partner",
]);

export const creators = pgTable("creators", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").unique(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  displayName: text("display_name").notNull(),
  type: varchar("type", { length: 40 }).notNull().default("chef"),
  source: creatorSourceEnum("source").notNull().default("self_serve"),
  creatorCategory: creatorCategoryEnum("creator_category").notNull().default("standard_creator"),
  status: creatorStatusEnum("status").notNull().default("not_started"),
  tier: creatorTierEnum("tier").notNull().default("self_serve"),
  isActive: boolean("is_active").notNull().default(false),
  isVisible: boolean("is_visible").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  displayPriority: integer("display_priority").notNull().default(0),
  bio: text("bio"),
  logoUrl: text("logo_url"),
  heroImageUrl: text("hero_image_url"),
  brandingImageUrl: text("branding_image_url"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Creator = typeof creators.$inferSelect;
export type InsertCreator = typeof creators.$inferInsert;
