/**
 * Scenario Group 11 — ADHD Eating
 * 4 scenarios: structured eating, routine focus, sensory-friendly
 */

import type { PediatricScenario } from "../types";

export const adhdEatingScenarios: PediatricScenario[] = [
  // ── S057 ─ ADHD — preschool ───────────────────────────────────────────────
  {
    id: "S057",
    description: "ADHD — preschool: structured, predictable meal, minimal complexity",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s057",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: ["adhd"],
    },
    request: { foodRequest: "lunch" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-MED008", // ADHD eating protocol
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "adhd-structured-eating",
      "minimal-meal-complexity",
      "routine-consistent-presentation",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "medication", "stimulant", "Ritalin", "Adderall", "amphetamine",
      "behavior modification", "ADHD treatment",
    ],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S058 ─ ADHD — early school age ───────────────────────────────────────
  {
    id: "S058",
    description: "ADHD — early school age: breakfast before school, routine-anchored",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s058",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: ["adhd"],
    },
    request: { foodRequest: "quick breakfast before school" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-MED008",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "adhd-structured-eating",
      "minimal-meal-complexity",
      "routine-consistent-presentation",
      "protein-rich-morning-start",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "medication timing", "stimulant", "Ritalin", "Adderall",
      "behavior", "discipline", "ADHD treatment",
    ],
    expectHardStop: false,
    expectedMealType: "breakfast",
  },

  // ── S059 ─ ADHD — growing child ───────────────────────────────────────────
  {
    id: "S059",
    description: "ADHD — growing child: after-school snack, predictable and easy to assemble",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s059",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["adhd"],
    },
    request: { foodRequest: "after school snack" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-MED008",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "adhd-structured-eating",
      "minimal-meal-complexity",
      "routine-consistent-presentation",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "medication", "stimulant", "behavior",
      "ADHD treatment", "Ritalin", "Adderall",
    ],
    expectHardStop: false,
    expectedMealType: "snack",
  },

  // ── S060 ─ ADHD + picky eater — preschool ────────────────────────────────
  {
    id: "S060",
    description: "ADHD + picky eater — preschool: food chaining + structured routine",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s060",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: ["adhd"],
      behavioralFlags: ["picky_eater"],
    },
    request: { foodRequest: "dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-MED008",
      "MPB-BEH001", // food chaining
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "adhd-structured-eating",
      "food-chaining-strategy",
      "minimal-meal-complexity",
      "routine-consistent-presentation",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "force", "make them eat", "punishment", "reward chart",
      "medication", "Ritalin", "Adderall",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },
];
