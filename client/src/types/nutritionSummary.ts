export interface NutritionSummaryHealthItem {
  key: string;
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
  dietaryIdentity: string[];
  mealBuilderLabel: string | null;
  nutritionDrivers: {
    medicalConditions: NutritionSummaryHealthItem[];
    therapeuticInputs: Array<{ name: string; dose: string }>;
    liveMetrics: Array<{ label: string; value: string }>;
  } | null;
  nutritionPriorities: string[];
  compositeExplanation: string;
  conflictPolicy: string;
  hasAnyActiveProtocol: boolean;
  meta: { generatedAt: string };
}
