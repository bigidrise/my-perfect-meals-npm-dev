/**
 * Scenario Group 15 — Cystic Fibrosis
 * 3 scenarios: high caloric density required, enzyme timing context
 */

import type { PediatricScenario } from "../types";

export const cysticFibrosisScenarios: PediatricScenario[] = [
  // ── S073 ─ CF — toddler ───────────────────────────────────────────────────
  {
    id: "S073",
    description: "Cystic Fibrosis — toddler: maximum caloric density, fat-soluble vitamin focus",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s073",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: ["cystic_fibrosis"],
    },
    request: { foodRequest: "high calorie toddler meal" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S011",
      "MPB-MED013", // CF caloric density protocol
    ],
    expectedExclusions: ["whole nuts", "popcorn"],
    expectedProtocols: [
      "cf-caloric-density",
      "fat-soluble-vitamins-support",
      "energy-dense-additions",
      "healthy-fat-fortification",
      "salt-replacement-awareness",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "low calorie", "light", "reduced fat", "diet",
      "pancreatic enzyme", "CFTR", "medication dosing",
      "clinical treatment", "lose weight",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S074 ─ CF — early school age ─────────────────────────────────────────
  {
    id: "S074",
    description: "Cystic Fibrosis — early school age: school lunch with calorie-dense options",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s074",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: ["cystic_fibrosis"],
    },
    request: { foodRequest: "school lunch", mealContext: "school_lunch" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S010",
      "MPB-S016",
      "MPB-MED013",
      "MPB-CTX001",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "cf-caloric-density",
      "fat-soluble-vitamins-support",
      "energy-dense-additions",
      "school-safe-protocol",
      "packable-lunch",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "low calorie", "light", "reduced fat", "diet",
      "enzyme", "CFTR", "medication", "lose weight",
    ],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S075 ─ CF — growing child ─────────────────────────────────────────────
  {
    id: "S075",
    description: "Cystic Fibrosis — growing child: dinner with salt-awareness and caloric density",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s075",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["cystic_fibrosis"],
    },
    request: { foodRequest: "dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S016",
      "MPB-MED013",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "cf-caloric-density",
      "fat-soluble-vitamins-support",
      "energy-dense-additions",
      "healthy-fat-fortification",
      "salt-replacement-awareness",
      "calcium-vitamin-d-support",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "low calorie", "light", "reduced fat", "diet",
      "pancreatic enzyme timing", "CFTR modulator",
      "medication", "clinical treatment", "lose weight",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },
];
