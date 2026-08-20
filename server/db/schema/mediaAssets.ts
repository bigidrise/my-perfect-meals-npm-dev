// server/db/schema/mediaAssets.ts
// Canonical media_assets table — stores image variant metadata and Object Storage keys.
// Postgres stores ONLY metadata/references. Bytes always live in Object Storage.

import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** pending | ready | failed */
  status: text("status").notNull().default("pending"),
  /**
   * Delivery validation is intentionally separate from processing status.
   * A URL can be uploaded successfully (`status: ready`) but still be
   * unvalidated in a browser until it has been delivered successfully.
   */
  validationStatus: text("validation_status").default("unvalidated"),

  // ── Thumbnail variant (~400 px wide, JPEG 82%) — used in all card/list views ──
  thumbnailObjectKey: text("thumbnail_object_key"),
  thumbnailUrl: text("thumbnail_url"),

  // ── Display variant (~1000 px wide, JPEG 88%) — used in detail / Chef's Kitchen ──
  displayObjectKey: text("display_object_key"),
  displayUrl: text("display_url"),

  // ── Original — retained, never delivered to normal client views ──
  originalObjectKey: text("original_object_key"),

  // ── Provenance ──
  /** base64 | url | object-storage | s3 | legacy | none */
  sourceType: text("source_type"),
  mimeType: text("mime_type").default("image/png"),

  // ── Failure / retry ──
  processingError: text("processing_error"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MediaAssetRecord = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
