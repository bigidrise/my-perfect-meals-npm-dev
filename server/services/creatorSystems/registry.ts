// server/services/creatorSystems/registry.ts
// Phase 2.2 — Structured Creator Systems
// Each creator is a config entry. No code changes needed to onboard a new creator.

export type CreatorSystemType = "chef" | "coach" | "physician" | "performance";

export interface CreatorSystemConfig {
  id: string;
  name: string;
  type: CreatorSystemType;

  supports: {
    meals: boolean;
    desserts: boolean;
    beverages: boolean;
  };

  style: {
    // HOW to cook
    techniques: string[];           // ["seared", "charred", "roasted"]

    // WHAT it should taste like
    flavorProfiles: string[];       // ["bold", "smoky", "citrus-forward"]

    // WHAT it tends to use (soft bias — not hard ingredient rules)
    ingredientBias: string[];       // ["garlic", "olive oil", "herbs"]

    // HOW to name dishes
    naming: {
      pattern: "technique-first" | "flavor-first";
      includeSauce: boolean;        // true → "…with X sauce"
      maxLength?: number;           // optional guard
    };

    // HOW instructions must be built
    instructionRules: {
      requireHighHeatProtein: boolean;  // sear/char/roast step required
      requireSauceBuild: boolean;       // deglaze/reduce/emulsify
      requireLayering: boolean;         // aromatics → liquid → finish
    };

    // HOW to write descriptions (tone)
    description: {
      tone: "chef" | "coach" | "clinical";
      forbidWords: string[];
    };
  };
}

export const creatorSystems: Record<string, CreatorSystemConfig> = {
  default: {
    id: "default",
    name: "My Perfect Meals",
    type: "chef",
    supports: { meals: true, desserts: true, beverages: true },
    style: {
      techniques: [],
      flavorProfiles: [],
      ingredientBias: [],
      naming: { pattern: "technique-first", includeSauce: false },
      instructionRules: {
        requireHighHeatProtein: false,
        requireSauceBuild: false,
        requireLayering: false,
      },
      description: {
        tone: "coach",
        forbidWords: [],
      },
    },
  },

  test_system: {
    id: "test_system",
    name: "Test Chef System",
    type: "chef",
    supports: { meals: true, desserts: true, beverages: false },
    style: {
      techniques: ["seared", "charred", "roasted"],
      flavorProfiles: ["bold", "smoky", "citrus-forward"],
      ingredientBias: ["garlic", "olive oil", "herbs"],
      naming: { pattern: "technique-first", includeSauce: true },
      instructionRules: {
        requireHighHeatProtein: true,
        requireSauceBuild: true,
        requireLayering: true,
      },
      description: {
        tone: "chef",
        forbidWords: ["delicious", "hearty", "tasty", "fragrant", "satisfying", "vibrant", "refreshing", "zesty"],
      },
    },
  },
};
