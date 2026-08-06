/**
 * Scenario Group 22 — Unknown / Unrecognised ageStage
 *
 * 3 scenarios: unrecognised string, empty string, null-like value.
 * The resolver must return stageError=true, hardStop=false, and empty
 * protocols/exclusions rather than crashing or producing partial output.
 */

import type { PediatricScenario } from "../types";

export const unknownStageScenarios: PediatricScenario[] = [
  // ── S111 ─ Completely unrecognised stage string ───────────────────────────
  {
    id: "S111",
    description: "Unknown stage string — resolver must return stageError=true, no crash, no partial output",
    category: "hard_stop",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s111",
      ageStage: "unknown_developmental_stage_xyz",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "any meal" },
    expectedRulesFired: [],
    expectedExclusions: [],
    expectedProtocols: [],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectStageError: true,
  },

  // ── S112 ─ Empty string stage ────────────────────────────────────────────
  {
    id: "S112",
    description: "Empty ageStage — resolver must return stageError=true, no crash, no protocols",
    category: "hard_stop",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s112",
      ageStage: "",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "healthy snack" },
    expectedRulesFired: [],
    expectedExclusions: [],
    expectedProtocols: [],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectStageError: true,
  },

  // ── S113 ─ Stale / typo'd stage value ────────────────────────────────────
  {
    id: "S113",
    description: "Stale stage value 'toddler_2yr' — unrecognised key must not silently pass through",
    category: "hard_stop",
    isHardStop: false,
    childProfile: {
      childId: "test-child-s113",
      ageStage: "toddler_2yr",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "pasta dinner" },
    expectedRulesFired: [],
    expectedExclusions: [],
    expectedProtocols: [],
    mustFlagLanguage: [],
    expectHardStop: false,
    expectStageError: true,
  },
];
