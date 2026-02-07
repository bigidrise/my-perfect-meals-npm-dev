// shared/schema/index.ts
import { pgTable, varchar, boolean, serial, integer, timestamp, jsonb, index, uniqueIndex, pgEnum, uuid, text, decimal, real, time, date, numeric, unique, check, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod"

export const macroLogs = pgTable("macro_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  at: timestamp("at", { withTimezone: true }).notNull(), // store UTC
  source: varchar("source", { length: 24 }).notNull().default("quick"), // "quick" | "food" | "recipe"
  // resolved macros on the row for fast/immutable history
  kcal: numeric("kcal").notNull(),
  protein: numeric("protein").notNull(),
  carbs: numeric("carbs").notNull(),
  fat: numeric("fat").notNull(),
  fiber: numeric("fiber").notNull().default("0"),
  alcohol: numeric("alcohol").notNull().default("0"),
  // Starchy/Fibrous carb breakdown
  starchyCarbs: numeric("starchy_carbs").notNull().default("0"),
  fibrousCarbs: numeric("fibrous_carbs").notNull().default("0"),
});

// Re-export biometrics schema (unchanged)
export * from "./biometricsSchema";
export * from "./communitySchema";
export * from "./cookingTutorials";
export * from "./diabetes-schema";
export * from "./fitlife-schema";
// export * from "./mybestlife-schema"; // TEMPORARILY DISABLED - File missing

// New schemas
export { glp1Shots, injectionLocationEnum } from "../server/db/schema/glp1Shots";
export { mealBoards, mealBoardItems } from "../server/db/schema/mealBoards";
export { careTeamMember, careInvite, careAccessCode } from "../server/db/schema/careTeam";
export { builderPlans } from "../server/db/schema/builderPlans";
export { generatedMealsCache } from "../server/db/schema/generatedMeals";
export { studioTypeEnum, mealLibraryItems, mealLibraryUsage, mealGenerationJobs } from "../server/db/schema/mealLibrary";
export type { MealLibraryItem, InsertMealLibraryItem, MealLibraryUsage, MealGenerationJob } from "../server/db/schema/mealLibrary";

export { 
  professionalSpaceTypeEnum, noteTypeEnum, noteVisibilityEnum, activityActionEnum,
  studios, studioBilling, studioMemberships, studioInvites, clientSubscriptions, clientNotes, clientActivityLog 
} from "../server/db/schema/studio";
export type { 
  Studio, InsertStudio, StudioBilling, InsertStudioBilling, 
  StudioMembership, InsertStudioMembership, StudioInvite, InsertStudioInvite,
  ClientSubscription, InsertClientSubscription, ClientNote, InsertClientNote,
  ClientActivityLog, InsertClientActivityLog 
} from "../server/db/schema/studio";

/**
 * Games table
 * - id: e.g. "nutrition-trivia", "macro-quiz"
 * - name: display name
 * - version: semantic version of the game build/content
 * - isActive: toggle visibility/availability
 */
export const games = pgTable("games", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  version: varchar("version", { length: 20 }).default("1.0.0"),
  isActive: boolean("is_active").default(true),
});

// -------- Zod + Types --------

// Insert schema (what your app can insert)
export const insertGameSchema = createInsertSchema(games, {
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});

// Optional: a “safe output” schema if you return rows via API
export const gameSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  isActive: z.boolean(),
});

// TypeScript helpers
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = z.infer<typeof gameSchema>;

// ========================================
// Family Recipes Schema
// ========================================

