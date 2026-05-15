import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * household_profiles
 *
 * Lightweight household member profiles owned by a single Family-plan subscriber.
 * These are NOT full user accounts — no auth, no billing, no notifications.
 * The owner generates meals on behalf of any profile by setting activeHouseholdProfileId
 * on their user row. The protocol envelope loads from this table when a profile is active.
 *
 * Profile limit: up to 4 profiles per owner (enforced in API, not DB).
 * The owner's own profile (is_owner_profile = true) is created automatically on first access.
 */
export const householdProfiles = pgTable(
  "household_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: varchar("owner_user_id", { length: 64 }).notNull(),
    displayName: text("display_name").notNull(),
    avatarEmoji: text("avatar_emoji").default("👤"),
    age: integer("age"),
    isOwnerProfile: boolean("is_owner_profile").default(false),

    // ── Dietary Identity ─────────────────────────────────────────────────────
    dietaryRestrictions: text("dietary_restrictions")
      .array()
      .default(sql`ARRAY[]::text[]`),
    allergies: text("allergies")
      .array()
      .default(sql`ARRAY[]::text[]`),

    // ── Medical / Health Conditions ──────────────────────────────────────────
    healthConditions: text("health_conditions")
      .array()
      .default(sql`ARRAY[]::text[]`),
    medicalConditions: text("medical_conditions")
      .array()
      .default(sql`ARRAY[]::text[]`),
    specialtyCondition: text("specialty_condition"),
    specialtyConditions: text("specialty_conditions")
      .array()
      .default(sql`ARRAY[]::text[]`),

    // ── Avoidances & Preferences ─────────────────────────────────────────────
    dislikedFoods: text("disliked_foods")
      .array()
      .default(sql`ARRAY[]::text[]`),
    avoidedFoods: text("avoided_foods")
      .array()
      .default(sql`ARRAY[]::text[]`),
    likedFoods: text("liked_foods")
      .array()
      .default(sql`ARRAY[]::text[]`),
    preferredSweeteners: text("preferred_sweeteners")
      .array()
      .default(sql`ARRAY[]::text[]`),

    // ── Cuisine & Palate ─────────────────────────────────────────────────────
    cuisinePreference: text("cuisine_preference"),
    cuisineIntensity: text("cuisine_intensity")
      .$type<"light" | "balanced" | "authentic">(),
    palateSpiceTolerance: text("palate_spice_tolerance")
      .$type<"none" | "mild" | "medium" | "hot">()
      .default("mild"),
    palateSeasoningIntensity: text("palate_seasoning_intensity")
      .$type<"light" | "balanced" | "bold">()
      .default("balanced"),
    palateFlavorStyle: text("palate_flavor_style")
      .$type<"classic" | "herb" | "savory" | "bright">()
      .default("classic"),

    // ── Fitness & Macros ─────────────────────────────────────────────────────
    fitnessGoal: text("fitness_goal"),
    activityLevel: text("activity_level"),
    dailyCalorieTarget: integer("daily_calorie_target"),
    dailyProteinTarget: integer("daily_protein_target"),
    dailyCarbsTarget: integer("daily_carbs_target"),
    dailyFatTarget: integer("daily_fat_target"),

    // ── Ordering & Timestamps ────────────────────────────────────────────────
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    ownerIdx: index("idx_household_profiles_owner").on(t.ownerUserId),
  }),
);

export type HouseholdProfile = typeof householdProfiles.$inferSelect;
export type InsertHouseholdProfile = typeof householdProfiles.$inferInsert;
