/**
 * Scenario Group 08 — Iron Deficiency Anemia
 * 4 scenarios: iron-rich foods prioritized, vitamin C pairing required
 */

import type { PediatricScenario } from "../types";

export const ironDeficiencyScenarios: PediatricScenario[] = [
  // ── S044 ─ Iron deficiency — beginning foods ──────────────────────────────
  {
    id: "S044",
    description: "Iron deficiency anemia — beginning foods, vitamin C pairing required",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s044",
      ageStage: "beginning_foods",
      allergies: [],
      medicalConditions: ["iron_deficiency_anemia"],
    },
    request: { foodRequest: "meat purée for iron" },
    expectedRulesFired: [
      "MPB-S001",
      "MPB-S004",
      "MPB-S008",
      "MPB-S011",
      "MPB-MED005", // iron deficiency protocol
    ],
    expectedExclusions: ["honey"],
    expectedProtocols: [
      "iron-rich-foods-priority",
      "vitamin-c-iron-pairing",
      "iron-absorption-enhancers",
      "beginning-foods-texture",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "puree",
  },

  // ── S045 ─ Iron deficiency — young toddler ────────────────────────────────
  {
    id: "S045",
    description: "Iron deficiency anemia — young toddler, fortified soft foods",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s045",
      ageStage: "young_toddler",
      allergies: [],
      medicalConditions: ["iron_deficiency_anemia"],
    },
    request: { foodRequest: "soft iron-rich finger food" },
    expectedRulesFired: [
      "MPB-S001",
      "MPB-S005",
      "MPB-S008",
      "MPB-S011",
      "MPB-MED005",
    ],
    expectedExclusions: ["honey", "whole nuts"],
    expectedProtocols: [
      "iron-rich-foods-priority",
      "vitamin-c-iron-pairing",
      "iron-absorption-enhancers",
      "young-toddler-texture",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S046 ─ Iron deficiency — toddler ─────────────────────────────────────
  {
    id: "S046",
    description: "Iron deficiency anemia — toddler, lentil and spinach meal",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s046",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: ["iron_deficiency_anemia"],
    },
    request: { foodRequest: "lentil soup with vegetables" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S016",
      "MPB-MED005",
    ],
    expectedExclusions: ["whole nuts", "popcorn"],
    expectedProtocols: [
      "iron-rich-foods-priority",
      "vitamin-c-iron-pairing",
      "plant-based-iron-enhancers",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S047 ─ Iron deficiency — preschool ───────────────────────────────────
  {
    id: "S047",
    description: "Iron deficiency anemia — preschool, breakfast with iron-rich fortified cereal",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s047",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: ["iron_deficiency_anemia"],
    },
    request: { foodRequest: "breakfast cereal with fruit" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-MED005",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "iron-rich-foods-priority",
      "vitamin-c-iron-pairing",
      "iron-fortified-foods",
      "iron-absorption-enhancers",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "breakfast",
  },
];
