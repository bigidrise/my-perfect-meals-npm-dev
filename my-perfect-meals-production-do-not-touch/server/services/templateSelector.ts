// server/services/templateSelector.ts
// Goal-based template selection for Cafeteria system

import { fitsBaseSafety, defaultRules } from "./rulesEngine";

export interface TemplateSelectionParams {
  goal: "loss" | "maint" | "gain";
  likes?: string[]; // all food preferences combined
  avoid?: string[]; // foods to avoid
  medicalFlags?: string[];
  userAllergens?: string[];
  vegOptOut?: boolean;
}

/**
 * Normalizes strings for comparison
 */
const norm = (s: string) => s?.trim().toLowerCase();

/**
 * Selects and scores templates based on user goals and preferences
 */
export function selectTemplatesForUser(
  allTemplates: any[], 
  params: TemplateSelectionParams
) {
  const likes = new Set((params.likes ?? []).map(norm));
  const avoid = new Set((params.avoid ?? []).map(norm));

  console.log(`🎯 Selecting templates for goal: ${params.goal}, likes: ${params.likes?.length || 0}, avoid: ${params.avoid?.length || 0}`);

  // Base filter: active templates that fit the goal and safety rules
  const baseFiltered = allTemplates
    .filter((t: any) => t.isActive)
    .filter((t: any) => {
      // Goal fitness - check if template supports this goal
      if (t.goalFit && Array.isArray(t.goalFit)) {
        return t.goalFit.includes(params.goal);
      }
      // If no goalFit specified, template works for all goals
      return true;
    })
    .filter((t: any) => fitsBaseSafety(t, {
      weeks: 1,
      mealsPerDay: 3,
      snacksPerDay: 1,
      targets: { calories: 2000, protein: 150 },
      medicalFlags: params.medicalFlags,
      userAllergens: params.userAllergens,
      vegOptOut: params.vegOptOut,
      dislikes: params.avoid // pass avoid list as dislikes to rules engine
    }, defaultRules))
    .filter((t: any) => {
      // Additional avoid filter (ingredients level)
      if (!avoid.size) return true;
      const ingredientNames = (t.ingredients ?? []).map((i: any) => norm(i.name));
      return !ingredientNames.some((name: string) => avoid.has(name));
    });

  console.log(`✅ Base filtered templates: ${baseFiltered.length}/${allTemplates.length}`);

  // Score and sort templates
  const scored = baseFiltered
    .map((t: any) => {
      let score = 0;
      
      // 1. Preference matching (main scoring factor)
      const ingredientNames = new Set((t.ingredients ?? []).map((i: any) => norm(i.name)));
      const likedCount = [...likes].filter(like => ingredientNames.has(like)).length;
      score += likedCount * 2; // 2 points per liked ingredient
      
      // 2. Simplicity bias (prefer easier recipes)
      const ingredientCount = (t.ingredients ?? []).length;
      const simplicityBonus = Math.max(0, 8 - ingredientCount) * 0.1;
      score += simplicityBonus;
      
      // 3. Time bias (prefer faster recipes)
      const totalTime = (t.prepTime ?? 0) + (t.cookTime ?? 0);
      const timeBonus = Math.max(0, 45 - totalTime) * 0.02;
      score += timeBonus;
      
      // 4. Goal-specific bonuses
      if (params.goal === "loss" && t.calories && t.calories < 400) {
        score += 0.5; // bonus for lower calorie meals
      }
      if (params.goal === "gain" && t.protein && t.protein > 35) {
        score += 0.5; // bonus for higher protein meals
      }
      
      return { template: t, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.template);

  console.log(`🏆 Top 5 templates by score:`, scored.slice(0, 5).map((t: any) => ({ name: t.name, type: t.type })));

  return scored;
}

/**
 * Groups templates by meal type for week assembly
 */
export function groupTemplatesByType(templates: any[]) {
  const grouped = {
    breakfast: templates.filter(t => t.type === "breakfast"),
    lunch: templates.filter(t => t.type === "lunch"),
    dinner: templates.filter(t => t.type === "dinner"),
    snack: templates.filter(t => t.type === "snack"),
  };

  console.log(`📋 Grouped templates:`, {
    breakfast: grouped.breakfast.length,
    lunch: grouped.lunch.length,
    dinner: grouped.dinner.length,
    snack: grouped.snack.length
  });

  return grouped;
}

/**
 * Ensures minimum template counts per meal type
 */
export function validateTemplateAvailability(groupedTemplates: any) {
  const issues: string[] = [];
  
  if (groupedTemplates.breakfast.length < 3) {
    issues.push(`Only ${groupedTemplates.breakfast.length} breakfast templates available (need ≥3)`);
  }
  if (groupedTemplates.lunch.length < 3) {
    issues.push(`Only ${groupedTemplates.lunch.length} lunch templates available (need ≥3)`);
  }
  if (groupedTemplates.dinner.length < 3) {
    issues.push(`Only ${groupedTemplates.dinner.length} dinner templates available (need ≥3)`);
  }
  
  if (issues.length > 0) {
    console.warn("⚠️ Template availability issues:", issues);
  }
  
  return { valid: issues.length === 0, issues };
}