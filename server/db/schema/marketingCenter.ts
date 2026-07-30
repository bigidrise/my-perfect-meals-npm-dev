import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  monthKey: text("month_key").notNull().unique(), // e.g. '2026-08'
  status: text("status").notNull().default("draft"), // draft | published | archived
  audienceModes: text("audience_modes").array().notNull().default([]),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const marketingAssets = pgTable("marketing_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull(),
  assetType: text("asset_type").notNull().default("other"),
  label: text("label"),
  filename: text("filename").notNull(),
  objectKey: text("object_key").notNull().default(""),
  mimeType: text("mime_type"),
  byteSize: integer("byte_size"),
  // null  = file download;  non-null = copy-paste text block (no object stored)
  captionText: text("caption_text"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = typeof marketingCampaigns.$inferInsert;
export type MarketingAsset = typeof marketingAssets.$inferSelect;
export type InsertMarketingAsset = typeof marketingAssets.$inferInsert;

export const ASSET_TYPES = [
  "instagram_post",
  "instagram_story",
  "facebook",
  "linkedin",
  "youtube",
  "podcast",
  "flyer",
  "poster",
  "email",
  "sms",
  "blog",
  "video",
  "presentation",
  "press_kit",
  "caption",
  "script",
  "other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<string, string> = {
  instagram_post: "Instagram Post",
  instagram_story: "Instagram Story",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  podcast: "Podcast",
  flyer: "Flyer",
  poster: "Poster",
  email: "Email Copy",
  sms: "SMS / Text",
  blog: "Blog",
  video: "Video",
  presentation: "Presentation",
  press_kit: "Press Kit",
  caption: "Caption",
  script: "Script",
  other: "Other",
};
