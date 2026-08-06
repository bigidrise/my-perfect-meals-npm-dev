/**
 * Scenario Group 01 — Healthy Children
 * 8 scenarios covering all developmental stages (including early_infant hard stop)
 */

import type { PediatricScenario } from "../types";

export const healthyChildrenScenarios: PediatricScenario[] = [
  // ── S001 ─ Early Infant (hard stop) ──────────────────────────────────────
  {
    id: "S001",
    description: "Early infant (birth–5 months) — no recipe permitted",
    category: "hard_stop",
    isHardStop: true,
    childProfile: {
      childId: "test-child-s001",
      ageStage: "early_infant",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "oatmeal cereal" },
    expectedRulesFired: ["MPB-GATE001"],
    expectedExclusions: [],
    expectedProtocols: [],
    mustFlagLanguage: [],
    expectHardStop: true,
    expectHardStopReason: "early_infant",
  },

  // ── S002 ─ Beginning Foods (~6–11 months) ────────────────────────────────
  {
    id: "S002",
    description: "Healthy beginning foods — iron-rich purée, texture rules enforced",
    category: "healthy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s002",
      ageStage: "beginning_foods",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "chicken and sweet potato purée" },
    expectedRulesFired: [
      "MPB-S001", // no honey
      "MPB-S002", // no cow's milk as main drink
      "MPB-S003", // no juice
      "MPB-S004", // purée texture only
      "MPB-S008", // no raw hard vegetables
      "MPB-S011", // meat finely puréed
    ],
    expectedExclusions: ["honey"],
    expectedProtocols: ["beginning-foods-texture", "iron-fortified-foods"],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "puree",
  },

  // ── S003 ─ Young Toddler (12–23 months) ──────────────────────────────────
  {
    id: "S003",
    description: "Healthy young toddler — soft finger foods, choking safety enforced",
    category: "healthy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s003",
      ageStage: "young_toddler",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "pasta with tomato sauce" },
    expectedRulesFired: [
      "MPB-S001", // no honey
      "MPB-S005", // no whole nuts
      "MPB-S006", // grapes quartered
      "MPB-S007", // cherry tomatoes halved
      "MPB-S008", // no large raw carrot/celery/apple pieces
      "MPB-S011", // meat finely chopped
    ],
    expectedExclusions: ["honey", "whole nuts", "large nut pieces"],
    expectedProtocols: ["young-toddler-texture", "finger-food-progression"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S004 ─ Toddler (2–3 years) ───────────────────────────────────────────
  {
    id: "S004",
    description: "Healthy toddler — mac and cheese, age-appropriate portions",
    category: "healthy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s004",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "mac and cheese" },
    expectedRulesFired: [
      "MPB-S005", // no whole nuts
      "MPB-S006", // grapes quartered if included
      "MPB-S009", // no popcorn
      "MPB-S011", // meat finely chopped if included
      "MPB-S016", // limit added sugar
      "MPB-S017", // limit sodium
      "MPB-S018", // age-appropriate serving
    ],
    expectedExclusions: ["whole nuts", "popcorn"],
    expectedProtocols: ["toddler-portions", "balanced-toddler-nutrition"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S005 ─ Preschool (4–5 years) ─────────────────────────────────────────
  {
    id: "S005",
    description: "Healthy preschooler — chicken nuggets, baked version",
    category: "healthy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s005",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "chicken nuggets" },
    expectedRulesFired: [
      "MPB-S005", // no whole nuts
      "MPB-S009", // no popcorn
      "MPB-S016", // limit added sugar
      "MPB-S017", // limit sodium
      "MPB-S018", // age-appropriate serving
    ],
    expectedExclusions: ["whole nuts", "hard candy", "popcorn"],
    expectedProtocols: ["preschool-portions", "healthy-protein-preparation"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S006 ─ Early School Age (6–8 years) ──────────────────────────────────
  {
    id: "S006",
    description: "Healthy early school age — sandwich, balanced macros",
    category: "healthy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s006",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "turkey sandwich", mealContext: "school_lunch" },
    expectedRulesFired: [
      "MPB-S005", // no whole nuts
      "MPB-S012", // no high-mercury fish
      "MPB-S017", // limit sodium
      "MPB-S018", // age-appropriate serving
      "MPB-CTX001", // school-safe context
    ],
    expectedExclusions: [
      "swordfish", "shark", "king mackerel", "tilefish", "bigeye tuna",
    ],
    expectedProtocols: ["school-age-nutrition", "packable-lunch"],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S007 ─ Growing Child (9–12 years) ────────────────────────────────────
  {
    id: "S007",
    description: "Healthy growing child — rice bowl, balanced macros for growth",
    category: "healthy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s007",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "rice bowl with vegetables and chicken" },
    expectedRulesFired: [
      "MPB-S005", // no whole nuts
      "MPB-S012", // no high-mercury fish
      "MPB-S016", // limit added sugar
      "MPB-S017", // limit sodium
      "MPB-S018", // age-appropriate serving
    ],
    expectedExclusions: [
      "swordfish", "shark", "king mackerel", "tilefish", "bigeye tuna",
    ],
    expectedProtocols: ["growing-child-nutrition", "calcium-vitamin-d-support"],
    mustFlagLanguage: [],
    expectHardStop: false,
  },

  // ── S008 ─ Beginning Foods — iron-fortified first foods ──────────────────
  {
    id: "S008",
    description: "Beginning foods — iron-fortified oat cereal, texture and safety rules",
    category: "healthy",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s008",
      ageStage: "beginning_foods",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "oat baby cereal with mashed banana" },
    expectedRulesFired: [
      "MPB-S001", // no honey
      "MPB-S003", // no juice
      "MPB-S004", // purée/mash texture only
      "MPB-S008", // no raw hard foods
    ],
    expectedExclusions: ["honey", "juice", "raw hard vegetables"],
    expectedProtocols: ["beginning-foods-texture", "iron-fortified-foods", "first-foods-introduction"],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "puree",
  },
];
