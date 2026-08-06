/**
 * Scenario Group 20 — Parent Controls
 * 4 scenarios: parent override (substitute verified), never-recommend-again (lockout verified)
 */

import type { PediatricScenario } from "../types";

export const parentControlScenarios: PediatricScenario[] = [
  // ── S097 ─ Parent override — substitute verified, toddler ─────────────────
  {
    id: "S097",
    description: "Parent override — toddler: parent-specified substitute appears in place of default",
    category: "context",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s097",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: [],
      parentSubstitutes: {
        "cow's milk": "oat milk",
        "butter": "coconut oil",
      },
    },
    request: { foodRequest: "mac and cheese" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S011",
      "MPB-BEH004", // parent override rule
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "parent-override-substitution",
      "substitute-verified",
      "toddler-portions",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S098 ─ Never-recommend-again — lockout verified ───────────────────────
  {
    id: "S098",
    description: "Never-recommend-again — ingredient lockout persists across requests",
    category: "context",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s098",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: [],
      neverRecommendIngredients: ["broccoli", "peas"],
    },
    request: { foodRequest: "vegetable dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-BEH003", // never-recommend-again lockout
    ],
    expectedExclusions: ["broccoli", "peas"],
    expectedProtocols: [
      "never-recommend-lockout",
      "lockout-respected",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S099 ─ Parent override + allergy — growing child ──────────────────────
  {
    id: "S099",
    description: "Parent override + confirmed peanut allergy — growing child: override respects allergy hard stop",
    category: "context",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s099",
      ageStage: "growing_child",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy" },
      ],
      medicalConditions: [],
      parentSubstitutes: {
        "peanut butter": "sunflower seed butter",
      },
    },
    request: { foodRequest: "energy snack with nut butter" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-BEH004",
    ],
    expectedExclusions: ["peanut", "peanut butter", "peanut oil", "groundnut"],
    expectedProtocols: [
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "parent-override-substitution",
      "substitute-verified",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "snack",
  },

  // ── S100 ─ Never-recommend-again + parent override — preschool ────────────
  {
    id: "S100",
    description: "Never-recommend-again + parent substitute — preschool: both controls active simultaneously",
    category: "context",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s100",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: [],
      neverRecommendIngredients: ["spinach", "kale"],
      parentSubstitutes: {
        "white rice": "cauliflower rice",
      },
    },
    request: { foodRequest: "rice bowl with greens" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-BEH003", // lockout
      "MPB-BEH004", // override
    ],
    expectedExclusions: ["spinach", "kale"],
    expectedProtocols: [
      "never-recommend-lockout",
      "parent-override-substitution",
      "lockout-respected",
      "substitute-verified",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "dinner",
  },
];
