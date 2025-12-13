// server/services/templateAssign.ts
// Template assignment logic for goal-based meal planning

import { db } from "../db";
import { userMealPrefs } from "../../shared/schema";
import { eq } from "drizzle-orm";

export interface UserProfile {
  id: string;
  age?: number;
  height?: number; // in cm
  weight?: number; // in kg
  activityLevel?: string;
  fitnessGoal?: string;
  sex?: "male" | "female" | "other";
  mealsPerDay?: number;
  vegOptOut?: boolean;
  allergies?: string[];
  dislikedFoods?: string[];
  likedFoods?: string[];
}

export interface TemplateAssignment {
  assignedTemplate: "loss" | "maint" | "gain";
  proteinPerDay: number;
  proteinPerMeal: number;
  caloriesPerDay?: number;
}

/**
 * Assigns a goal-based template and calculates protein requirements
 */
export function assignTemplate(user: UserProfile): TemplateAssignment {
  // Map user fitness goal to template
  let assignedTemplate: "loss" | "maint" | "gain" = "maint";
  
  if (user.fitnessGoal) {
    const goal = user.fitnessGoal.toLowerCase();
    if (goal.includes("loss") || goal.includes("weight_loss")) {
      assignedTemplate = "loss";
    } else if (goal.includes("gain") || goal.includes("muscle_gain")) {
      assignedTemplate = "gain";
    } else {
      assignedTemplate = "maint"; // maintenance/endurance
    }
  }

  // Calculate protein requirements based on goal, sex, and weight
  let proteinPerDay = 120; // default fallback
  
  if (user.weight && user.sex) {
    const weightKg = user.weight;
    let gPerKg: number;
    
    // Protein multipliers by goal and sex
    switch (assignedTemplate) {
      case "loss":
        gPerKg = user.sex === "female" ? 1.6 : 1.8;
        break;
      case "gain":
        gPerKg = user.sex === "female" ? 1.8 : 2.0;
        break;
      case "maint":
      default:
        gPerKg = user.sex === "female" ? 1.4 : 1.6;
        break;
    }
    
    proteinPerDay = Math.round(gPerKg * weightKg);
  }

  // Calculate per-meal protein
  const mealsPerDay = user.mealsPerDay || 3;
  const proteinPerMeal = Math.round(proteinPerDay / mealsPerDay);

  // Optional: Basic calorie estimation (BMR-based)
  let caloriesPerDay: number | undefined;
  if (user.weight && user.height && user.age && user.sex) {
    const bmr = calculateBMR(user.weight, user.height, user.age, user.sex);
    const activityMultiplier = getActivityMultiplier(user.activityLevel);
    const tdee = bmr * activityMultiplier;
    
    // Adjust for goal
    switch (assignedTemplate) {
      case "loss":
        caloriesPerDay = Math.round(tdee - 500); // 500 cal deficit
        break;
      case "gain":
        caloriesPerDay = Math.round(tdee + 300); // 300 cal surplus
        break;
      case "maint":
      default:
        caloriesPerDay = Math.round(tdee);
        break;
    }
  }

  console.log(`🎯 Template assigned for user: ${assignedTemplate.toUpperCase()}, protein: ${proteinPerDay}g/day (${proteinPerMeal}g/meal)`);

  return {
    assignedTemplate,
    proteinPerDay,
    proteinPerMeal,
    caloriesPerDay
  };
}

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 */
function calculateBMR(weightKg: number, heightCm: number, age: number, sex: string): number {
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  return sex === "male" ? base + 5 : base - 161;
}

/**
 * Get activity level multiplier for TDEE calculation
 */
function getActivityMultiplier(activityLevel?: string): number {
  if (!activityLevel) return 1.4; // default to lightly active
  
  const level = activityLevel.toLowerCase();
  if (level.includes("sedentary")) return 1.2;
  if (level.includes("lightly") || level.includes("light")) return 1.375;
  if (level.includes("moderately") || level.includes("moderate")) return 1.55;
  if (level.includes("very") || level.includes("active")) return 1.725;
  if (level.includes("extremely") || level.includes("athlete")) return 1.9;
  
  return 1.4; // default
}

/**
 * Re-assign template when user changes key profile data
 */
export function shouldReassignTemplate(oldProfile: UserProfile, newProfile: UserProfile): boolean {
  return (
    oldProfile.fitnessGoal !== newProfile.fitnessGoal ||
    oldProfile.weight !== newProfile.weight ||
    oldProfile.sex !== newProfile.sex ||
    oldProfile.mealsPerDay !== newProfile.mealsPerDay
  );
}

/**
 * Get user meal preferences from database
 */
export async function getUserMealPreferences(userId: string) {
  try {
    const [prefs] = await db
      .select()
      .from(userMealPrefs)
      .where(eq(userMealPrefs.userId, userId));
    
    return prefs || null;
  } catch (error) {
    console.error("Error fetching user meal preferences:", error);
    return null;
  }
}