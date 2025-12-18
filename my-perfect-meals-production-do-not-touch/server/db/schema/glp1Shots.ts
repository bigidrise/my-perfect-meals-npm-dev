
import { pgTable, uuid, varchar, timestamp, numeric, text, index, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Injection site location enum
export const injectionLocationEnum = pgEnum("injection_location", [
  "abdomen",
  "thigh",
  "upper_arm",
  "buttock"
]);

export const glp1Shots = pgTable("glp1_shots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull(),
  dateUtc: timestamp("date_utc", { withTimezone: true }).notNull(),
  doseMg: numeric("dose_mg", { precision: 10, scale: 2 }).notNull(),
  location: injectionLocationEnum("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index("glp1_shots_user_idx").on(t.userId, t.dateUtc),
}));

// Zod schemas and types
export const insertGlp1ShotSchema = createInsertSchema(glp1Shots, {
  dateUtc: z.string().or(z.date()),
  doseMg: z.string().or(z.number()),
  location: z.enum(["abdomen", "thigh", "upper_arm", "buttock"]).optional(),
  notes: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGlp1Shot = z.infer<typeof insertGlp1ShotSchema>;
export type Glp1Shot = typeof glp1Shots.$inferSelect;
