import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

// Map step keys to how they merge into user preferences
export async function mergeStepIntoPreferences(userId: string, stepKey: string, data: any) {
  const update: any = {};

  switch (stepKey) {
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
      if (Array.isArray(data?.allergies)) update.allergies = data.allergies;
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