export const familyRecipes = pgTable("family_recipes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  title: text("title").notNull(),
  story: text("story"),
  servings: integer("servings").notNull().default(4),
  imageUrl: text("image_url"),
  dietaryTags: jsonb("dietary_tags").$type<string[]>().default(sql`'[]'::jsonb`),
  allergens: jsonb("allergens").$type<string[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ========================================
// Meal Templates Schema
// ========================================

/** Root meal template */
export const mealTemplates = pgTable("meal_templates", {
  id: varchar("id", { length: 50 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }), // optional: if templates are per-user; null for global
  name: text("name").notNull(),
  servings: integer("servings"),
  prepMinutes: integer("prep_minutes"),
  cookMinutes: integer("cook_minutes"),
  notes: text("notes"),
  meta: jsonb("meta").default(sql`'{}'::jsonb`),
  isPublic: boolean("is_public").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Normalized ingredients */
export const mealTemplateIngredients = pgTable("meal_template_ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: varchar("template_id", { length: 50 }).notNull().references(() => mealTemplates.id, { onDelete: "cascade" }),
  quantity: text("quantity"),     // e.g. "1", "1/2", "200"
  unit: text("unit"),             // e.g. "cup", "g", "tbsp"
  name: text("name").notNull(),   // e.g. "chicken breast"
  notes: text("notes"),           // e.g. "diced"
  position: integer("position").default(0).notNull(),
});

/** Ordered instructions (one step per row) */
export const mealTemplateInstructions = pgTable("meal_template_instructions", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: varchar("template_id", { length: 50 }).notNull().references(() => mealTemplates.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(), // 1,2,3…
  text: text("text").notNull(),
});

export const familyRecipeIngredients = pgTable("family_recipe_ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipeId: uuid("recipe_id").notNull().references(() => familyRecipes.id, { onDelete: "cascade" }),
  qty: numeric("qty").notNull(),
  unit: text("unit").notNull(),
  item: text("item").notNull(),
  notes: text("notes"),
  sortIdx: integer("sort_idx").default(0),
});

export const familyRecipeSteps = pgTable("family_recipe_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipeId: uuid("recipe_id").notNull().references(() => familyRecipes.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  sortIdx: integer("sort_idx").default(0),
});

export const familyRecipeNutrition = pgTable("family_recipe_nutrition", {
  recipeId: uuid("recipe_id").primaryKey().references(() => familyRecipes.id, { onDelete: "cascade" }),
  calories: integer("calories").notNull(),
  protein: numeric("protein_g").notNull(),
  carbs: numeric("carbs_g").notNull(),
  fat: numeric("fat_g").notNull(),
  fiber: numeric("fiber_g").notNull().default("0"),
  sodium: numeric("sodium_mg").notNull().default("0"),
  badges: jsonb("badges").$type<string[]>().default(sql`'[]'::jsonb`),
});

// Family Recipe Types
export const insertFamilyRecipeSchema = createInsertSchema(familyRecipes);
export type InsertFamilyRecipe = z.infer<typeof insertFamilyRecipeSchema>;
export type FamilyRecipe = typeof familyRecipes.$inferSelect;
export type FamilyRecipeIngredient = typeof familyRecipeIngredients.$inferSelect;
export type FamilyRecipeStep = typeof familyRecipeSteps.$inferSelect;
export type FamilyRecipeNutrition = typeof familyRecipeNutrition.$inferSelect;

export const gameScores = pgTable("game_scores", {
  id: serial("id").primaryKey(),
  gameId: varchar("game_id", { length: 50 }).notNull(),
  userId: varchar("user_id", { length: 50 }).notNull(),
  userAlias: varchar("user_alias", { length: 60 }).notNull(), // display name/alias
  score: integer("score").notNull(),
  durationMs: integer("duration_ms").default(0), // optional: game session length
  meta: jsonb("meta"), // additional game data
  achievedAt: timestamp("achieved_at", { withTimezone: true }).defaultNow(),
  periodDay: varchar("period_day", { length: 10 }),   // YYYY-MM-DD for daily
  periodWeek: varchar("period_week", { length: 8 }),  // YYYY-WW (ISO week)
  periodYear: varchar("period_year", { length: 4 }),  // YYYY
}, (t) => ({
  gameIdx: index("idx_scores_game").on(t.gameId),
  userIdx: index("idx_scores_user").on(t.userId),
  dayIdx: index("idx_scores_day").on(t.gameId, t.periodDay),
  weekIdx: index("idx_scores_week").on(t.gameId, t.periodWeek),
}));

export const gameLeader = pgTable("game_leader", {
  id: serial("id").primaryKey(),
  gameId: varchar("game_id", { length: 50 }).notNull(),
  userId: varchar("user_id", { length: 50 }).notNull(),
  userAlias: varchar("user_alias", { length: 60 }).notNull(),
  scope: varchar("scope", { length: 10 }).notNull(), // "all", "week", "day"
  scopeKey: varchar("scope_key", { length: 16 }).notNull().default(""), // "" for all-time, "YYYY-WW" or "YYYY-MM-DD"
  bestScore: integer("best_score").notNull(),
  bestAt: timestamp("best_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  uqLeader: uniqueIndex("uq_game_leader_scope").on(t.gameId, t.userId, t.scope, t.scopeKey),
  gameIdx: index("idx_leader_game").on(t.gameId, t.scope, t.scopeKey),
}));

// Diabetes Support Enums
export const diabetesTypeEnum = pgEnum("diabetes_type", ["NONE", "T1D", "T2D"]);
export const glucoseContextEnum = pgEnum("glucose_context", [
  "FASTED",
  "PRE_MEAL",
  "POST_MEAL_1H",
  "POST_MEAL_2H",
  "RANDOM",
]);

// Onboarding Progress Table
export const onboardingProgress = pgTable("onboarding_progress", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  deviceId: text("device_id"),
  userId: text("user_id"),
  stepKey: text("step_key").notNull(),
  data: jsonb("data").notNull().$type<Record<string, any>>().default({}),
  completed: boolean("completed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  plan: text("plan").notNull().default("basic"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  nickname: text("nickname"),
  age: integer("age"),
  height: integer("height"), // in cm
  weight: integer("weight"), // in kg
  activityLevel: text("activity_level"), // sedentary, lightly_active, moderately_active, very_active, extremely_active
  bodyType: text("body_type"), // ectomorph, mesomorph, endomorph
  birthday: text("birthday"), // Format: "MM-DD" or "YYYY-MM-DD"
  fitnessGoal: text("fitness_goal"), // weight_loss, muscle_gain, maintenance, endurance
  dailyCalorieTarget: integer("daily_calorie_target"),
  dailyProteinTarget: integer("daily_protein_target"),
  dailyCarbsTarget: integer("daily_carbs_target"),
  dailyFatTarget: integer("daily_fat_target"),
  dietaryRestrictions: text("dietary_restrictions").array().default(sql`ARRAY[]::text[]`),
  healthConditions: text("health_conditions").array().default(sql`ARRAY[]::text[]`),
  allergies: text("allergies").array().default(sql`ARRAY[]::text[]`),
  dislikedFoods: text("disliked_foods").array().default(sql`ARRAY[]::text[]`),
  likedFoods: text("liked_foods").array().default(sql`ARRAY[]::text[]`),
  avoidedFoods: text("avoided_foods").array().default(sql`ARRAY[]::text[]`),
  preferredSweeteners: text("preferred_sweeteners").array().default(sql`ARRAY[]::text[]`),
  avoidSweeteners: text("avoid_sweeteners").array().default(sql`ARRAY[]::text[]`),
  subscriptionPlan: text("subscription_plan").default("basic"), // basic, premium, ultimate
  subscriptionStatus: text("subscription_status").default("active"), // active, cancelled, expired
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  // Stripe subscription fields
  planLookupKey: varchar("plan_lookup_key", { length: 100 }), // Stripe price lookup_key (e.g., "mpm_basic_monthly")
  entitlements: text("entitlements").array().default(sql`ARRAY[]::text[]`), // Feature entitlements array
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }), // Stripe customer ID
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }), // Stripe subscription ID
  autoGenerateWeeklyPlan: boolean("auto_generate_weekly_plan").default(true), // auto-generate new 7-day plans
  // Enhanced notification system fields
  timezone: text("timezone").default("America/Chicago"),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").default(false),
  smsOptIn: boolean("sms_opt_in").default(false),
  pushTokens: jsonb("push_tokens").default(sql`'[]'::jsonb`),
  notifyQuietStart: time("notify_quiet_start").default("22:00"),
  notifyQuietEnd: time("notify_quiet_end").default("06:00"),
  // New comprehensive notification preferences
  notificationsEnabled: boolean("notifications_enabled").default(false),
  notificationChannels: text("notification_channels").array().default(sql`ARRAY['sms']::text[]`), // ['sms', 'push', 'email']
  notificationDefaultLeadTimeMin: integer("notification_default_lead_time_min").default(30),
  fcmWebPushToken: text("fcm_web_push_token"),
  createdAt: timestamp("created_at").defaultNow(),
  // AI Voice & Journaling prefs
  voiceEnabled: boolean("voice_enabled").notNull().default(true),
  journalingEnabled: boolean("journaling_enabled").notNull().default(false),
  dailyJournalReminderEnabled: boolean("daily_journal_reminder_enabled").notNull().default(false),
  dailyJournalReminderTime: varchar("daily_journal_reminder_time", { length: 5 }) // "HH:mm" 24h
    .default("09:00"),
  dailyJournalReminderChannel: varchar("daily_journal_reminder_channel", { length: 16 }) // 'sms' | 'push' | 'in-app'
    .default("sms"),
  // A/B testing for meal planning
  mealPlanVariant: text("meal_plan_variant").$type<"A"|"B"|"AUTO">().notNull().default("AUTO"),
  // Password reset tokens
  resetTokenHash: text("reset_token_hash"),
  resetTokenExpires: timestamp("reset_token_expires", { withTimezone: true }),
  // Trial + Meal Builder Selection (Paywall system)
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  selectedMealBuilder: text("selected_meal_builder"), // weekly, diabetic, glp1, anti_inflammatory
  isTester: boolean("is_tester").default(false), // Testers bypass trial expiration (coaches, doctors, beta users)
  // Token-based authentication (secure alternative to session)
  authToken: text("auth_token").unique(), // 256-bit random token for API authentication
  authTokenCreatedAt: timestamp("auth_token_created_at", { withTimezone: true }),
  profilePhotoUrl: text("profile_photo_url"), // URL to user's profile photo in object storage
  // Role-based access control for Pro Care
  role: text("role").$type<"admin"|"coach"|"client">().notNull().default("client"), // admin = full access, coach = Pro Care tools, client = assigned board only
  isProCare: boolean("is_pro_care").default(false), // true if user is managed by a coach
  activeBoard: text("active_board"), // assigned meal builder for Pro Care clients (null = locked state)
  // Extended Onboarding System
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }), // null = onboarding not complete
  macrosDefined: boolean("macros_defined").default(false), // true when user has set macro targets
  starchPlanDefined: boolean("starch_plan_defined").default(false), // true when starch strategy is set
  onboardingMode: text("onboarding_mode").$type<"independent"|"procare">().default("independent"), // how user was onboarded
  // MPM SafetyGuard PIN System
  safetyPinHash: text("safety_pin_hash"), // bcrypt hash of 4-6 digit Safety PIN
  safetyPinSetAt: timestamp("safety_pin_set_at", { withTimezone: true }), // when PIN was created/changed
  // Palate Profile - flavor preferences for meal seasoning (does not affect macros)
  palateSpiceTolerance: text("palate_spice_tolerance").$type<"none"|"mild"|"medium"|"hot">().default("mild"),
  palateSeasoningIntensity: text("palate_seasoning_intensity").$type<"light"|"balanced"|"bold">().default("balanced"),
  palateFlavorStyle: text("palate_flavor_style").$type<"classic"|"herb"|"savory"|"bright">().default("classic"),
  // Display Preferences - accessibility settings
  fontSizePreference: text("font_size_preference").$type<"standard"|"large"|"xl">().default("standard"),
  // ProCare Professional Onboarding - Phase 1
  professionalRole: text("professional_role").$type<"trainer"|"physician">(),
  professionalCategory: text("professional_category").$type<"certified"|"experienced"|"non_certified">(),
  credentialType: text("credential_type"), // e.g. "Personal Trainer", "Physician", "Dietitian"
  credentialBody: text("credential_body"), // e.g. "NASM", "ACE", license state
  credentialNumber: text("credential_number"), // optional license/cert number
  credentialYear: text("credential_year"), // year obtained
  attestationText: text("attestation_text"), // version of attestation they agreed to
  attestedAt: timestamp("attested_at", { withTimezone: true }), // when attestation was accepted
  procareEntryPath: text("procare_entry_path").$type<"certified"|"experienced"|"non_certified">(), // which path they chose
}, (t) => ({
  resetTokenIdx: index("idx_reset_token_lookup").on(t.resetTokenHash, t.resetTokenExpires),
  authTokenIdx: uniqueIndex("idx_auth_token_lookup").on(t.authToken),
}));

