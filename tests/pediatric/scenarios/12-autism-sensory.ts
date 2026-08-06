/**
 * Scenario Group 12 — Autism Spectrum / Sensory Eating
 * 4 scenarios: texture constraints verified, sensory profile respected
 */

import type { PediatricScenario } from "../types";

export const autismSensoryScenarios: PediatricScenario[] = [
  // ── S061 ─ Autism — young toddler, texture constraints ────────────────────
  {
    id: "S061",
    description: "Autism spectrum — young toddler: uniform smooth texture required",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s061",
      ageStage: "young_toddler",
      allergies: [],
      medicalConditions: ["autism_spectrum"],
      behavioralFlags: ["sensory_texture_restriction"],
    },
    request: { foodRequest: "soft dinner" },
    expectedRulesFired: [
      "MPB-S001",
      "MPB-S005",
      "MPB-S008",
      "MPB-S011",
      "MPB-MED009",  // autism sensory protocol
      "MPB-BEH005",  // limited food repertoire
    ],
    expectedExclusions: ["honey", "whole nuts", "crunchy", "mixed textures"],
    expectedProtocols: [
      "autism-sensory-texture-control",
      "uniform-texture-presentation",
      "sensory-safe-ingredients",
      "young-toddler-texture",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "force to eat", "disguise food", "tricked", "hidden vegetables",
      "behavior therapy", "ABA",
    ],
    expectHardStop: false,
  },

  // ── S062 ─ Autism — toddler, smooth texture only ──────────────────────────
  {
    id: "S062",
    description: "Autism spectrum — toddler: smooth-only constraint, no mixed textures",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s062",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: ["autism_spectrum"],
      behavioralFlags: ["sensory_texture_restriction"],
    },
    request: { foodRequest: "mac and cheese" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S011",
      "MPB-MED009",
    ],
    expectedExclusions: ["whole nuts", "crunchy toppings", "popcorn", "mixed textures"],
    expectedProtocols: [
      "autism-sensory-texture-control",
      "uniform-texture-presentation",
      "smooth-only-preparation",
      "sensory-safe-ingredients",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "force to eat", "disguise food", "hide vegetables",
      "behavior therapy", "sensory integration therapy",
    ],
    expectHardStop: false,
  },

  // ── S063 ─ Autism — preschool, food bridging strategy ────────────────────
  {
    id: "S063",
    description: "Autism spectrum — preschool: food bridging to expand repertoire gently",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s063",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: ["autism_spectrum"],
      behavioralFlags: ["limited_food_repertoire", "food_neophobia"],
    },
    request: { foodRequest: "familiar food with gentle variation" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-MED009",
      "MPB-BEH002", // food exposure protocol
      "MPB-BEH005", // limited repertoire
    ],
    expectedExclusions: ["whole nuts", "popcorn", "hard candy"],
    expectedProtocols: [
      "autism-sensory-texture-control",
      "food-bridging-strategy",
      "repertoire-expansion-gradual",
      "sensory-safe-ingredients",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "force to eat", "disguise food", "trick",
      "behavior therapy", "ABA", "punishment",
    ],
    expectHardStop: false,
  },

  // ── S064 ─ Autism — early school age, sensory profile enforced ────────────
  {
    id: "S064",
    description: "Autism spectrum — early school age: full sensory profile drives meal structure",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s064",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: ["autism_spectrum"],
      behavioralFlags: ["sensory_texture_restriction", "food_neophobia"],
    },
    request: { foodRequest: "school lunch", mealContext: "school_lunch" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S010",
      "MPB-S016",
      "MPB-MED009",
      "MPB-CTX001", // school-safe
    ],
    expectedExclusions: ["whole nuts", "mixed textures", "strong-smelling ingredients"],
    expectedProtocols: [
      "autism-sensory-texture-control",
      "uniform-texture-presentation",
      "sensory-safe-ingredients",
      "school-safe-protocol",
      "packable-lunch",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "force to eat", "disguise", "hide",
      "behavior therapy", "ABA",
    ],
    expectHardStop: false,
    expectedMealType: "lunch",
  },
];
