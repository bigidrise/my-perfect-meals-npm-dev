/**
 * Scenario Group 17 — Behavioral Feeding
 * 6 scenarios: picky eater (food chaining), food exposure tracking (acceptance 30–70%)
 */

import type { PediatricScenario } from "../types";

export const behavioralFeedingScenarios: PediatricScenario[] = [
  // ── S082 ─ Picky eater — toddler, food chaining ───────────────────────────
  {
    id: "S082",
    description: "Picky eater — toddler: food chaining strategy from accepted to bridge food",
    category: "behavioral",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s082",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: [],
      behavioralFlags: ["picky_eater"],
    },
    request: { foodRequest: "mac and cheese variation" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S016",
      "MPB-BEH001", // food chaining strategy
    ],
    expectedExclusions: ["whole nuts", "popcorn"],
    expectedProtocols: [
      "food-chaining-strategy",
      "accepted-food-bridge",
      "gradual-variation-approach",
      "positive-mealtime-framing",
    ],
    mustFlagLanguage: [
      "force to eat", "punishment", "bribe",
      "hiding vegetables", "trick", "sneak",
      "starve", "don't eat if you won't",
    ],
    expectHardStop: false,
  },

  // ── S083 ─ Picky eater — preschool, food chaining ────────────────────────
  {
    id: "S083",
    description: "Picky eater — preschool: build from familiar to new via sensory bridge",
    category: "behavioral",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s083",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: [],
      behavioralFlags: ["picky_eater", "food_neophobia"],
    },
    request: { foodRequest: "a new version of buttered noodles" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-BEH001",
    ],
    expectedExclusions: ["whole nuts", "popcorn", "hard candy"],
    expectedProtocols: [
      "food-chaining-strategy",
      "accepted-food-bridge",
      "gradual-variation-approach",
      "sensory-similarity-bridging",
      "positive-mealtime-framing",
    ],
    mustFlagLanguage: [
      "force to eat", "punishment", "bribe", "hiding", "trick",
    ],
    expectHardStop: false,
  },

  // ── S084 ─ Food exposure tracking — acceptance score 30–70%, preschool ────
  {
    id: "S084",
    description: "Food exposure tracking — preschool: acceptance 45%, exposure strategy applied",
    category: "behavioral",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s084",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: [],
      behavioralFlags: ["food_exposure_tracking"],
      foodAcceptanceScore: 45,
    },
    request: { foodRequest: "dinner with a new vegetable" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-BEH002", // food exposure protocol
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "food-exposure-strategy",
      "repeated-exposure-approach",
      "low-pressure-introduction",
      "division-of-responsibility",
    ],
    mustFlagLanguage: [
      "force to eat", "must try", "punishment", "reward",
      "clean plate club", "finish your plate",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S085 ─ Food exposure — new food introduction, toddler ─────────────────
  {
    id: "S085",
    description: "Food exposure tracking — toddler: acceptance 35%, new food alongside safe food",
    category: "behavioral",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s085",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: [],
      behavioralFlags: ["food_exposure_tracking"],
      foodAcceptanceScore: 35,
    },
    request: { foodRequest: "introduce broccoli" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S011",
      "MPB-BEH002",
    ],
    expectedExclusions: ["whole nuts", "popcorn"],
    expectedProtocols: [
      "food-exposure-strategy",
      "repeated-exposure-approach",
      "low-pressure-introduction",
      "safe-food-alongside-new",
    ],
    mustFlagLanguage: [
      "force to eat", "must try", "punishment",
      "clean plate club", "bribe",
    ],
    expectHardStop: false,
  },

  // ── S086 ─ Food neophobia — early school age ──────────────────────────────
  {
    id: "S086",
    description: "Food neophobia — early school age: fear of new foods, low-pressure strategy",
    category: "behavioral",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s086",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: [],
      behavioralFlags: ["food_neophobia", "limited_food_repertoire"],
    },
    request: { foodRequest: "dinner from familiar foods" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S010",
      "MPB-BEH002",
      "MPB-BEH005",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "food-exposure-strategy",
      "repertoire-expansion-gradual",
      "low-pressure-introduction",
      "positive-mealtime-framing",
      "familiar-safe-anchor-food",
    ],
    mustFlagLanguage: [
      "force to eat", "punishment", "bribe", "starve",
      "picky", "difficult", "problem eater",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S087 ─ Food chaining — growing child ─────────────────────────────────
  {
    id: "S087",
    description: "Picky eater + limited repertoire — growing child: food chain across texture/flavor",
    category: "behavioral",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s087",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: [],
      behavioralFlags: ["picky_eater", "limited_food_repertoire"],
    },
    request: { foodRequest: "dinner that expands on foods they already like" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-BEH001",
      "MPB-BEH005",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "food-chaining-strategy",
      "accepted-food-bridge",
      "gradual-variation-approach",
      "repertoire-expansion-gradual",
      "positive-mealtime-framing",
    ],
    mustFlagLanguage: [
      "force to eat", "punishment", "bribe", "picky eater label",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },
];
