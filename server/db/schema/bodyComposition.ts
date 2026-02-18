import { pgTable, serial, varchar, timestamp, numeric, text, index, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scanMethodEnum = pgEnum("scan_method", [
  "DEXA",
  "BodPod",
  "Calipers",
  "Smart Scale",
  "Other"
]);

export const bodyFatSourceEnum = pgEnum("body_fat_source", [
  "client",
  "trainer",
  "physician"
]);

export const bodyFatEntries = pgTable("body_fat_entries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  currentBodyFatPct: numeric("current_body_fat_pct", { precision: 5, scale: 2 }).notNull(),
  goalBodyFatPct: numeric("goal_body_fat_pct", { precision: 5, scale: 2 }),
  scanMethod: scanMethodEnum("scan_method").notNull(),
  source: bodyFatSourceEnum("source").notNull().default("client"),
  createdById: varchar("created_by_id"),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index("body_fat_user_idx").on(t.userId, t.recordedAt),
}));

export const insertBodyFatSchema = createInsertSchema(bodyFatEntries, {
  currentBodyFatPct: z.string().or(z.number()),
  goalBodyFatPct: z.string().or(z.number()).optional().nullable(),
  scanMethod: z.enum(["DEXA", "BodPod", "Calipers", "Smart Scale", "Other"]),
  source: z.enum(["client", "trainer", "physician"]).optional(),
  createdById: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  recordedAt: z.string().or(z.date()),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBodyFatEntry = z.infer<typeof insertBodyFatSchema>;
export type BodyFatEntry = typeof bodyFatEntries.$inferSelect;
