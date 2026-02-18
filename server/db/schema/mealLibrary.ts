import { pgTable, uuid, text, timestamp, integer, jsonb, index, varchar, real, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const studioTypeEnum = pgEnum("studio_type", ["craving", "fridge", "dessert"]);

export const mealLibraryItems = pgTable("meal_library_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  studio: studioTypeEnum("studio").notNull(),
  cuisine: text("cuisine"),
  mealType: text("meal_type").notNull().default("dinner"),
  ingredientsJson: jsonb("ingredients_json").$type<Array<{
    name: string;
    quantity?: string;
    amount?: number;
    unit?: string;
    notes?: string;
  }>>().default(sql`'[]'::jsonb`).notNull(),
  stepsJson: jsonb("steps_json").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  macrosJson: jsonb("macros_json").$type<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
  }>().default(sql`'{}'::jsonb`).notNull(),
  allergenFlagsJson: jsonb("allergen_flags_json").$type<{
    dairy?: boolean;
    shellfish?: boolean;
    peanut?: boolean;
    treeNut?: boolean;
    gluten?: boolean;
    soy?: boolean;
    egg?: boolean;
    fish?: boolean;
    sesame?: boolean;
  }>().default(sql`'{}'::jsonb`).notNull(),
  dietFlagsJson: jsonb("diet_flags_json").$type<{
    glp1?: boolean;
    diabetes?: boolean;
    cardiac?: boolean;
    antiInflammatory?: boolean;
    keto?: boolean;
    lowCarb?: boolean;
    highProtein?: boolean;
    vegetarian?: boolean;
    vegan?: boolean;
  }>().default(sql`'{}'::jsonb`).notNull(),
  cravingTagsJson: jsonb("craving_tags_json").$type<{
    salty?: number;
    sweet?: number;
    crunchy?: number;
    comfort?: number;
    spicy?: number;
    umami?: number;
    fresh?: number;
    creamy?: number;
  }>().default(sql`'{}'::jsonb`).notNull(),
  emotionTagsJson: jsonb("emotion_tags_json").$type<{
    stress?: number;
    tired?: number;
    celebration?: number;
    comfort?: number;
    energized?: number;
  }>().default(sql`'{}'::jsonb`).notNull(),
  searchText: text("search_text"),
  qualityScore: integer("quality_score").notNull().default(50),
  version: integer("version").notNull().default(1),
  servings: integer("servings").notNull().default(2),
  prepMinutes: integer("prep_minutes"),
  cookMinutes: integer("cook_minutes"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  studioIdx: index("meal_library_studio_idx").on(t.studio),
  mealTypeIdx: index("meal_library_meal_type_idx").on(t.mealType),
  qualityIdx: index("meal_library_quality_idx").on(t.qualityScore),
}));

export const mealLibraryUsage = pgTable("meal_library_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealId: uuid("meal_id").notNull().references(() => mealLibraryItems.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 64 }).notNull(),
  servedAt: timestamp("served_at", { withTimezone: true }).defaultNow().notNull(),
  userRating: integer("user_rating"),
  wasSwapped: integer("was_swapped").default(0),
  notes: text("notes"),
}, (t) => ({
  mealIdx: index("meal_library_usage_meal_idx").on(t.mealId),
  userIdx: index("meal_library_usage_user_idx").on(t.userId),
}));

export const mealGenerationJobs = pgTable("meal_generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  studio: studioTypeEnum("studio").notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  requestJson: jsonb("request_json").$type<{
    intentText?: string;
    constraints?: {
      caloriesTarget?: number;
      proteinTarget?: number;
      carbTarget?: number;
      fatTarget?: number;
    };
    diet?: string[];
    allergies?: string[];
    exclusions?: string[];
    servings?: number;
  }>().default(sql`'{}'::jsonb`).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("queued"),
  resultMealId: uuid("result_meal_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  userIdx: index("meal_generation_jobs_user_idx").on(t.userId),
  statusIdx: index("meal_generation_jobs_status_idx").on(t.status),
}));

export type MealLibraryItem = typeof mealLibraryItems.$inferSelect;
export type InsertMealLibraryItem = typeof mealLibraryItems.$inferInsert;
export type MealLibraryUsage = typeof mealLibraryUsage.$inferSelect;
export type MealGenerationJob = typeof mealGenerationJobs.$inferSelect;
