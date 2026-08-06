/**
 * Scenario Group 21 — Multiple Conditions Simultaneously
 * 10 scenarios: compound condition intersections, most restrictive protocol governs
 */

import type { PediatricScenario } from "../types";

export const multipleConditionScenarios: PediatricScenario[] = [
  // ── S101 ─ T1D + celiac + peanut — growing child ──────────────────────────
  {
    id: "S101",
    description: "T1D + celiac + peanut allergy — growing child: triple constraint dinner",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s101",
      ageStage: "growing_child",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy" },
        { allergenId: "wheat",  severity: "clinician_elimination" },
      ],
      medicalConditions: ["type1_diabetes", "celiac_disease"],
    },
    request: { foodRequest: "pasta dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S016",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED003",
      "MPB-MED014",
    ],
    expectedExclusions: [
      "peanut", "peanut butter", "peanut oil",
      "wheat", "gluten", "barley", "rye",
    ],
    expectedProtocols: [
      "t1d-carb-consistent",
      "celiac-strict-gluten-free",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "glycemic-index-awareness",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "GLP-1", "insulin", "lose weight", "weight loss",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S102 ─ Iron deficiency + picky eater + peanut — preschool ─────────────
  {
    id: "S102",
    description: "Iron deficiency + picky eater + peanut allergy — preschool: iron-rich + food chaining",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s102",
      ageStage: "preschool",
      allergies: [
        { allergenId: "peanut", severity: "confirmed_allergy" },
      ],
      medicalConditions: ["iron_deficiency_anemia"],
      behavioralFlags: ["picky_eater"],
    },
    request: { foodRequest: "dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED005",
      "MPB-BEH001",
    ],
    expectedExclusions: ["peanut", "peanut butter", "peanut oil"],
    expectedProtocols: [
      "iron-rich-foods-priority",
      "vitamin-c-iron-pairing",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "food-chaining-strategy",
      "accepted-food-bridge",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "force to eat", "punishment", "bribe",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S103 ─ FTT + celiac + iron deficiency — toddler ──────────────────────
  {
    id: "S103",
    description: "FTT + celiac + iron deficiency — toddler: caloric density + gluten-free + iron",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s103",
      ageStage: "toddler",
      allergies: [
        { allergenId: "wheat", severity: "clinician_elimination" },
      ],
      medicalConditions: ["failure_to_thrive", "celiac_disease", "iron_deficiency_anemia"],
    },
    request: { foodRequest: "meal to support growth" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S011",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED005",
      "MPB-MED006",
      "MPB-MED014",
    ],
    expectedExclusions: [
      "wheat", "gluten", "barley", "rye",
    ],
    expectedProtocols: [
      "ftt-caloric-density",
      "celiac-strict-gluten-free",
      "iron-rich-foods-priority",
      "vitamin-c-iron-pairing",
      "healthy-fat-fortification",
      "allergen-alert-required",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "low calorie", "diet", "lose weight", "light",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S104 ─ Autism + iron deficiency + multiple allergies — preschool ───────
  {
    id: "S104",
    description: "Autism sensory + iron deficiency + egg/milk allergy — preschool: texture + iron + exclusion",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s104",
      ageStage: "preschool",
      allergies: [
        { allergenId: "egg",  severity: "confirmed_allergy" },
        { allergenId: "milk", severity: "confirmed_allergy" },
      ],
      medicalConditions: ["autism_spectrum", "iron_deficiency_anemia"],
      behavioralFlags: ["sensory_texture_restriction"],
    },
    request: { foodRequest: "smooth dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED005",
      "MPB-MED009",
    ],
    expectedExclusions: [
      "egg", "egg white", "egg yolk",
      "milk", "dairy", "cheese", "butter",
      "mixed textures", "crunchy toppings",
    ],
    expectedProtocols: [
      "autism-sensory-texture-control",
      "uniform-texture-presentation",
      "iron-rich-foods-priority",
      "vitamin-c-iron-pairing",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "force to eat", "disguise", "ABA",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S105 ─ ADHD + T2D + obesity — growing child ───────────────────────────
  {
    id: "S105",
    description: "ADHD + T2D + pediatric obesity — growing child: structured + glycemic + wellness",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s105",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["adhd", "type2_diabetes", "pediatric_obesity"],
    },
    request: { foodRequest: "lunch" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S016",
      "MPB-S017",
      "MPB-MED004",
      "MPB-MED007",
      "MPB-MED008",
      "MPB-LANGUAGE-WELLNESS",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "adhd-structured-eating",
      "t2d-glycemic-management",
      "pediatric-obesity-wellness-framing",
      "low-glycemic-index-focus",
      "no-restriction-language",
      "minimal-meal-complexity",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "calorie deficit", "diet",
      "overweight", "obese", "fat", "GLP-1", "metformin",
      "medication", "Ritalin", "Adderall",
    ],
    expectHardStop: false,
    expectedMealType: "lunch",
  },

  // ── S106 ─ Crohn's flare + CKD — growing child ────────────────────────────
  {
    id: "S106",
    description: "Crohn's flare + CKD — growing child: low-residue + low-sodium/phosphorus",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s106",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["crohns_disease", "ckd"],
      crohnPhase: "flare",
    },
    request: { foodRequest: "dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S017",
      "MPB-MED010",
      "MPB-MED012",
    ],
    expectedExclusions: [
      "raw vegetables", "high-fiber", "seeds", "nuts", "popcorn",
      "spicy", "fried", "high-fat",
      "high-sodium", "phosphorus additives", "processed meats",
    ],
    expectedProtocols: [
      "crohns-flare-low-residue",
      "gut-gentle-preparation",
      "ckd-sodium-restriction",
      "ckd-phosphorus-restriction",
      "kidney-safe-protein-levels",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "medication", "immunosuppressant", "clinical treatment",
      "dialysis", "kidney transplant",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S107 ─ CF + celiac — early school age ────────────────────────────────
  {
    id: "S107",
    description: "Cystic Fibrosis + celiac — early school age: high-calorie + strict gluten-free",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s107",
      ageStage: "early_school_age",
      allergies: [
        { allergenId: "wheat", severity: "clinician_elimination" },
      ],
      medicalConditions: ["cystic_fibrosis", "celiac_disease"],
    },
    request: { foodRequest: "breakfast" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S010",
      "MPB-S016",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED013",
      "MPB-MED014",
    ],
    expectedExclusions: [
      "wheat", "gluten", "barley", "rye",
    ],
    expectedProtocols: [
      "cf-caloric-density",
      "celiac-strict-gluten-free",
      "fat-soluble-vitamins-support",
      "energy-dense-additions",
      "allergen-alert-required",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "low calorie", "light", "diet", "enzyme",
      "CFTR", "clinical treatment",
    ],
    expectHardStop: false,
    expectedMealType: "breakfast",
  },

  // ── S108 ─ T1D + autism + picky eater — preschool ────────────────────────
  {
    id: "S108",
    description: "T1D + autism sensory + picky eater — preschool: carb-consistent + texture + chaining",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s108",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: ["type1_diabetes", "autism_spectrum"],
      behavioralFlags: ["picky_eater", "sensory_texture_restriction"],
    },
    request: { foodRequest: "dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-S016",
      "MPB-MED003",
      "MPB-MED009",
      "MPB-BEH001",
    ],
    expectedExclusions: ["mixed textures", "crunchy", "whole nuts"],
    expectedProtocols: [
      "t1d-carb-consistent",
      "autism-sensory-texture-control",
      "food-chaining-strategy",
      "uniform-texture-presentation",
      "glycemic-index-awareness",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "GLP-1", "insulin", "lose weight",
      "force to eat", "ABA",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S109 ─ Obesity + Crohn's remission + celiac — growing child ───────────
  {
    id: "S109",
    description: "Pediatric obesity + Crohn's remission + celiac — growing child",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s109",
      ageStage: "growing_child",
      allergies: [
        { allergenId: "wheat", severity: "clinician_elimination" },
      ],
      medicalConditions: [
        "pediatric_obesity", "crohns_disease", "celiac_disease",
      ],
      crohnPhase: "remission",
    },
    request: { foodRequest: "dinner" },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S016",
      "MPB-S017",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED007",
      "MPB-MED011",
      "MPB-MED014",
      "MPB-LANGUAGE-WELLNESS",
    ],
    expectedExclusions: [
      "wheat", "gluten", "barley", "rye",
      "fried", "heavily spiced",
    ],
    expectedProtocols: [
      "pediatric-obesity-wellness-framing",
      "crohns-remission-gradual-reintroduction",
      "celiac-strict-gluten-free",
      "no-restriction-language",
      "allergen-alert-required",
      "fiber-rich-foods",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "lose weight", "weight loss", "calorie deficit",
      "overweight", "obese", "fat", "diet",
      "immunosuppressant", "steroid",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S110 ─ FTT + T1D + milk allergy — beginning foods ────────────────────
  {
    id: "S110",
    description: "FTT + T1D + milk allergy — beginning foods: caloric + carb-consistent + dairy-free purée",
    category: "multi_condition",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s110",
      ageStage: "beginning_foods",
      allergies: [
        { allergenId: "milk", severity: "confirmed_allergy" },
      ],
      medicalConditions: ["failure_to_thrive", "type1_diabetes"],
    },
    request: { foodRequest: "high-calorie baby purée" },
    expectedRulesFired: [
      "MPB-S001",
      "MPB-S002",
      "MPB-S004",
      "MPB-S008",
      "MPB-S011",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED003",
      "MPB-MED006",
    ],
    expectedExclusions: [
      "honey", "cow's milk", "dairy", "butter", "cheese", "cream",
    ],
    expectedProtocols: [
      "ftt-caloric-density",
      "t1d-carb-consistent",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "beginning-foods-texture",
      "iron-fortified-foods",
      "dairy-free-alternative",
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "homemade formula", "formula substitution",
      "GLP-1", "insulin", "lose weight",
    ],
    expectHardStop: false,
    expectedMealType: "puree",
  },
];
