/**
 * Scenario Group 14 — Chronic Kidney Disease (CKD)
 * 4 scenarios: sodium/phosphorus/potassium restrictions verified
 */

import type { PediatricScenario } from "../types";

export const ckdScenarios: PediatricScenario[] = [
  // ── S069 ─ CKD — growing child ───────────────────────────────────────────
  {
    id: "S069",
    description: "CKD — growing child: low sodium + low phosphorus protocol enforced",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s069",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["ckd"],
    },
    request: { foodRequest: "dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S017", // limit sodium
      "MPB-MED012", // CKD protocol
    ],
    expectedExclusions: [
      "high-sodium", "processed cheese", "canned soup", "deli meats",
      "phosphorus additives", "dark colas", "processed meats",
      "high-potassium when restricted",
    ],
    expectedProtocols: [
      "ckd-sodium-restriction",
      "ckd-phosphorus-restriction",
      "ckd-potassium-monitoring",
      "kidney-safe-protein-levels",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "dialysis", "kidney transplant", "clinical treatment",
      "medication", "phosphate binders",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S070 ─ CKD — early school age ────────────────────────────────────────
  {
    id: "S070",
    description: "CKD — early school age: school lunch with kidney-safe ingredients",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s070",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: ["ckd"],
    },
    request: { foodRequest: "school lunch", mealContext: "school_lunch" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S010",
      "MPB-S017",
      "MPB-MED012",
      "MPB-CTX001",
    ],
    expectedExclusions: [
      "high-sodium", "processed cheese", "deli meats",
      "dark colas", "phosphorus additives",
    ],
    expectedProtocols: [
      "ckd-sodium-restriction",
      "ckd-phosphorus-restriction",
      "school-safe-protocol",
      "packable-lunch",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "dialysis", "kidney transplant", "phosphate binders",
      "clinical treatment", "medication",
    ],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S071 ─ CKD stage 3 — growing child ───────────────────────────────────
  {
    id: "S071",
    description: "CKD — growing child: protein moderation flagged alongside mineral restriction",
    category: "medical",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s071",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["ckd"],
    },
    request: { foodRequest: "high-protein dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S017",
      "MPB-MED012",
    ],
    expectedExclusions: [
      "excessive protein", "high-sodium", "phosphorus additives",
      "processed meats", "dark colas",
    ],
    expectedProtocols: [
      "ckd-sodium-restriction",
      "ckd-phosphorus-restriction",
      "kidney-safe-protein-levels",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "dialysis", "kidney failure", "clinical treatment",
      "medication dosing", "phosphate binders",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S072 ─ CKD + anemia — growing child ──────────────────────────────────
  {
    id: "S072",
    description: "CKD + iron deficiency anemia — growing child: iron sources safe for kidneys",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s072",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["ckd", "iron_deficiency_anemia"],
    },
    request: { foodRequest: "iron-rich dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S017",
      "MPB-MED005",
      "MPB-MED012",
    ],
    expectedExclusions: [
      "high-sodium", "phosphorus additives", "processed meats",
      "dark colas", "high-potassium when restricted",
    ],
    expectedProtocols: [
      "ckd-sodium-restriction",
      "ckd-phosphorus-restriction",
      "iron-rich-foods-priority",
      "vitamin-c-iron-pairing",
      "kidney-safe-protein-levels",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "dialysis", "kidney transplant", "erythropoietin",
      "clinical treatment", "medication",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },
];
