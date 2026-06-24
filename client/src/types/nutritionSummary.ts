export interface NutritionSummaryHealthItem {
  label: string;
  priority: "high" | "moderate";
}

export interface NutritionPersonalizationSummary {
  activeInputs: {
    health: NutritionSummaryHealthItem[];
    performance: { label: string; detail: string } | null;
    pregnancy: { label: string; detail: string } | null;
    therapeutic: { label: string; detail: string } | null;
    cuisine: string | null;
    dietary: string[];
    goal: string | null;
    macros: {
      calories: number | null;
      proteinG: number | null;
      carbsG: number | null;
      fatG: number | null;
    } | null;
  };
  nutritionPriorities: string[];
  compositeExplanation: string;
  conflictPolicy: string;
  hasAnyActiveProtocol: boolean;
  meta: { generatedAt: string };
}