// Pantry Items for Fridge Rescue
export const pantryItems = pgTable("pantry_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  qty: real("qty").default(1),
  unit: text("unit").default("unit"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// MPM SafetyGuard Override Audit Logs
export const safetyOverrideAuditLogs = pgTable("safety_override_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  mealRequest: text("meal_request").notNull(), // what the user requested
  allergenTriggered: text("allergen_triggered").notNull(), // which allergen was overridden
  safetyMode: text("safety_mode").$type<"CUSTOM_AUTHENTICATED">().notNull(), // always CUSTOM_AUTHENTICATED for overrides
  builderId: text("builder_id"), // which meal builder was used (craving, dessert, fridge-rescue, etc.)
  overrideReason: text("override_reason"), // optional user-provided reason
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index("idx_safety_override_user").on(t.userId),
  createdAtIdx: index("idx_safety_override_created").on(t.createdAt),
}));

// Builder Switch Limit System - Track meal builder changes (3 per 12 months)
export const builderSwitchHistory = pgTable("builder_switch_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fromBuilder: text("from_builder"), // null if first selection
  toBuilder: text("to_builder").notNull(), // weekly, diabetic, glp1, anti_inflammatory, beach_body, etc.
  switchedAt: timestamp("switched_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index("idx_builder_switch_user").on(t.userId),
  switchedAtIdx: index("idx_builder_switch_date").on(t.switchedAt),
}));

export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  prepTime: integer("prep_time"), // in minutes
  cookTime: integer("cook_time"), // in minutes
  servings: integer("servings").default(1),
  calories: integer("calories"),
  protein: integer("protein"), // in grams
  carbs: integer("carbs"), // in grams
  fat: integer("fat"), // in grams
  fiber: integer("fiber"), // in grams
  sugar: integer("sugar"), // in grams
  sodium: integer("sodium"), // in mg
  ingredients: jsonb("ingredients").$type<Array<{name: string, amount: string, unit: string}>>(),
  instructions: text("instructions").array(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  mealType: text("meal_type"), // breakfast, lunch, dinner, snack
  servingSize: text("serving_size"), // e.g. "1 serving (12-inch pizza)"
  dietaryRestrictions: text("dietary_restrictions").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mealPlans = pgTable("meal_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  weekOf: timestamp("week_of").notNull(),
  planType: text("plan_type").default("standard").notNull(), // "standard" | "athlete"
  meals: jsonb("meals").$type<{
    [day: string]: {
      breakfast?: string,
      lunch?: string,
      dinner?: string,
      snacks?: string[]
    }
  }>(),
  totalCalories: integer("total_calories"),
  totalProtein: integer("total_protein"),
  totalCarbs: integer("total_carbs"),
  totalFat: integer("total_fat"),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mealLog = pgTable("meal_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  recipeId: varchar("recipe_id").references(() => recipes.id).notNull(),
  date: timestamp("date").notNull(),
  mealType: text("meal_type").notNull(), // breakfast, lunch, dinner, snack
  servings: integer("servings").default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userGlycemicSettings = pgTable("user_glycemic_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  bloodGlucose: integer("blood_glucose"),
  preferredCarbs: text("preferred_carbs").array().default(sql`ARRAY[]::text[]`),
  defaultPortion: integer("default_portion").default(100), // stored as integer (100 = 1.0 cups)
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Water Logs table
export const waterLogs = pgTable(
  "water_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id").references(() => users.id).notNull(),
    // store mL for accuracy, show oz/cups in UI as needed
    amountMl: integer("amount_ml").notNull(),
    unit: text("unit").notNull().default("ml"), // "ml" | "oz" | "cup" (UI reference)
    intakeTime: timestamp("intake_time", { withTimezone: false }).notNull(), // when they said they drank
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    byUserCreated: index("water_logs_user_created_idx").on(t.userId, t.createdAt),
    byUserIntake: index("water_logs_user_intake_idx").on(t.userId, t.intakeTime),
  })
);

export const mealReminders = pgTable("meal_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  mealPlanId: varchar("meal_plan_id").references(() => mealPlans.id),
  recipeId: varchar("recipe_id").references(() => recipes.id),
  recipeName: text("recipe_name").notNull(),
  scheduledTime: text("scheduled_time").notNull(), // Format: "HH:MM"
  reminderEnabled: boolean("reminder_enabled").default(true),
  mealType: text("meal_type").notNull(), // breakfast, lunch, dinner, snack
  dayOfWeek: integer("day_of_week"), // 0-6 (Sunday-Saturday) for weekly reminders
  timezone: text("timezone").default("UTC"),
  lastSent: timestamp("last_sent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Advanced Meal Storage
export const meals = pgTable("meals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  servings: integer("servings").notNull().default(1),
  imageUrl: text("image_url"),
  source: text("source").notNull(),
  calories: integer("calories").notNull(),
  proteinG: integer("protein_g").notNull(),
  carbsG: integer("carbs_g").notNull(),
  fatG: integer("fat_g").notNull(),
  fiberG: integer("fiber_g"),
  sugarG: integer("sugar_g"),
  compliance: jsonb("compliance").$type<{
    allergiesCleared: boolean;
    medicalCleared: boolean;
    unitsStandardized: boolean;
  }>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealIngredients = pgTable("meal_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealId: uuid("meal_id").references(() => meals.id, { onDelete: "cascade" }).notNull(),
  item: text("item").notNull(),
  amount: text("amount").notNull(), // Store as text to handle decimals
  unit: text("unit").notNull(),
  notes: text("notes"),
});

export const mealInstructions = pgTable("meal_instructions", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealId: uuid("meal_id").references(() => meals.id, { onDelete: "cascade" }).notNull(),
  stepNumber: integer("step_number").notNull(),
  step: text("step").notNull(),
});

// Enhanced Shopping List System with Scope Support
export const shoppingListItems = pgTable("shopping_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Item details
  name: text("name").notNull(),
  quantity: text("quantity").notNull(), // "2", "1.5", etc.
  unit: text("unit"), // "lb", "cups", "oz", etc.
  category: text("category"), // "protein", "produce", "dairy", etc.

  // Scope: determines where this item belongs
  scopeType: text("scope_type").notNull(), // "day" | "week" | "adhoc"
  scopeKey: text("scope_key").notNull(), // "2025-10-03" | "2025-10-06" | "inbox"

  // Metadata
  sourceBuilder: text("source_builder"), // "smart_menu" | "glp1" | "diabetic" | "weekly_board" | "craving"
  checked: boolean("checked").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  // Index for efficient querying by user and scope
  userScopeIdx: index("shopping_list_user_scope_idx").on(t.userId, t.scopeType, t.scopeKey),
}))

// Mental health support conversations
export const mentalHealthConversations = pgTable("mental_health_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  question: text("question").notNull(),
  aiResponse: text("ai_response").notNull(),
  context: text("context"), // mens-health or womens-health
  mood: text("mood"), // extracted from question tone
  topics: text("topics").array().default(sql`ARRAY[]::text[]`), // stress, work, relationships, etc
  followUp: boolean("follow_up").default(false), // is this a follow-up to previous conversation
  previousConversationId: varchar("previous_conversation_id"),
  userSatisfaction: integer("user_satisfaction"), // 1-5 rating if provided
  createdAt: timestamp("created_at").defaultNow(),
});

