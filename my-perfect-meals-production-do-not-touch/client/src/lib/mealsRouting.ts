// Navigation utility for meal routing
import type { PresetMeal } from "@/features/meals/MealHubFactory";
import { breakfastMeals } from "@/data/breakfastMealsData";
import { lunchMealsData } from "@/data/lunchMealsData";
import { dinnerMealsData } from "@/data/dinnerMealsData";
import { snacksMealsData } from "@/data/snacksMealsData";

// Types
export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";
export type SearchResult = {
  id: string;
  name?: string;
  type?: MealType;
  templateSlug?: string;
};

// Main navigation function - always sends users to the section first
export function openMealByType(
  type: MealType,
  mealId?: string,
  templateSlug?: string
) {
  const q = new URLSearchParams();
  if (mealId) q.set("mealId", mealId);
  if (templateSlug) q.set("template", templateSlug);
  window.location.href = `/meals/${type}?${q.toString()}`;
}

// Build local index for meal lookup
const bundles: Record<MealType, PresetMeal[]> = {
  breakfast: breakfastMeals,
  lunch: lunchMealsData,
  dinner: dinnerMealsData,
  snacks: snacksMealsData
};

export const mealTypeById: Record<string, MealType> = {};
export const templateSlugDefaultById: Record<string, string> = {};
export const mealDisplayNameById: Record<string, string> = {};

for (const [type, meals] of Object.entries(bundles) as [MealType, PresetMeal[]][]) {
  for (const m of meals) {
    mealTypeById[m.id] = type;
    mealDisplayNameById[m.id] = m.name;
    templateSlugDefaultById[m.id] = Object.values(m.templates)[0]?.slug || "classic";
  }
}

// Search result click handler
export function onSearchResultClick(r: SearchResult) {
  const type = r.type || mealTypeById[r.id];
  if (!type) return; // unknown id
  const tpl = r.templateSlug || templateSlugDefaultById[r.id];
  openMealByType(type, r.id, tpl);
}

// Local search function for dev/testing
export function localSearchMeals(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];
  
  for (const [type, meals] of Object.entries(bundles) as [MealType, PresetMeal[]][]) {
    for (const m of meals) {
      if (m.name.toLowerCase().includes(q) || m.slug.includes(q)) {
        results.push({ 
          id: m.id, 
          name: m.name, 
          type, 
          templateSlug: Object.values(m.templates)[0]?.slug 
        });
      }
      for (const [key, t] of Object.entries(m.templates)) {
        const alias = `${m.name} ${t.name}`.toLowerCase();
        if (alias.includes(q)) {
          results.push({ 
            id: m.id, 
            name: `${m.name} — ${t.name}`, 
            type, 
            templateSlug: t.slug 
          });
        }
      }
    }
  }
  
  // Deduplicate
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.id}::${r.templateSlug || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}