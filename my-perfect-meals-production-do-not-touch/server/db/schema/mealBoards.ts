
import { pgTable, uuid, text, timestamp, integer, numeric, jsonb, index } from "drizzle-orm/pg-core";

export const mealBoards = pgTable("meal_boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  program: text("program").notNull(), // 'glp1' | 'smart' | 'medical' | 'diabetic' | 'athlete'
  title: text("title").notNull().default("Weekly Meal Board"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  days: integer("days").notNull().default(7),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
