
import { pgTable, uuid, text, timestamp, integer, numeric, jsonb, index, varchar } from "drizzle-orm/pg-core";

export const mealBoards = pgTable("meal_boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  program: text("program").notNull(), // 'glp1' | 'smart' | 'medical' | 'diabetic' | 'athlete'
  title: text("title").notNull().default("Weekly Meal Board"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  days: integer("days").notNull().default(7),
  lastUpdatedByUserId: varchar("last_updated_by_user_id", { length: 64 }),
  lastUpdatedByRole: varchar("last_updated_by_role", { length: 32 }), // 'client' | 'trainer' | 'physician'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index("meal_boards_user_idx").on(t.userId, t.program, t.startDate),
}));

export const mealBoardItems = pgTable("meal_board_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  boardId: uuid("board_id").notNull(),
  dayIndex: integer("day_index").notNull(),
  slot: text("slot").notNull(),
  mealId: uuid("meal_id").notNull(),
  title: text("title").notNull(),
  servings: numeric("servings", { precision: 6, scale: 2 }).notNull().default("1"),
  macros: jsonb("macros").notNull(),
  ingredients: jsonb("ingredients").$type<Array<{name:string; qty:string}>>().notNull().default('[]' as any),
  /**
   * Stores the full original meal JSON before a refinement swap.
   * Set on the NEW item at confirm time so the restore path can recover
   * the exact pre-swap state. Null on items that were never refined.
   */
  originalMealSnapshot: jsonb("original_meal_snapshot").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
