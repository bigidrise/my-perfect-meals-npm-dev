import { pgTable, uuid, text, integer, real, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Biometric source tracking (which devices/providers are connected)
export const biometricSource = pgTable("biometric_source", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),       // "apple_health", "health_connect", "fitbit", "garmin", "oura", "whoop"
  scopeHash: text("scope_hash").notNull(),    // hash of granted metric list
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byUser: index("idx_bio_src_user").on(t.userId),
}));

// Individual biometric data points
export const biometricSample = pgTable("biometric_sample", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  deviceId: text("device_id"),
  type: text("type").notNull(),               // "steps" | "heart_rate" | "weight" | "waist_circumference"
  value: real("value").notNull(),             // steps (int), bpm, kg, in, cm
  unit: text("unit").notNull(),               // "count" | "bpm" | "kg" | "lb" | "in" | "cm"
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  sourceRecordId: text("source_record_id"),   // to dedupe
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byUserTime: index("idx_bio_user_time").on(t.userId, t.startTime),
}));

// Zod schemas for validation
export const allowedTypes = ["steps", "heart_rate", "weight", "waist_circumference"] as const;

export const biometricPayloadSchema = z.object({
  userId: z.string().min(1),
  provider: z.string().min(1),
  deviceId: z.string().optional(),
  samples: z.array(z.object({
    type: z.enum(allowedTypes),
    value: z.number(),             // steps as number, hr bpm, weight kg, waist in/cm
    unit: z.enum(["count", "bpm", "kg", "lb", "in", "cm"]),
    startTime: z.string(),         // ISO
    endTime: z.string(),           // ISO
    sourceRecordId: z.string().optional(),
  })),
});

export const biometricSourceInsertSchema = createInsertSchema(biometricSource);
export const biometricSampleInsertSchema = createInsertSchema(biometricSample);

export type BiometricPayload = z.infer<typeof biometricPayloadSchema>;
export type BiometricSource = typeof biometricSource.$inferSelect;
export type BiometricSample = typeof biometricSample.$inferSelect;
export type BiometricSourceInsert = z.infer<typeof biometricSourceInsertSchema>;
export type BiometricSampleInsert = z.infer<typeof biometricSampleInsertSchema>;

export const lockedDays = pgTable("locked_days", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  dateISO: text("date_iso").notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }).defaultNow().notNull(),
  targets: jsonb("targets").notNull().$type<{
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>(),
  consumed: jsonb("consumed").notNull().$type<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>(),
  slots: jsonb("slots").notNull().$type<{
    breakfast: { count: number; calories: number; protein: number; carbs: number; fat: number };
    lunch: { count: number; calories: number; protein: number; carbs: number; fat: number };
    dinner: { count: number; calories: number; protein: number; carbs: number; fat: number };
    snacks: { count: number; calories: number; protein: number; carbs: number; fat: number };
  }>(),
}, (t) => ({
  byUser: index("idx_locked_days_user").on(t.userId),
  byUserDate: index("idx_locked_days_user_date").on(t.userId, t.dateISO),
}));

export const lockedDayInsertSchema = createInsertSchema(lockedDays);
export type LockedDay = typeof lockedDays.$inferSelect;
export type LockedDayInsert = typeof lockedDays.$inferInsert;