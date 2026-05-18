import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const signatureItemKindEnum = pgEnum("signature_item_kind", [
  "dish",
  "sauce",
  "beverage",
  "snack",
  "recipe",
]);

// ─── chef_signature_items ────────────────────────────────────────────────────
// The chef's curated catalog: real dishes, sauces, beverages, snacks.
// This becomes both the visible library AND the AI's style reference (Phase 2).

export const chefSignatureItems = pgTable("chef_signature_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: uuid("creator_id").notNull(),
  kind: signatureItemKindEnum("kind").notNull().default("dish"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  mediaUrl: text("media_url"),
  tags: jsonb("tags").$type<string[]>().default([]),
  techniques: jsonb("techniques").$type<string[]>().default([]),
  ingredients: jsonb("ingredients").$type<string[]>().default([]),
  recipeJson: jsonb("recipe_json"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  creatorIdx: index("csi_creator_idx").on(t.creatorId),
  publishedIdx: index("csi_published_idx").on(t.creatorId, t.isPublished),
}));

// ─── chef_signature_collections ──────────────────────────────────────────────
// Curated groupings of items: Meal Prep, Date Night, High Protein, etc.

export const chefSignatureCollections = pgTable("chef_signature_collections", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: uuid("creator_id").notNull(),
  slug: varchar("slug", { length: 80 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  coverMediaUrl: text("cover_media_url"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  creatorIdx: index("csc_creator_idx").on(t.creatorId),
}));

// ─── chef_signature_collection_items ─────────────────────────────────────────
// Join table linking items to collections with ordering.

export const chefSignatureCollectionItems = pgTable("chef_signature_collection_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  collectionId: uuid("collection_id").notNull(),
  itemId: uuid("item_id").notNull(),
  position: integer("position").notNull().default(0),
}, (t) => ({
  collectionIdx: index("csci_collection_idx").on(t.collectionId),
  itemIdx: index("csci_item_idx").on(t.itemId),
}));

export type ChefSignatureItem = typeof chefSignatureItems.$inferSelect;
export type InsertChefSignatureItem = typeof chefSignatureItems.$inferInsert;
export type ChefSignatureCollection = typeof chefSignatureCollections.$inferSelect;
export type InsertChefSignatureCollection = typeof chefSignatureCollections.$inferInsert;
export type ChefSignatureCollectionItem = typeof chefSignatureCollectionItems.$inferSelect;
