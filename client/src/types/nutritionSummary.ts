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
      starchyCarbsG: number | null;
      fibrousCarbsG: number | null;
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
  carbCycleActive: boolean;
  /** Alpha-gal protocol detail — null if not active */
  alphaGal: {
    dairyTolerance: "yes" | "no" | "unsure";
    gelatinRestriction: "yes" | "no" | "unsure";
    profileComplete: boolean;
  } | null;
  hydration?: {
    tracking: {
      status: "TRACK_ONLY" | "NUMERIC_ACTIVE" | "PLAN_WITHHELD" | "NEEDS_REVIEW";
      targetKind: "point" | "range" | "floor" | "ceiling" | null;
      targetMl: number | null;
      minimumMl: number | null;
      maximumMl: number | null;
      validThrough: string | null;
    };
    liquidNutrition: {
      status: string;
      startsOn: string;
      endsOn: string;
      currentDay: number | null;
      verificationStatus: string;
    } | null;
    href: string;
  };
  professionalUpdates?: Array<{
    id: string;
    kind: "hydration" | "macros" | "meal_plan";
    title: string;
    detail: string;
    changedAt: string;
    href: string;
  }>;
  meta: { generatedAt: string };
}
