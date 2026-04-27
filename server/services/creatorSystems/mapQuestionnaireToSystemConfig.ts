// server/services/creatorSystems/mapQuestionnaireToSystemConfig.ts
// Deterministic: questionnaire answers → CreatorSystemConfig
// No AI here. Answers are enums + structured inputs — output is predictable.

import { type CreatorSystemConfig } from "./registry";

const DEFAULT_FORBIDDEN_WORDS = ["delicious", "tasty", "hearty", "flavorful"];

export interface OnboardingAnswers {
  name: string;
  slug: string;
  type: "chef" | "baker" | "nutrition_coach" | "performance_coach" | "physician";
  supports: Array<"Meals" | "Desserts" | "Beverages">;
  techniques: string[];
  flavors: string[];
  ingredients: string[];
  namingPattern: "technique-first" | "flavor-first";
  includeSauce: boolean;
  highHeat: boolean;
  sauceBuild: boolean;
  layering: boolean;
  tone: "chef" | "coaching" | "clinical";
  forbiddenWords?: string[];
}

export function mapQuestionnaireToSystemConfig(input: OnboardingAnswers): CreatorSystemConfig {
  return {
    id: input.slug,
    name: input.name,
    type: input.type,

    supports: {
      meals: input.supports.includes("Meals"),
      desserts: input.supports.includes("Desserts"),
      beverages: input.supports.includes("Beverages"),
    },

    style: {
      techniques: input.techniques,
      flavorProfiles: input.flavors,
      ingredientBias: input.ingredients,

      naming: {
        pattern: input.namingPattern,
        includeSauce: input.includeSauce,
      },

      instructionRules: {
        requireHighHeatProtein: input.highHeat,
        requireSauceBuild: input.sauceBuild,
        requireLayering: input.layering,
      },

      description: {
        tone: input.tone,
        forbidWords: input.forbiddenWords?.length ? input.forbiddenWords : DEFAULT_FORBIDDEN_WORDS,
      },
    },
  };
}
