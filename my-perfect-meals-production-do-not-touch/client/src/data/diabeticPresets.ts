
export interface DiabeticPreset {
  id: string;
  name: string;
  description: string;
  guardrails: {
    fastingMin: number;
    fastingMax: number;
    postMealMax: number;
    carbLimit: number;
    fiberMin: number;
    giCap: number;
    mealFrequency: number;
  };
}

export const DIABETIC_PRESETS: DiabeticPreset[] = [
  {
    id: "standard",
    name: "🩺 Standard Diabetic",
    description: "ADA-recommended targets for Type 2 diabetes management",
    guardrails: {
      fastingMin: 80,
      fastingMax: 130,
      postMealMax: 180,
      carbLimit: 150,
      fiberMin: 25,
      giCap: 55,
      mealFrequency: 3,
    },
  },
  {
    id: "strict",
    name: "🎯 Strict Control",
    description: "Tighter targets for intensive management or pre-diabetes reversal",
    guardrails: {
      fastingMin: 70,
      fastingMax: 100,
      postMealMax: 140,
      carbLimit: 100,
      fiberMin: 30,
      giCap: 45,
      mealFrequency: 4,
    },
  },
  {
    id: "cardiac",
    name: "❤️ Cardiac-Diabetic",
    description: "Combined heart health + diabetes management (lower sodium, higher fiber)",
    guardrails: {
      fastingMin: 80,
      fastingMax: 130,
      postMealMax: 180,
      carbLimit: 130,
      fiberMin: 35,
      giCap: 50,
      mealFrequency: 4,
    },
  },
  {
    id: "liberal",
    name: "🌟 Liberal/Elderly",
    description: "More flexible targets for older adults or hypo-prone patients",
    guardrails: {
      fastingMin: 90,
      fastingMax: 150,
      postMealMax: 200,
      carbLimit: 180,
      fiberMin: 20,
      giCap: 60,
      mealFrequency: 3,
    },
  },
];
