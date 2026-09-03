// server/db/schema/chefSignatureImports.ts
// Drizzle schema for YouTube / manual recipe imports into Chef Signature Library.
// import_status lifecycle: 'draft' → 'needs_review' → 'approved' | 'rejected'
// ownership_confirmed MUST be set by an admin before a parsed item can be published.

import { pgTable, uuid, text, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";

export const chefSignatureImports = pgTable("chef_signature_imports", {
  id:                     uuid("id").primaryKey().defaultRandom(),
  creatorId:              uuid("creator_id").notNull(),
  sourceUrl:              text("source_url").notNull(),
  sourceType:             varchar("source_type", { length: 20 }).notNull().default("youtube"),
  importStatus:           varchar("import_status", { length: 20 }).notNull().default("draft"),
  ownershipConfirmed:     boolean("ownership_confirmed").notNull().default(false),
  ownershipConfirmedBy:   text("ownership_confirmed_by"),
  ownershipConfirmedAt:   timestamp("ownership_confirmed_at", { withTimezone: true }),
  rawTitle:               text("raw_title"),
  rawDescription:         text("raw_description"),
  rawThumbnailUrl:        text("raw_thumbnail_url"),
  rawTranscript:          text("raw_transcript"),
  importRaw:              jsonb("import_raw"),
  parsedItemId:           uuid("parsed_item_id"),
  createdBy:              text("created_by"),
  createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChefSignatureImport = typeof chefSignatureImports.$inferSelect;
export type NewChefSignatureImport = typeof chefSignatureImports.$inferInsert;
