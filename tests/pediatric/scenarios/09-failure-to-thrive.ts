/**
 * Scenario Group 09 — Failure to Thrive (FTT)
 * 4 scenarios: caloric density prioritized, growth support framing
 */

import type { PediatricScenario } from "../types";

export const failureToThriveScenarios: PediatricScenario[] = [
  // ── S048 ─ FTT — beginning foods ─────────────────────────────────────────
  {
    id: "S048",
    description: "Failure to Thrive — beginning foods, caloric density in every purée",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s048",
      ageStage: "beginning_foods",
      allergies: [],
      medicalConditions: ["failure_to_thrive"],
    },
    request: { foodRequest: "high-calorie baby purée" },
    expectedRulesFired: [
      "MPB-S001",
      "MPB-S004",
      "MPB-S008",
      "MPB-MED006", // FTT caloric density protocol
    ],
    expectedExclusions: ["honey", "low-fat", "diet"],
    expectedProtocols: [
      "ftt-caloric-density",
      "energy-dense-additions",
      "growth-support-framing",
      "beginning-foods-texture",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "low calorie", "light", "reduced fat", "diet version",
      "weight loss", "overweight",
    ],
    expectHardStop: false,
    expectedMealType: "puree",
  },

  // ── S049 ─ FTT — young toddler ────────────────────────────────────────────
  {
    id: "S049",
    description: "Failure to Thrive — young toddler, energy-dense soft foods",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s049",
      ageStage: "young_toddler",
      allergies: [],
      medicalConditions: ["failure_to_thrive"],
    },
    request: { foodRequest: "soft high-calorie finger food" },
    expectedRulesFired: [
      "MPB-S001",
      "MPB-S005",
      "MPB-S008",
      "MPB-S011",
      "MPB-MED006",
    ],
    expectedExclusions: ["honey", "whole nuts"],
    expectedProtocols: [
      "ftt-caloric-density",
      "energy-dense-additions",
      "healthy-fat-fortification",
      "growth-support-framing",
      "young-toddler-texture",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "low calorie", "light", "reduced fat", "diet",
      "weight loss", "portion control",
    ],
    expectHardStop: false,
  },

  // ── S050 ─ FTT — toddler ──────────────────────────────────────────────────
  {
    id: "S050",
    description: "Failure to Thrive — toddler, caloric fortification in pasta",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s050",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: ["failure_to_thrive"],
    },
    request: { foodRequest: "pasta with sauce" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S016",
      "MPB-MED006",
    ],
    expectedExclusions: ["whole nuts", "popcorn"],
    expectedProtocols: [
      "ftt-caloric-density",
      "energy-dense-additions",
      "healthy-fat-fortification",
      "growth-support-framing",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "low calorie", "light", "reduced fat", "diet",
      "weight loss", "slim", "overweight",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S051 ─ FTT — preschool ────────────────────────────────────────────────
  {
    id: "S051",
    description: "Failure to Thrive — preschool, every meal opportunity maximized for calories",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s051",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: ["failure_to_thrive"],
    },
    request: { foodRequest: "breakfast to support growth" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-MED006",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "ftt-caloric-density",
      "energy-dense-additions",
      "healthy-fat-fortification",
      "growth-support-framing",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "low calorie", "light", "reduced fat", "diet",
      "weight loss", "overweight", "obese",
    ],
    expectHardStop: false,
    expectedMealType: "breakfast",
  },
];
