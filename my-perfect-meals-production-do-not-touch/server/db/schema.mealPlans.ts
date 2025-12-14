import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const weeklyMealPlans = pgTable("weekly_meal_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  planData: jsonb("plan_data").notNull(), // Store the complete meal plan as JSON
  weekStartDate: text("week_start_date").notNull(), // e.g., "2025-01-13"
  weekEndDate: text("week_end_date").notNull(), // e.g., "2025-01-19"
  mealCount: integer("meal_count").notNull().default(0), // Total number of meals in the plan
  source: text("source").notNull().default("ai_meal_creator"), // "ai_meal_creator", "weekly_calendar", etc.
  isActive: integer("is_active").notNull().default(1), // 1 = active plan, 0 = archived
  createdAt: timestamp("created_at").defaultNow().notNull(),
});