import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const companionProfiles = pgTable(
  "companion_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    breed: text("breed").notNull(),
    isMixedBreed: boolean("is_mixed_breed").notNull().default(false),
    ageYears: integer("age_years").notNull(),
    ageMonths: integer("age_months").notNull().default(0),
    sex: text("sex").notNull(),
    isNeutered: boolean("is_neutered").notNull().default(false),
    weightLbs: integer("weight_lbs").notNull(),
    goalWeightLbs: integer("goal_weight_lbs"),
    activityLevel: text("activity_level").notNull().default("moderate"),
    bodyConditionScore: integer("body_condition_score"),
    foodSensitivities: jsonb("food_sensitivities").$type<string[]>().default([]),
    allergies: jsonb("allergies").$type<string[]>().default([]),
    currentDietType: text("current_diet_type").default("commercial"),
    treatsPerDay: integer("treats_per_day").default(0),
    behaviorNotes: text("behavior_notes"),
    vetDietaryRestrictions: text("vet_dietary_restrictions"),
    medications: jsonb("medications").$type<string[]>().default([]),
    wellnessGoals: jsonb("wellness_goals").$type<string[]>().default([]),
    photoUrl: text("photo_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("companion_profiles_user_idx").on(t.userId),
  })
);

export const companionMeals = pgTable(
  "companion_meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    mealType: text("meal_type").notNull().default("main"),
    title: text("title").notNull(),
    description: text("description"),
    ingredients: jsonb("ingredients").$type<{ name: string; amount: string; notes?: string }[]>().notNull(),
    instructions: jsonb("instructions").$type<string[]>().notNull(),
    servingSize: text("serving_size"),
    estimatedCalories: integer("estimated_calories"),
    proteinGrams: integer("protein_grams"),
    wellnessGoalsAddressed: jsonb("wellness_goals_addressed").$type<string[]>().default([]),
    citationSources: jsonb("citation_sources").$type<{ source: string; note: string }[]>().default([]),
    isSaved: boolean("is_saved").notNull().default(false),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    profileIdx: index("companion_meals_profile_idx").on(t.profileId),
    userIdx: index("companion_meals_user_idx").on(t.userId),
  })
);

export const companionIngredientScans = pgTable(
  "companion_ingredient_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    profileId: uuid("profile_id"),
    ingredient: text("ingredient").notNull(),
    safetyStatus: text("safety_status").notNull(),
    toxicityReason: text("toxicity_reason"),
    safeSubstitution: text("safe_substitution"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("companion_scans_user_idx").on(t.userId),
  })
);
