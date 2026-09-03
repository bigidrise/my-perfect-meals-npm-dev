export interface MacroEstimate {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  starchyCarbs: number;
  fibrousCarbs: number;
  description: string;
}

export function mapEstimateToBoardMeal(macros: MacroEstimate, imageUrl: string | null = null) {
  const id = `described_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: macros.description,
    title: macros.description,
    imageUrl: imageUrl ?? undefined,
    ingredients: [] as any[],
    instructions: [] as any[],
    badges: [] as string[],
    medicalBadges: [] as any[],
    nutrition: {
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      starchyCarbs: macros.starchyCarbs,
      fibrousCarbs: macros.fibrousCarbs,
    },
    starchyCarbs: macros.starchyCarbs,
    fibrousCarbs: macros.fibrousCarbs,
  };
}
