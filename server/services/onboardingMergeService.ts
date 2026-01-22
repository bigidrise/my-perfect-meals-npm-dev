import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

// Map step keys to how they merge into user preferences
export async function mergeStepIntoPreferences(userId: string, stepKey: string, data: any) {
  const update: any = {};

  switch (stepKey) {
    case "standalone-profile":
      // Full onboarding profile from standalone flow - syncs to Edit Profile
      if (data?.firstName) update.firstName = data.firstName;
      if (data?.lastName) update.lastName = data.lastName;
      // Also set combined name for display
      if (data?.firstName || data?.lastName) {
        update.name = [data.firstName, data.lastName].filter(Boolean).join(" ");
      }
      if (data?.age) update.age = data.age;
      if (data?.gender) update.gender = data.gender;
      if (data?.height) update.height = data.height;
      if (data?.weight) update.weight = data.weight;
      if (data?.activityLevel) update.activityLevel = data.activityLevel;
      if (data?.primaryGoal) update.fitnessGoal = data.primaryGoal;
      // Allergies - critical for SafetyGuard
      if (Array.isArray(data?.foodAllergies)) update.allergies = data.foodAllergies;
      // Dietary restrictions
      if (Array.isArray(data?.dietaryRestrictions)) update.dietaryRestrictions = data.dietaryRestrictions;
      // Medical conditions
      if (Array.isArray(data?.medicalConditions)) update.healthConditions = data.medicalConditions;
      // GI preferences
      if (Array.isArray(data?.preferredLowGICarbs)) update.preferredLowGICarbs = data.preferredLowGICarbs;
      if (Array.isArray(data?.preferredMidGICarbs)) update.preferredMidGICarbs = data.preferredMidGICarbs;
      if (Array.isArray(data?.preferredHighGICarbs)) update.preferredHighGICarbs = data.preferredHighGICarbs;
      // CRITICAL: Mark onboarding as complete and set active builder
      update.onboardingCompletedAt = new Date();
      if (data?.activeBuilder) {
        update.selectedMealBuilder = data.activeBuilder;
        update.activeBoard = data.activeBuilder;
      }
      break;
    case "profile-basics":
      if (data?.timezone) update.timezone = data.timezone;
      if (data?.age) update.age = data.age;
      if (data?.height) update.height = data.height;
      if (data?.weight) update.weight = data.weight;
      if (data?.activityLevel) update.activityLevel = data.activityLevel;
      if (data?.fitnessGoal) update.fitnessGoal = data.fitnessGoal;
      break;
    case "dietary-restrictions":
      if (Array.isArray(data?.dietaryRestrictions)) update.dietaryRestrictions = data.dietaryRestrictions;
      // Support both 'allergies' (from profile edit) and 'foodAllergies' (from onboarding)
      if (Array.isArray(data?.allergies)) update.allergies = data.allergies;
      if (Array.isArray(data?.foodAllergies)) update.allergies = data.foodAllergies;
      if (Array.isArray(data?.healthConditions)) update.healthConditions = data.healthConditions;
      break;
    case "food-preferences":
      if (Array.isArray(data?.likedFoods)) update.likedFoods = data.likedFoods;
      if (Array.isArray(data?.dislikedFoods)) update.dislikedFoods = data.dislikedFoods;
      if (Array.isArray(data?.avoidedFoods)) update.avoidedFoods = data.avoidedFoods;
      if (Array.isArray(data?.preferredSweeteners)) update.preferredSweeteners = data.preferredSweeteners;
      if (Array.isArray(data?.avoidSweeteners)) update.avoidSweeteners = data.avoidSweeteners;
      break;
    case "goals-timeline":
      if (data?.dailyCalorieTarget) update.dailyCalorieTarget = data.dailyCalorieTarget;
      if (data?.autoGenerateWeeklyPlan !== undefined) update.autoGenerateWeeklyPlan = data.autoGenerateWeeklyPlan;
      break;
    case "notifications":
      if (typeof data?.enabled === "boolean") update.notificationsEnabled = data.enabled;
      if (typeof data?.defaultLeadTimeMinutes === "number")
        update.notificationDefaultLeadTimeMin = data.defaultLeadTimeMinutes;
      if (Array.isArray(data?.channels)) update.notificationChannels = data.channels;
      break;
    // add other steps as needed
  }

  if (Object.keys(update).length === 0) return;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user) {
    await db.update(users).set(update).where(eq(users.id, userId));
  }
}