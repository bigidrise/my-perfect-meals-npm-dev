import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const weeklyMealPlans = pgTable("weekly_meal_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  weekStart: varchar("week_start", { length: 10 }).notNull(), // YYYY-MM-DD (Monday)
  planData: jsonb("plan_data").$type<any>().notNull(), // { days:[{date, meals:[...] }], nutrition:{} }
  createdAt: timestamp("created_at").defaultNow()
});

export const insertWeeklyMealPlanSchema = createInsertSchema(weeklyMealPlans).omit({
  id: true,
  createdAt: true
});

export type InsertWeeklyMealPlan = z.infer<typeof insertWeeklyMealPlanSchema>;
export type WeeklyMealPlan = typeof weeklyMealPlans.$inferSelect;