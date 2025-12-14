import { pgTable, uuid, varchar, numeric, boolean, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const avatarState = pgTable("avatar_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  
  // Core body composition & status
  weightLbs: numeric("weight_lbs").notNull().default("185"),
  bodyFatPct: numeric("body_fat_pct").notNull().default("28"),
  muscleMassLbs: numeric("muscle_mass_lbs").notNull().default("70"),
  energy: numeric("energy").notNull().default("60"), // 0–100
  mood: numeric("mood").notNull().default("60"),     // 0–100
  lifestyleScore: numeric("lifestyle_score").notNull().default("60"), // sleep/alcohol/stress blend 0–100

  // Visual stage for MVP (maps to art/morphs)
  visualStage: varchar("visual_stage", { length: 16 }).notNull().default("average"), // "fit" | "average" | "overweight"

  // Last tick date (YYYY-MM-DD)
  lastSimDate: varchar("last_sim_date", { length: 10 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const avatarDay = pgTable("avatar_day", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  dateKey: varchar("date_key", { length: 10 }).notNull(), // YYYY-MM-DD

  // Inputs for the day (0–100 scoring)
  nutritionScore: numeric("nutrition_score").notNull().default("50"),
  trainingScore: numeric("training_score").notNull().default("0"),
  lifestyleScore: numeric("lifestyle_score").notNull().default("50"),

  // Optional source linkage (meal plan id, workout id, etc.)
  meta: jsonb("meta").$type<Record<string, any>>().notNull().default({}),

  // Rolled results (snapshot after tick)
  weightLbs: numeric("weight_lbs"),
  bodyFatPct: numeric("body_fat_pct"),
  muscleMassLbs: numeric("muscle_mass_lbs"),
  energy: numeric("energy"),
  mood: numeric("mood"),
  visualStage: varchar("visual_stage", { length: 16 })
});

// Zod schemas
export const insertAvatarStateSchema = createInsertSchema(avatarState).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertAvatarDaySchema = createInsertSchema(avatarDay).omit({
  id: true
});

export type AvatarState = typeof avatarState.$inferSelect;
export type AvatarDay = typeof avatarDay.$inferSelect;
export type InsertAvatarState = z.infer<typeof insertAvatarStateSchema>;
export type InsertAvatarDay = z.infer<typeof insertAvatarDaySchema>;