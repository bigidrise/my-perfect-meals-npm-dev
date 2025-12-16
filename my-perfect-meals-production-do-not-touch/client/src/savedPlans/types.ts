export type MealSlot = {
  id: string;
  day: string;            // ISO date (YYYY-MM-DD)
  mealType: 'breakfast'|'lunch'|'dinner'|'snack';
  title: string;
  recipeId?: string;
  nutrition?: { calories?: number; proteinG?: number; carbsG?: number; fatG?: number };
};

export type SavedPlan = {
  id: string;             // uuid
  title: string;          // "Week of 2025-08-18"
  startDate: string;      // ISO Monday
  endDate: string;        // ISO Sunday
  createdAt: string;      // ISO datetime
  slots: MealSlot[];      // the plan data
  snapshotDataUrl?: string; // PNG of the calendar (optional)
  version: 1;
};