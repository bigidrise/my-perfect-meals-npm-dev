
import { pgTable, uuid, text, jsonb, timestamp, smallint, uniqueIndex } from "drizzle-orm/pg-core";

export const builderPlans = pgTable("builder_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  builderKey: text("builder_key").notNull(), // 'diabetic' | 'smart' | 'specialty' | 'medical' | 'glp1'
  days: smallint("days").notNull().default(1), // 1..7
  plan: jsonb("plan").notNull(),             // see BuilderPlanJSON below
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("builder_plans_user_key").on(t.userId, t.builderKey),
}));

// ---- Shared types
export type PlanDay = {
  dayIndex: number; // 0..6
  lists: { breakfast: any[]; lunch: any[]; dinner: any[]; snacks: any[] };
  totals?: { calories: number; protein: number; carbs: number; fat: number };
};

export type BuilderPlanJSON = {
  source: "diabetic" | "smart" | "specialty" | "medical" | "glp1";
  days: PlanDay[];
  createdAtISO: string;
  targets?: { calories?: number; protein?: number; carbs?: number; fat?: number };
};