// Weekly Plans - stores the current weekly plan per user with rolling dates
export const weeklyPlans = pgTable("weekly_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planJson: jsonb("plan_json").notNull(),         // { meals: FullMeal[] }
  lastParams: jsonb("last_params").notNull(),     // what was used to generate (days, structure, overrides)
  planStartDate: timestamp("plan_start_date", { withTimezone: true }).notNull(), // when this 7-day plan starts
  planEndDate: timestamp("plan_end_date", { withTimezone: true }).notNull(),     // when this 7-day plan ends
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  userUnique: unique().on(t.userId),              // 1 plan per user
}));

// Notification System Tables
export const mealSchedule = pgTable("meal_schedule", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  breakfastAt: time("breakfast_at"),
  lunchAt: time("lunch_at"),
  dinnerAt: time("dinner_at"),
  snackTimes: jsonb("snack_times").default(sql`'[]'::jsonb`), // ["10:30","15:00"]
  notifyBreakfast: boolean("notify_breakfast").default(true),
  notifyLunch: boolean("notify_lunch").default(true),
  notifyDinner: boolean("notify_dinner").default(true),
  notifySnacks: boolean("notify_snacks").default(true),
}, (t) => ({
  userDateUnique: unique().on(t.userId, t.date),
}));

export const notificationJobs = pgTable("notification_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slot: text("slot").notNull(), // e.g. "breakfast","lunch","dinner","snack"
  fireAtUtc: timestamp("fire_at_utc", { withTimezone: true }).notNull(),
  channel: text("channel").notNull(), // "push"|"sms"|"local"
  status: text("status").notNull().default("scheduled"), // 'scheduled'|'sent'|'snoozed'|'skipped'|'ack'
  meta: jsonb("meta").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const adherenceEvents = pgTable("adherence_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slot: text("slot").notNull(),
  eventAt: timestamp("event_at", { withTimezone: true }).defaultNow(),
  action: text("action").notNull(), // 'ate'|'snooze'|'skip'
});

export const userTimePresets = pgTable("user_time_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  times: jsonb("times").notNull(), // { b:"HH:MM"|null, l:"HH:MM"|null, d:"HH:MM"|null, s:["HH:MM", ...] }
  notify: jsonb("notify").notNull(), // { b:boolean, l:boolean, d:boolean, s:boolean }
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  userDefaultUnique: unique().on(t.userId, t.isDefault),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  createdAt: true,
});

export const insertMealPlanSchema = createInsertSchema(mealPlans).omit({
  id: true,
  createdAt: true,
});

export const insertMealLogSchema = createInsertSchema(mealLog).omit({
  id: true,
  createdAt: true,
});

export const insertMacroLogSchema = createInsertSchema(macroLogs, {
  at: z.coerce.date(),
  kcal: z.coerce.number().nonnegative(),
  protein: z.coerce.number().nonnegative(),
  carbs: z.coerce.number().nonnegative(),
  fat: z.coerce.number().nonnegative(),
  fiber: z.coerce.number().nonnegative().optional(),
  alcohol: z.coerce.number().nonnegative().optional(),
}).omit({
  id: true,
});

export const insertMealReminderSchema = createInsertSchema(mealReminders).omit({
  id: true,
  createdAt: true,
});

export const insertMentalHealthConversationSchema = createInsertSchema(mentalHealthConversations).omit({
  id: true,
  createdAt: true,
});

// Notification system insert schemas
export const insertMealScheduleSchema = createInsertSchema(mealSchedule).omit({
  id: true,
});

