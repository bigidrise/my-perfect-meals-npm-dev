/**
 * Scenario Group 18 — Family Meals
 * 4 scenarios: 3 children with different conditions, intersection of restrictions verified
 */

import type { PediatricScenario } from "../types";

export const familyMealScenarios: PediatricScenario[] = [
  // ── S088 ─ Family meal: toddler + preschool + early_school_age ────────────
  {
    id: "S088",
    description: "Family meal — toddler (no conditions) + preschool (peanut allergy) + early school age (celiac): intersection verified",
    category: "family",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s088-anchor",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: [],
    },
    request: {
      foodRequest: "pasta dinner",
      mealContext: "family_meal",
      familyProfiles: [
        {
          childId: "test-child-s088-toddler",
          ageStage: "toddler",
          allergies: [],
          medicalConditions: [],
        },
        {
          childId: "test-child-s088-preschool",
          ageStage: "preschool",
          allergies: [{ allergenId: "peanut", severity: "confirmed_allergy" }],
          medicalConditions: [],
        },
        {
          childId: "test-child-s088-esa",
          ageStage: "early_school_age",
          allergies: [{ allergenId: "wheat", severity: "clinician_elimination" }],
          medicalConditions: ["celiac_disease"],
        },
      ],
    },
    // Rules for the most restrictive child govern the shared meal
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S006",
      "MPB-S009",
      "MPB-S011",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED014",
      "MPB-FAMILY-INTERSECTION", // family intersection rule
    ],
    expectedExclusions: [
      "peanut", "peanut butter", "peanut oil",
      "wheat", "gluten", "barley", "rye",
    ],
    expectedProtocols: [
      "family-meal-intersection",
      "most-restrictive-governs",
      "celiac-strict-gluten-free",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
      "toddler-texture-adaptation",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S089 ─ Family meal: peanut allergy + gluten-free + standard ───────────
  {
    id: "S089",
    description: "Family meal — peanut allergy child + gluten-free child + standard child",
    category: "family",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s089-anchor",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: [],
    },
    request: {
      foodRequest: "taco night",
      mealContext: "family_meal",
      familyProfiles: [
        {
          childId: "test-child-s089-preschool",
          ageStage: "preschool",
          allergies: [{ allergenId: "peanut", severity: "confirmed_allergy" }],
          medicalConditions: [],
        },
        {
          childId: "test-child-s089-esa",
          ageStage: "early_school_age",
          allergies: [{ allergenId: "wheat", severity: "clinician_elimination" }],
          medicalConditions: ["celiac_disease"],
        },
        {
          childId: "test-child-s089-growing",
          ageStage: "growing_child",
          allergies: [],
          medicalConditions: [],
        },
      ],
    },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S009",
      "MPB-ALLERGY-HARD-STOP",
      "MPB-MED014",
      "MPB-FAMILY-INTERSECTION",
    ],
    expectedExclusions: [
      "peanut", "peanut butter", "peanut oil",
      "wheat", "gluten", "flour tortillas",
    ],
    expectedProtocols: [
      "family-meal-intersection",
      "most-restrictive-governs",
      "celiac-strict-gluten-free",
      "confirmed-allergy-exclusion",
      "allergen-alert-required",
    ],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectedMealType: "dinner",
  },

  // ── S090 ─ Family meal: T1D + autism + standard ────────────────────────────
  {
    id: "S090",
    description: "Family meal — T1D child + autism sensory child + standard child",
    category: "family",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s090-anchor",
      ageStage: "early_school_age",
      allergies: [],
      medicalConditions: [],
    },
    request: {
      foodRequest: "dinner",
      mealContext: "family_meal",
      familyProfiles: [
        {
          childId: "test-child-s090-t1d",
          ageStage: "growing_child",
          allergies: [],
          medicalConditions: ["type1_diabetes"],
        },
        {
          childId: "test-child-s090-autism",
          ageStage: "preschool",
          allergies: [],
          medicalConditions: ["autism_spectrum"],
          behavioralFlags: ["sensory_texture_restriction"],
        },
        {
          childId: "test-child-s090-standard",
          ageStage: "early_school_age",
          allergies: [],
          medicalConditions: [],
        },
      ],
    },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S012",
      "MPB-S016",
      "MPB-MED003",
      "MPB-MED009",
      "MPB-FAMILY-INTERSECTION",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "family-meal-intersection",
      "t1d-carb-consistent",
      "autism-sensory-texture-control",
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

  // ── S091 ─ Family meal: FTT + obesity + standard ───────────────────────────
  {
    id: "S091",
    description: "Family meal — FTT child + obesity child + standard child: caloric intersection",
    category: "family",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s091-anchor",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: [],
    },
    request: {
      foodRequest: "dinner for the whole family",
      mealContext: "family_meal",
      familyProfiles: [
        {
          childId: "test-child-s091-ftt",
          ageStage: "toddler",
          allergies: [],
          medicalConditions: ["failure_to_thrive"],
        },
        {
          childId: "test-child-s091-obesity",
          ageStage: "growing_child",
          allergies: [],
          medicalConditions: ["pediatric_obesity"],
        },
        {
          childId: "test-child-s091-standard",
          ageStage: "early_school_age",
          allergies: [],
          medicalConditions: [],
        },
      ],
    },
    expectedRulesFired: [
      "MPB-S005",
      "MPB-S011",
      "MPB-S016",
      "MPB-MED006",
      "MPB-MED007",
      "MPB-LANGUAGE-WELLNESS",
      "MPB-FAMILY-INTERSECTION",
    ],
    expectedExclusions: [],
    expectedProtocols: [
      "family-meal-intersection",
      "ftt-caloric-density",           // serve high-density options for FTT child
      "pediatric-obesity-wellness-framing",
      "no-restriction-language",
      "individual-portion-adaptation",  // each child's portion adapted
      "pediatrician-consult-note",
    ],
    mustFlagLanguage: [
      "low calorie", "diet", "lose weight", "weight loss",
      "overweight", "obese", "obesity", "fat",
    ],
    expectHardStop: false,
    expectedMealType: "dinner",
  },
];
