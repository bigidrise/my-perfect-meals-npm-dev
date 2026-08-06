/**
 * Scenario Group 13 — Crohn's Disease
 * 4 scenarios: flare vs remission phases, low-residue in flare, gradual reintroduction
 */

import type { PediatricScenario } from "../types";

export const crohnsDiseaseScenarios: PediatricScenario[] = [
  // ── S065 ─ Crohn's flare — growing child ─────────────────────────────────
  {
    id: "S065",
    description: "Crohn's disease flare — growing child: low-residue, gut-gentle protocol",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s065",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["crohns_disease"],
      crohnPhase: "flare",
    },
    request: { foodRequest: "dinner during a flare" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S016",
      "MPB-S017",
      "MPB-MED010", // Crohn's flare protocol
    ],
    expectedExclusions: [
      "raw vegetables", "high-fiber", "seeds", "nuts", "popcorn",
      "spicy", "fried", "high-fat", "lactose",
    ],
    expectedProtocols: [
      "crohns-flare-low-residue",
      "gut-gentle-preparation",
      "anti-inflammatory-focus",
      "small-frequent-meals",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "medication", "immunosuppressant", "biologics", "infliximab",
      "steroid", "prednisone", "clinical treatment",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S066 ─ Crohn's remission — growing child ──────────────────────────────
  {
    id: "S066",
    description: "Crohn's disease remission — growing child: gradual reintroduction protocol",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s066",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["crohns_disease"],
      crohnPhase: "remission",
    },
    request: { foodRequest: "balanced dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S016",
      "MPB-S017",
      "MPB-MED011", // Crohn's remission protocol
    ],
    expectedExclusions: [
      "fried", "heavily spiced", "excessive dairy",
    ],
    expectedProtocols: [
      "crohns-remission-gradual-reintroduction",
      "anti-inflammatory-focus",
      "nutrient-dense-balanced",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "medication", "immunosuppressant", "biologics",
      "steroid", "clinical treatment",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S067 ─ Crohn's flare — early school age ───────────────────────────────
  {
    id: "S067",
    description: "Crohn's disease flare — early school age: school lunch constraints",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s067",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: ["crohns_disease"],
      crohnPhase: "flare",
    },
    request: { foodRequest: "school lunch", mealContext: "school_lunch" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S010",
      "MPB-S016",
      "MPB-S017",
      "MPB-MED010",
      "MPB-CTX001",
    ],
    expectedExclusions: [
      "raw vegetables", "high-fiber", "seeds", "nuts", "popcorn",
      "spicy", "fried", "high-fat",
    ],
    expectedProtocols: [
      "crohns-flare-low-residue",
      "gut-gentle-preparation",
      "school-safe-protocol",
      "packable-lunch",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "medication", "steroid", "clinical treatment",
    ],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S068 ─ Crohn's + iron deficiency — growing child ─────────────────────
  {
    id: "S068",
    description: "Crohn's remission + iron deficiency — growing child: gut-safe iron sources",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s068",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["crohns_disease", "iron_deficiency_anemia"],
      crohnPhase: "remission",
    },
    request: { foodRequest: "iron-rich dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S016",
      "MPB-MED005",
      "MPB-MED011",
    ],
    expectedExclusions: [
      "fried", "heavily spiced", "excessive dairy",
    ],
    expectedProtocols: [
      "crohns-remission-gradual-reintroduction",
      "iron-rich-foods-priority",
      "vitamin-c-iron-pairing",
      "gut-gentle-preparation",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "medication", "immunosuppressant", "clinical treatment",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },
];