export const insertNotificationJobSchema = createInsertSchema(notificationJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdherenceEventSchema = createInsertSchema(adherenceEvents).omit({
  id: true,
  eventAt: true,
});

// Weekly meal plans table for meal plan persistence
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

// Current meal plan storage - stores user's latest generated plan
export const mealPlansCurrent = pgTable("meal_plans_current", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  plan: jsonb("plan").notNull(),
  meta: jsonb("meta").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// AI Meal Creator Plan Archive - separate from weeklyMealPlans for meal plan acceptance workflow
export const aiMealPlanArchive = pgTable("ai_meal_plan_archive", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dietOverride: text("diet_override"),
  durationDays: integer("duration_days").notNull(),
  mealsPerDay: integer("meals_per_day").notNull(),
  snacksPerDay: integer("snacks_per_day").notNull(),
  selectedIngredients: text("selected_ingredients").array().default(sql`ARRAY[]::text[]`),
  schedule: jsonb("schedule").notNull(), // Array of { name: string, time: string }
  slots: jsonb("slots").notNull(), // Array of MealSlot objects
  status: text("status").notNull().default("accepted"), // "accepted" | "archived"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});



export const insertWeeklyMealPlanSchema = createInsertSchema(weeklyMealPlans).omit({
  createdAt: true,
});

export const insertAiMealPlanArchiveSchema = createInsertSchema(aiMealPlanArchive).omit({
  id: true,
  createdAt: true,
});

export const insertUserTimePresetSchema = createInsertSchema(userTimePresets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Kids Veggie Explorer tables
export const kidsVeggieExplorer = pgTable("kids_veggie_explorer", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id").notNull(),
  vegetableId: varchar("vegetable_id").notNull(),
  tries: integer("tries").default(0).notNull(),
  lastPortionStage: varchar("last_portion_stage", { length: 20 }),
  lastTryMethod: varchar("last_try_method", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kidsVegetablesCatalog = pgTable("kids_vegetables_catalog", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  kidFriendlyName: varchar("kid_friendly_name").notNull(),
  colorCategory: varchar("color_category").notNull(),
  funFact: text("fun_fact").notNull(),
  recommendedIntro: text("recommended_intro").notNull(),
  imageUrl: varchar("image_url"),
});

// Contest system tables
export const contests = pgTable("contests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  theme: text("theme").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  rules: text("rules").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: text("created_at").notNull(),
});

export const contestEntries = pgTable("contest_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contestId: varchar("contest_id").references(() => contests.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  mealName: text("meal_name").notNull(),
  photoUrl: text("photo_url"),
  ingredients: text("ingredients").array().default(sql`ARRAY[]::text[]`),
  steps: text("steps").array().default(sql`ARRAY[]::text[]`),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const contestVotes = pgTable("contest_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contestId: varchar("contest_id").references(() => contests.id).notNull(),
  entryId: varchar("entry_id").references(() => contestEntries.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  votedAt: timestamp("voted_at").defaultNow(),
});

// Barcode Food Database - MyFitnessPal-style system
export const mealSlotEnum = pgEnum("meal_slot", ["breakfast", "lunch", "dinner", "snack"]);
export const foodSourceEnum = pgEnum("food_source", ["user", "brand", "off", "usda"]);

// Master Food Database
export const foods = pgTable("foods", {
  id: uuid("id").primaryKey().defaultRandom(),
  barcode: text("barcode").unique().notNull(),
  name: text("name").notNull(),
  brand: text("brand"),
  servingSizes: jsonb("serving_sizes").notNull().$type<Array<{ label: string; grams: number }>>()
    .default([{ label: "100 g", grams: 100 }]),
  nutrPerServing: jsonb("nutr_per_serving").notNull().$type<{
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  }>(),
  micros: jsonb("micros").$type<Record<string, number>>(),
  verified: boolean("verified").notNull().default(false),
  source: foodSourceEnum("source").notNull().default("user"),
  syncedAt: timestamp("synced_at"),
  raw: jsonb("raw"), // original payload from external source
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User Food Diary - immutable nutrition snapshots
export const foodDiary = pgTable("food_diary", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  dateLocal: date("date_local").notNull(), // YYYY-MM-DD
  mealSlot: mealSlotEnum("meal_slot").notNull(),
  foodId: uuid("food_id").references(() => foods.id), // nullable for custom entries
  barcode: text("barcode"), // copy for convenience
  displayName: text("display_name").notNull(),
  servingLabel: text("serving_label").notNull(),
  servings: numeric("servings", { precision: 8, scale: 2 }).notNull(), // 0.25, 1, 1.5 etc
  nutrSnapshot: jsonb("nutr_snapshot").notNull().$type<{
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  }>(), // multiplied by servings
  source: text("source").notNull().default("barcode"), // "barcode" | "manual" | "generated"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Fast Cache for barcodes
export const barcodeCache = pgTable("barcode_cache", {
  barcode: text("barcode").primaryKey(),
  foodId: uuid("food_id").references(() => foods.id, { onDelete: "cascade" }).notNull(),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
});

// Shopping List Items insert schema
export const insertShoppingListItemSchema = createInsertSchema(shoppingListItems).omit({
  id: true,
  createdAt: true,
});
export type InsertShoppingListItem = z.infer<typeof insertShoppingListItemSchema>;
export type ShoppingListItem = typeof shoppingListItems.$inferSelect;

// AI-Powered Monthly Cooking Challenges
export const cookingChallenges = pgTable("cooking_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  theme: text("theme").notNull(), // e.g. "healthy-breakfast", "desserts", "low-carb"
  rules: text("rules").array().default(sql`ARRAY[]::text[]`),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  maxCalories: integer("max_calories"),
  requiredIngredients: text("required_ingredients").array().default(sql`ARRAY[]::text[]`),
  restrictedIngredients: text("restricted_ingredients").array().default(sql`ARRAY[]::text[]`),
  category: text("category").notNull(), // "monthly", "weekly", "daily"
  difficulty: text("difficulty").notNull(), // "beginner", "intermediate", "advanced"
  isActive: boolean("is_active").default(true),
  aiJudgingCriteria: jsonb("ai_judging_criteria").$type<{
    nutrition: number;
    creativity: number;
    adherence: number;
    presentation: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const challengeSubmissions = pgTable("challenge_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").references(() => cookingChallenges.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  ingredients: text("ingredients").array().default(sql`ARRAY[]::text[]`),
  instructions: text("instructions").array().default(sql`ARRAY[]::text[]`),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  cookingTime: integer("cooking_time"), // in minutes
  servings: integer("servings").default(1),
  estimatedCalories: integer("estimated_calories"),
  aiScores: jsonb("ai_scores").$type<{
    nutritionScore: number;
    creativityScore: number;
    adherenceScore: number;
    presentationScore: number;
    totalScore: number;
  }>(),
  aiFeedback: text("ai_feedback"),
  communityVotes: integer("community_votes").default(0),
  isWinner: boolean("is_winner").default(false),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const challengeVotes = pgTable("challenge_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").references(() => cookingChallenges.id, { onDelete: "cascade" }).notNull(),
  submissionId: varchar("submission_id").references(() => challengeSubmissions.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  voteType: text("vote_type").notNull(), // "like", "love", "favorite"
  votedAt: timestamp("voted_at").defaultNow(),
}, (t) => ({
  userSubmissionUnique: unique().on(t.submissionId, t.userId),
}));

export const challengeComments = pgTable("challenge_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").references(() => challengeSubmissions.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userChallengeProgress = pgTable("user_challenge_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  challengeId: varchar("challenge_id").references(() => cookingChallenges.id, { onDelete: "cascade" }).notNull(),
  joined: boolean("joined").default(true),
  completed: boolean("completed").default(false),
  rank: integer("rank"),
  totalScore: integer("total_score").default(0),
  badges: text("badges").array().default(sql`ARRAY[]::text[]`), // "creative", "healthy", "winner", etc.
  joinedAt: timestamp("joined_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => ({
  userChallengeUnique: unique().on(t.userId, t.challengeId),
}));

// AI-Powered Cooking Classes System
export const cookingClasses = pgTable("cooking_classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(), // "Knife Skills 101"
  description: text("description").notNull(), // Detailed class description
  track: text("track").notNull(), // "beginner", "intermediate", "advanced"
  module: text("module").notNull(), // "knife-skills", "eggs", "pasta"
  order: integer("order").notNull(), // position within track
  difficulty: integer("difficulty").notNull().default(1), // 1-5
  estimatedTime: integer("estimated_time"), // in minutes
  lessonContent: jsonb("lesson_content").$type<{
    introduction: string;
    steps: string[];
    tips: string[];
    ingredients?: string[];
    equipment?: string[];
  }>(),
  practiceRecipe: jsonb("practice_recipe").$type<{
    title: string;
    description: string;
    ingredients: string[];
    instructions: string[];
    servings: number;
    cookTime: number;
  }>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cookingClassJournal = pgTable("cooking_class_journal", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  classId: varchar("class_id").references(() => cookingClasses.id, { onDelete: "cascade" }).notNull(),
  photoUrl: text("photo_url").notNull(), // Recipe photo
  blurb: text("blurb"), // User's experience/notes
  cookingUrl: text("cooking_url"), // Optional recipe link
  aiScore: integer("ai_score"), // 0-100 AI evaluation
  aiFeedback: text("ai_feedback"), // AI tips/comments
  submittedAt: timestamp("submitted_at").defaultNow(),
}, (t) => ({
  userClassUnique: unique().on(t.userId, t.classId),
}));

export const cookingClassProgress = pgTable("cooking_class_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  track: text("track").notNull(), // "beginner", "intermediate", "advanced"
  completedClasses: text("completed_classes").array().default(sql`ARRAY[]::text[]`), // class IDs
  currentModule: text("current_module"), // current module they're working on
  skillBadges: text("skill_badges").array().default(sql`ARRAY[]::text[]`), // earned badges
  totalXp: integer("total_xp").default(0), // experience points
  lastActive: timestamp("last_active").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  userTrackUnique: unique().on(t.userId, t.track),
}));

export const cookingClassVotes = pgTable("cooking_class_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journalEntryId: varchar("journal_entry_id").references(() => cookingClassJournal.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  voteType: text("vote_type").notNull(), // "like", "love", "helpful"
  votedAt: timestamp("voted_at").defaultNow(),
}, (t) => ({
  userEntryUnique: unique().on(t.journalEntryId, t.userId),
}));

// Barcode Cache Table (for MyFitnessPal-like scanning)
export const barcodes = pgTable("barcodes", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand"),
  servingDesc: text("serving_desc"),
  // per serving OR per 100g — we store what we mapped
  calories: numeric("calories"),
  protein: numeric("protein"),
  carbs: numeric("carbs"),
  fat: numeric("fat"),
  fiber: numeric("fiber"),
  sodium: numeric("sodium"),
  sugar: numeric("sugar"),
  basis: text("basis").default("serving"), // "serving" | "100g"
  raw: jsonb("raw"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced Meal Logs (with barcode support)
export const mealLogsEnhanced = pgTable("meal_logs_enhanced", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(), // user's local date e.g., "2025-08-12"
  mealSlot: text("meal_slot").notNull(), // "breakfast" | "lunch" | "dinner" | "snack"
  source: text("source").notNull().default("manual"), // "barcode" | "generated" | "manual"
  barcode: text("barcode").references(() => barcodes.code), // nullable when custom
  customName: text("custom_name"),
  servings: numeric("servings").default("1"),
  calories: numeric("calories").default("0"),
  protein: numeric("protein").default("0"),
  carbs: numeric("carbs").default("0"),
  fat: numeric("fat").default("0"),
  fiber: numeric("fiber").default("0"),
  sodium: numeric("sodium").default("0"),
  sugar: numeric("sugar").default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced Shopping List Items removed - all shopping functionality removed

// Insert schemas for barcode food system
export const insertFoodSchema = createInsertSchema(foods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFoodDiarySchema = createInsertSchema(foodDiary).omit({
  id: true,
  createdAt: true,
});

export const insertBarcodeCacheSchema = createInsertSchema(barcodeCache).omit({
  lastUsedAt: true,
});

// Type exports for barcode system
export type Food = typeof foods.$inferSelect;
export type FoodDiary = typeof foodDiary.$inferSelect;
export type BarcodeCache = typeof barcodeCache.$inferSelect;
export type InsertFood = z.infer<typeof insertFoodSchema>;
export type InsertFoodDiary = z.infer<typeof insertFoodDiarySchema>;
export type InsertBarcodeCache = z.infer<typeof insertBarcodeCacheSchema>;

// Zod schemas for veggie explorer
export const insertKidsVeggieExplorerSchema = createInsertSchema(kidsVeggieExplorer).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKidsVegetablesCatalogSchema = createInsertSchema(kidsVegetablesCatalog);

// Contest schemas
export const insertContestSchema = createInsertSchema(contests).omit({
  id: true,
});

export const insertContestEntrySchema = createInsertSchema(contestEntries).omit({
  id: true,
  submittedAt: true,
});

export const insertContestVoteSchema = createInsertSchema(contestVotes).omit({
  id: true,
  votedAt: true,
});



// AI Cooking Challenge schemas
export const insertCookingChallengeSchema = createInsertSchema(cookingChallenges).omit({
  id: true,
  createdAt: true,
});

export const insertChallengeSubmissionSchema = createInsertSchema(challengeSubmissions).omit({
  id: true,
  submittedAt: true,
});

export const insertChallengeVoteSchema = createInsertSchema(challengeVotes).omit({
  id: true,
  votedAt: true,
});

export const insertChallengeCommentSchema = createInsertSchema(challengeComments).omit({
  id: true,
  createdAt: true,
});

export const insertUserChallengeProgressSchema = createInsertSchema(userChallengeProgress).omit({
  id: true,
  joinedAt: true,
  completedAt: true,
});

// AI Cooking Classes schemas
export const insertCookingClassSchema = createInsertSchema(cookingClasses).omit({
  id: true,
  createdAt: true,
});

export const insertCookingClassJournalSchema = createInsertSchema(cookingClassJournal).omit({
  id: true,
  submittedAt: true,
});

export const insertCookingClassProgressSchema = createInsertSchema(cookingClassProgress).omit({
  id: true,
  lastActive: true,
  createdAt: true,
});

export const insertCookingClassVoteSchema = createInsertSchema(cookingClassVotes).omit({
  id: true,
  votedAt: true,
});

export const insertUserGlycemicSettingsSchema = createInsertSchema(userGlycemicSettings).omit({
  id: true,
  updatedAt: true,
});



export const insertWaterLogSchema = createInsertSchema(waterLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;

// Blood Pressure Vitals table
export const vitalBp = pgTable("vital_bp", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
  systolic: integer("systolic").notNull(),    // mmHg
  diastolic: integer("diastolic").notNull(),  // mmHg
  pulse: integer("pulse"),                    // bpm (optional)
  source: text("source").notNull().default("manual"), // 'manual' | 'apple_health' | 'import'
  meta: jsonb("meta").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // Fast latest-per-user and range scans
  index("idx_vital_bp_user_time").on(table.userId, table.measuredAt.desc()),
  // Prevent duplicate inserts from sync jobs
  uniqueIndex("uq_vital_bp_dedup").on(table.userId, table.measuredAt, table.systolic, table.diastolic),
]);

export type VitalBp = typeof vitalBp.$inferSelect;
export type InsertVitalBp = typeof vitalBp.$inferInsert;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type MealPlan = typeof mealPlans.$inferSelect;
export type AiMealPlanArchive = typeof aiMealPlanArchive.$inferSelect;
export type InsertAiMealPlanArchive = z.infer<typeof insertAiMealPlanArchiveSchema>;
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealReminder = typeof mealReminders.$inferSelect;
export type InsertMealReminder = z.infer<typeof insertMealReminderSchema>;
export type MealLog = typeof mealLog.$inferSelect;
export type InsertMealLog = z.infer<typeof insertMealLogSchema>;

export type MentalHealthConversation = typeof mentalHealthConversations.$inferSelect;
export type InsertMentalHealthConversation = z.infer<typeof insertMentalHealthConversationSchema>;
export type Contest = typeof contests.$inferSelect;
export type InsertContest = z.infer<typeof insertContestSchema>;
export type ContestEntry = typeof contestEntries.$inferSelect;
export type InsertContestEntry = z.infer<typeof insertContestEntrySchema>;
export type ContestVote = typeof contestVotes.$inferSelect;
export type InsertContestVote = z.infer<typeof insertContestVoteSchema>;
export type KidsVeggieExplorer = typeof kidsVeggieExplorer.$inferSelect;
export type InsertKidsVeggieExplorer = z.infer<typeof insertKidsVeggieExplorerSchema>;
export type KidsVegetablesCatalog = typeof kidsVegetablesCatalog.$inferSelect;
export type InsertKidsVegetablesCatalog = z.infer<typeof insertKidsVegetablesCatalogSchema>;

export type UserGlycemicSettings = typeof userGlycemicSettings.$inferSelect;
export type InsertUserGlycemicSettings = z.infer<typeof insertUserGlycemicSettingsSchema>;
export type WaterLog = typeof waterLogs.$inferSelect;
export type InsertWaterLog = z.infer<typeof insertWaterLogSchema>;
export type CookingChallenge = typeof cookingChallenges.$inferSelect;
export type InsertCookingChallenge = z.infer<typeof insertCookingChallengeSchema>;
export type ChallengeSubmission = typeof challengeSubmissions.$inferSelect;
export type InsertChallengeSubmission = z.infer<typeof insertChallengeSubmissionSchema>;
export type ChallengeVote = typeof challengeVotes.$inferSelect;
export type InsertChallengeVote = z.infer<typeof insertChallengeVoteSchema>;
export type ChallengeComment = typeof challengeComments.$inferSelect;
export type InsertChallengeComment = z.infer<typeof insertChallengeCommentSchema>;
export type UserChallengeProgress = typeof userChallengeProgress.$inferSelect;
export type InsertUserChallengeProgress = z.infer<typeof insertUserChallengeProgressSchema>;

// Cooking Classes types
export type CookingClass = typeof cookingClasses.$inferSelect;
export type InsertCookingClass = z.infer<typeof insertCookingClassSchema>;
export type CookingClassJournal = typeof cookingClassJournal.$inferSelect;
export type InsertCookingClassJournal = z.infer<typeof insertCookingClassJournalSchema>;
export type CookingClassProgress = typeof cookingClassProgress.$inferSelect;
export type InsertCookingClassProgress = z.infer<typeof insertCookingClassProgressSchema>;
export type CookingClassVote = typeof cookingClassVotes.$inferSelect;
export type InsertCookingClassVote = z.infer<typeof insertCookingClassVoteSchema>;

// Trivia and mindset system
export * from "../server/db/schema/trivia";
export * from "../server/db/schema/mindset";

// Meal planning and shopping list system
export * from "./schema/mealplan";


// FitLife Simulator system
export * from "./fitlife-schema";

// My Best Life Schema
export const mblAvatarState = pgTable("mbl_avatar_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  weightLbs: numeric("weight_lbs").notNull().default("185"),
  bodyFatPct: numeric("body_fat_pct").notNull().default("28"),
  muscleMassLbs: numeric("muscle_mass_lbs").notNull().default("70"),
  energy: numeric("energy").notNull().default("60"),   // 0–100
  mood: numeric("mood").notNull().default("60"),       // 0–100
  lifestyleScore: numeric("lifestyle_score").notNull().default("60"),
  visualStage: varchar("visual_stage", { length: 16 }).notNull().default("average"), // "fit" | "average" | "overweight"
  lastSimDate: varchar("last_sim_date", { length: 10 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (t) => ({
  uq_user: unique().on(t.userId)
}));

export const mblDayLog = pgTable("mbl_day_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  dateKey: varchar("date_key", { length: 10 }).notNull(), // YYYY-MM-DD

  // Inputs
  nutritionScore: numeric("nutrition_score").notNull().default("50"),
  trainingScore: numeric("training_score").notNull().default("0"),
  lifestyleScore: numeric("lifestyle_score").notNull().default("50"),

  // Selections captured for history (optional)
  mealNames: jsonb("meal_names").$type<string[]>().notNull().default([]),
  workoutName: varchar("workout_name", { length: 128 }).default(""),

  // Snapshot
  weightLbs: numeric("weight_lbs"),
  bodyFatPct: numeric("body_fat_pct"),
  muscleMassLbs: numeric("muscle_mass_lbs"),
  energy: numeric("energy"),
  mood: numeric("mood"),
  visualStage: varchar("visual_stage", { length: 16 })
});

// SMS reminder tables
export * from "../server/db/schema/sms";

// AI Voice & Journaling tables
export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  content: text("content").notNull(),
  aiSummary: text("ai_summary"),
  moodLabel: varchar("mood_label", { length: 32 }), // e.g., "calm", "stressed"
  moodScore: integer("mood_score"), // -5..+5 or 0..100
});

// Quick emotional check-ins (lightweight log separate from long-form journals)
export const emotionalCheckins = pgTable("emotional_checkins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  moodLabel: varchar("mood_label", { length: 32 }).notNull(),
  moodScore: integer("mood_score").notNull(), // 1..5 or 0..10 scale supported by UI
  note: text("note"),
});

// Daily reminder delivery log (for reliability & analytics)
export const reminderDeliveries = pgTable("reminder_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  channel: varchar("channel", { length: 16 }).notNull(), // 'sms'|'push'|'in-app'
  type: varchar("type", { length: 32 }).notNull(), // 'daily-journal'
  status: varchar("status", { length: 16 }).notNull().default("sent"), // 'sent'|'failed'
  error: text("error"),
});

// Meal Instance & Replacement System
export const mealInstances = pgTable('meal_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 64 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  slot: varchar('slot', { length: 16 }).notNull(), // breakfast|lunch|dinner|snack
  recipeId: uuid('recipe_id'),
  source: varchar('source', { length: 32 }).notNull().default('plan'),
  status: varchar('status', { length: 16 }).notNull().default('planned'),
  loggedAt: timestamp('logged_at', { withTimezone: true }),
  replacedByMealInstanceId: uuid('replaced_by_meal_instance_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userRecipes = pgTable('user_recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 64 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  ingredients: jsonb('ingredients').notNull(),
  instructions: text('instructions').notNull(),
  nutrition: jsonb('nutrition'),
  badges: jsonb('badges').$type<Array<{ key: string; label: string; description: string }>>().default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertMealInstanceSchema = createInsertSchema(mealInstances).omit({
  id: true,
  createdAt: true,
});
export type InsertMealInstance = z.infer<typeof insertMealInstanceSchema>;
export type SelectMealInstance = typeof mealInstances.$inferSelect;

export const insertUserRecipeSchema = createInsertSchema(userRecipes).omit({
  id: true,
  createdAt: true,
});
export type InsertUserRecipe = z.infer<typeof insertUserRecipeSchema>;
export type SelectUserRecipe = typeof userRecipes.$inferSelect;

// Testimonial System - Layer 1: Database Schema
export const testimonialPlatform = pgEnum("testimonial_platform", ["internal","facebook"]);
export const testimonialStatus = pgEnum("testimonial_status", ["pending","posted","failed"]);

export const userTestimonials = pgTable(
  "user_testimonials",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    content: text("content").notNull(),
    platform: testimonialPlatform("platform").default("internal").notNull(),
    status: testimonialStatus("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    byUserIdx: index("user_testimonials_user_idx").on(t.userId),
    byCreatedIdx: index("user_testimonials_created_idx").on(t.createdAt),
  })
);

export const insertUserTestimonialSchema = createInsertSchema(userTestimonials).omit({
  id: true,
  createdAt: true,
});

export type InsertUserTestimonial = z.infer<typeof insertUserTestimonialSchema>;
export type SelectUserTestimonial = typeof userTestimonials.$inferSelect;

// Recipe Gallery Table - stores up to 15 latest shared recipes
export const recipeGallery = pgTable("recipe_gallery", {
  id: varchar("id", { length: 36 }).primaryKey(),
  postId: varchar("post_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  cookingInstructionsUrl: text("cooking_instructions_url"),
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRecipeGallerySchema = createInsertSchema(recipeGallery, {
  id: z.string().min(1).max(36),
  postId: z.string().min(1).max(36),
  title: z.string().min(1).max(500),
  imageUrl: z.string().url().optional(),
  cookingInstructionsUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type InsertRecipeGallery = z.infer<typeof insertRecipeGallerySchema>;
export type RecipeGallery = typeof recipeGallery.$inferSelect;

// Comments Table
export const comments = pgTable("comments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }), // null if anonymous
  authorDisplay: text("author_display").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCommentSchema = createInsertSchema(comments, {
  id: z.string().min(1).max(36).optional(),
  postId: z.string().min(1).max(36),
  userId: z.string().min(1).max(36).optional(),
  authorDisplay: z.string().min(1).max(100),
  text: z.string().min(1).max(1000),
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Learn to Cook Challenge System
export const challengeStatus = pgEnum("challenge_status", ["UPCOMING", "ACTIVE", "VOTING", "CLOSED"]);
export const badgeType = pgEnum("badge_type", ["CHEF_OF_MONTH", "CHALLENGE_FINISHER", "PARTICIPATION"]);

// Main challenges table
export const learnToCookChallenges = pgTable("learn_to_cook_challenges", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  monthKey: varchar("month_key", { length: 7 }).notNull().unique(), // "2025-09"
  title: text("title").notNull(),
  prompt: text("prompt").notNull(), // AI description/requirements
  status: challengeStatus("status").notNull().default("UPCOMING"),
  entryDeadline: timestamp("entry_deadline", { withTimezone: true }).notNull(),
  voteDeadline: timestamp("vote_deadline", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// User challenge entries
export const learnToCookEntries = pgTable("learn_to_cook_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id", { length: 36 }).notNull().references(() => learnToCookChallenges.id, { onDelete: 'cascade' }),
  userId: varchar("user_id", { length: 36 }), // null if anonymous
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  blurb: text("blurb").notNull(),
  cookingUrl: text("cooking_url"), // deep link to instructions
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // One entry per user per challenge
  userChallengeUnique: unique().on(t.userId, t.challengeId),
}));

// Voting system
export const learnToCookVotes = pgTable("learn_to_cook_votes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id", { length: 36 }).notNull().references(() => learnToCookChallenges.id, { onDelete: 'cascade' }),
  entryId: varchar("entry_id", { length: 36 }).notNull().references(() => learnToCookEntries.id, { onDelete: 'cascade' }),
  voterUserId: varchar("voter_user_id", { length: 36 }), // null if anonymous
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // One vote per user per entry
  voterEntryUnique: unique().on(t.voterUserId, t.entryId),
}));

// Badge system
export const userBadges = pgTable("user_badges", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  badgeType: badgeType("badge_type").notNull(),
  meta: jsonb("meta").$type<{ monthKey: string; place?: number; challengeId?: string }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Zod schemas and types
export const insertLearnToCookChallengeSchema = createInsertSchema(learnToCookChallenges, {
  id: z.string().optional(),
  monthKey: z.string().min(7).max(7),
  title: z.string().min(1).max(200),
  prompt: z.string().min(1).max(1000),
  status: z.enum(["UPCOMING", "ACTIVE", "VOTING", "CLOSED"]).optional(),
  entryDeadline: z.date(),
  voteDeadline: z.date(),
});

export const insertLearnToCookEntrySchema = createInsertSchema(learnToCookEntries, {
  id: z.string().optional(),
  challengeId: z.string().min(1),
  userId: z.string().optional(),
  title: z.string().min(1).max(100),
  imageUrl: z.string().url(),
  blurb: z.string().min(1).max(500),
  cookingUrl: z.string().optional(),
});

export const insertLearnToCookVoteSchema = createInsertSchema(learnToCookVotes, {
  id: z.string().optional(),
  challengeId: z.string().min(1),
  entryId: z.string().min(1),
  voterUserId: z.string().optional(),
});

export const insertUserBadgeSchema = createInsertSchema(userBadges, {
  id: z.string().optional(),
  userId: z.string().min(1),
  badgeType: z.enum(["CHEF_OF_MONTH", "CHALLENGE_FINISHER", "PARTICIPATION"]),
  meta: z.object({
    monthKey: z.string(),
    place: z.number().optional(),
    challengeId: z.string().optional(),
  }),
});

export type InsertLearnToCookChallenge = z.infer<typeof insertLearnToCookChallengeSchema>;
export type LearnToCookChallenge = typeof learnToCookChallenges.$inferSelect;

export type InsertLearnToCookEntry = z.infer<typeof insertLearnToCookEntrySchema>;
export type LearnToCookEntry = typeof learnToCookEntries.$inferSelect;

export type InsertLearnToCookVote = z.infer<typeof insertLearnToCookVoteSchema>;
export type LearnToCookVote = typeof learnToCookVotes.$inferSelect;

export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;

// A/B Testing audit trail for meal plan generation
export const mealPlanRuns = pgTable("meal_plan_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id),
  variant: text("variant").$type<"A"|"B">().notNull(),
  params: jsonb("params").notNull(), // weeks, mealsPerDay, targets, diet, medicalFlags
  resultMeta: jsonb("result_meta").notNull(), // uniqueIngredients, macroHit%, diversity, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MealPlanRun = typeof mealPlanRuns.$inferSelect;
export type InsertMealPlanRun = typeof mealPlanRuns.$inferInsert;

// User Meal Preferences for Cafeteria System
export const userMealPrefs = pgTable("user_meal_prefs", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  goal: text("goal").$type<"loss"|"maint"|"gain">().notNull().default("maint"),
  likesProtein: text("likes_protein").array().default(sql`ARRAY[]::text[]`),
  likesCarb: text("likes_carb").array().default(sql`ARRAY[]::text[]`),
  likesFat: text("likes_fat").array().default(sql`ARRAY[]::text[]`),
  likesVeg: text("likes_veg").array().default(sql`ARRAY[]::text[]`),
  likes: text("likes").array().default(sql`ARRAY[]::text[]`), // Simplified likes array for frontend
  avoid: text("avoid").array().default(sql`ARRAY[]::text[]`),
  vegOptOut: boolean("veg_opt_out").default(false).notNull(), // Vegetable opt-out flag
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserMealPrefsSchema = createInsertSchema(userMealPrefs, {
  userId: z.string().min(1),
  goal: z.enum(["loss", "maint", "gain"]).optional(),
  likesProtein: z.array(z.string()).optional(),
  likesCarb: z.array(z.string()).optional(),
  likesFat: z.array(z.string()).optional(),
  likesVeg: z.array(z.string()).optional(),
  likes: z.array(z.string()).optional(),
  avoid: z.array(z.string()).optional(),
  vegOptOut: z.boolean().optional(),
});

export type UserMealPrefs = typeof userMealPrefs.$inferSelect;
export type InsertUserMealPrefs = z.infer<typeof insertUserMealPrefsSchema>;

// Biometrics Vitals (BP, Weight, Waist)
export const biometricsVitals = pgTable("biometrics_vitals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  /** Local calendar day (YYYY-MM-DD) */
  date: date("date").notNull(),

  /** Weight & waist (store metric, convert on UI) */
  weightKg: numeric("weight_kg").default("0"),
  waistCm: numeric("waist_cm").default("0"),

  /** Blood pressure + pulse */
  systolic: integer("systolic"),
  diastolic: integer("diastolic"),
  pulse: integer("pulse"),

  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BiometricsVitals = typeof biometricsVitals.$inferSelect;
export type InsertBiometricsVitals = typeof biometricsVitals.$inferInsert;

// Week Boards - Simple JSON persistence for meal boards
export const weekBoards = pgTable("week_boards", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStartISO: varchar("week_start_iso").notNull(), // e.g. "2025-09-08" (Monday)
  boardJSON: jsonb("board_json").notNull(), // entire WeekBoard shape
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.weekStartISO] }),
  userWeekIdx: index("week_boards_user_week_idx").on(table.userId, table.weekStartISO),
}));

export type WeekBoard = typeof weekBoards.$inferSelect;
export type InsertWeekBoard = typeof weekBoards.$inferInsert;

// Shopping List Sources - tracks which meals contribute to each shopping list item
export const shoppingListSources = pgTable("shopping_list_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => shoppingListItems.id, { onDelete: "cascade" }),
  mealId: text("meal_id").notNull(),
  mealName: text("meal_name").notNull(),
  generator: text("generator"), // craving, smart-menu, diabetic, etc.
  day: text("day"), // YYYY-MM-DD
  slot: text("slot"), // breakfast, lunch, dinner, snacks
  qty: text("qty"),
  unit: text("unit"),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertShoppingListSourceSchema = createInsertSchema(shoppingListSources, {
  itemId: z.string().uuid(),
  mealId: z.string().min(1),
  mealName: z.string().min(1),
  generator: z.string().optional(),
  day: z.string().optional(),
  slot: z.enum(["breakfast", "lunch", "dinner", "snacks"]).optional(),
  qty: z.string().optional(),
  unit: z.string().optional(),
});

export type ShoppingListSource = typeof shoppingListSources.$inferSelect;
export type InsertShoppingListSource = z.infer<typeof insertShoppingListSourceSchema>;

// ========================================
// Physician Medical Reports Schema
// ========================================

export const physicianReports = pgTable("physician_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessCode: varchar("access_code", { length: 12 }).notNull().unique(),
  reportDate: timestamp("report_date", { withTimezone: true }).defaultNow().notNull(),
  patientName: text("patient_name"),

  // Patient Health Profile
  healthProfile: jsonb("health_profile").$type<{
    hasDiabetes: boolean;
    diabetesType?: string;
    allergies: string[];
    medicalConditions: string[];
    medications: string[];
    dietaryRestrictions: string[];
  }>().notNull(),

  // Generated Meal Plan
  mealPlan: jsonb("meal_plan").$type<Array<{
    name: string;
    description: string;
    slot?: string;
    protein: number;
    carbs: number;
    fat: number;
    kcal: number;
    ingredients: string[];
    medicalBadges?: Array<{
      type: string;
      reason: string;
    }>;
  }>>().notNull(),

  // Clinical Protocol Used
  protocol: text("protocol"), // e.g., "Diabetic", "GLP-1", "Renal", "Cardiac"

  // Summary/Notes
  clinicalNotes: text("clinical_notes"),

  // Access tracking
  viewCount: integer("view_count").default(0).notNull(),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // Optional expiration

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPhysicianReportSchema = createInsertSchema(physicianReports, {
  patientName: z.string().optional(),
  healthProfile: z.object({
    hasDiabetes: z.boolean(),
    diabetesType: z.string().optional(),
    allergies: z.array(z.string()),
    medicalConditions: z.array(z.string()),
    medications: z.array(z.string()),
    dietaryRestrictions: z.array(z.string()),
  }),
  mealPlan: z.array(z.object({
    name: z.string(),
    description: z.string(),
    slot: z.string().optional(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    kcal: z.number(),
    ingredients: z.array(z.string()),
    medicalBadges: z.array(z.object({
      type: z.string(),
      reason: z.string(),
    })).optional(),
  })),
  protocol: z.string().optional(),
  clinicalNotes: z.string().optional(),
  expiresAt: z.date().optional(),
}).omit({ id: true, accessCode: true, viewCount: true, lastViewedAt: true, createdAt: true, updatedAt: true });

export type PhysicianReport = typeof physicianReports.$inferSelect;
export type InsertPhysicianReport = z.infer<typeof insertPhysicianReportSchema>;