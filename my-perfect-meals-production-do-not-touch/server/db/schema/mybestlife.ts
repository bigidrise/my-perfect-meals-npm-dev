import { pgTable, uuid, varchar, numeric, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const mblAvatarState = pgTable("mbl_avatar_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  weightLbs: numeric("weight_lbs").notNull().default("185"),
  bodyFatPct: numeric("body_fat_pct").notNull().default("28"),
  muscleMassLbs: numeric("muscle_mass_lbs").notNull().default("70"),
  energy: numeric("energy").notNull().default("60"),
  mood: numeric("mood").notNull().default("60"),
  lifestyleScore: numeric("lifestyle_score").notNull().default("60"),
  visualStage: varchar("visual_stage", { length: 16 }).notNull().default("average"),
  lastSimDate: varchar("last_sim_date", { length: 10 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (t) => ({
  uq_user: primaryKey({ columns: [t.userId] })
}));

export const mblDayLog = pgTable("mbl_day_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  dateKey: varchar("date_key", { length: 10 }).notNull(), // YYYY-MM-DD
  nutritionScore: numeric("nutrition_score").notNull().default("50"),
  trainingScore: numeric("training_score").notNull().default("0"),
  lifestyleScore: numeric("lifestyle_score").notNull().default("50"),
  mealNames: jsonb("meal_names").$type<string[]>().notNull().default([]),
  workoutName: varchar("workout_name", { length: 128 }).default(""),
  weightLbs: numeric("weight_lbs"),
  bodyFatPct: numeric("body_fat_pct"),
  muscleMassLbs: numeric("muscle_mass_lbs"),
  energy: numeric("energy"),
  mood: numeric("mood"),
  visualStage: varchar("visual_stage", { length: 16 })
});