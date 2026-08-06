/**
 * Scenario Group 16 — Hard Stops
 * 6 scenarios: PKU (×2), G-tube (×2), Early Infant (×2)
 * ALL must achieve 100% pass rate — no exceptions permitted.
 */

import type { PediatricScenario } from "../types";

export const hardStopScenarios: PediatricScenario[] = [
  // ── S076 ─ PKU — preschool ────────────────────────────────────────────────
  {
    id: "S076",
    description: "PKU — preschool: hard stop, no recipe generated, phenylalanine ban",
    category: "hard_stop",
    isHardStop: true,
    childProfile: {
      childId: "test-child-s076",
      ageStage: "preschool",
      allergies: [],
      medicalConditions: ["pku"],
    },
    request: { foodRequest: "chicken dinner" },
    expectedRulesFired: ["MPB-GATE002"], // PKU hard stop gate
    expectedExclusions: [],
    expectedProtocols: [],
    mustFlagLanguage: [],
    expectHardStop: true,
    expectHardStopReason: "pku",
  },

  // ── S077 ─ PKU — growing child ────────────────────────────────────────────
  {
    id: "S077",
    description: "PKU — growing child: hard stop regardless of meal request or stage",
    category: "hard_stop",
    isHardStop: true,
    childProfile: {
      childId: "test-child-s077",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["pku"],
    },
    request: { foodRequest: "healthy breakfast bowl" },
    expectedRulesFired: ["MPB-GATE002"],
    expectedExclusions: [],
    expectedProtocols: [],
    mustFlagLanguage: [],
    expectHardStop: true,
    expectHardStopReason: "pku",
  },

  // ── S078 ─ G-tube — toddler ───────────────────────────────────────────────
  {
    id: "S078",
    description: "G-tube — toddler: hard stop, oral meal generation not applicable",
    category: "hard_stop",
    isHardStop: true,
    childProfile: {
      childId: "test-child-s078",
      ageStage: "toddler",
      allergies: [],
      medicalConditions: ["g_tube"],
    },
    request: { foodRequest: "soft purée" },
    expectedRulesFired: ["MPB-GATE003"], // G-tube hard stop gate
    expectedExclusions: [],
    expectedProtocols: [],
    mustFlagLanguage: [],
    expectHardStop: true,
    expectHardStopReason: "g_tube",
  },

  // ── S079 ─ G-tube — growing child ─────────────────────────────────────────
  {
    id: "S079",
    description: "G-tube — growing child: hard stop regardless of food request",
    category: "hard_stop",
    isHardStop: true,
    childProfile: {
      childId: "test-child-s079",
      ageStage: "growing_child",
      allergies: [],
      medicalConditions: ["g_tube"],
    },
    request: { foodRequest: "dinner meal" },
    expectedRulesFired: ["MPB-GATE003"],
    expectedExclusions: [],
    expectedProtocols: [],
    mustFlagLanguage: [],
    expectHardStop: true,
    expectHardStopReason: "g_tube",
  },

  // ── S080 ─ Early infant — no food request ─────────────────────────────────
  {
    id: "S080",
    description: "Early infant (birth–5 months) — hard stop: breast milk/formula only education",
    category: "hard_stop",
    isHardStop: true,
    childProfile: {
      childId: "test-child-s080",
      ageStage: "early_infant",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "purée" },
    expectedRulesFired: ["MPB-GATE001"],
    expectedExclusions: [],
    expectedProtocols: [],
    mustFlagLanguage: [],
    expectHardStop: true,
    expectHardStopReason: "early_infant",
  },

  // ── S081 ─ Early infant — any meal request ────────────────────────────────
  {
    id: "S081",
    description: "Early infant — hard stop fires regardless of specific food requested",
    category: "hard_stop",
    isHardStop: true,
    childProfile: {
      childId: "test-child-s081",
      ageStage: "early_infant",
      allergies: [],
      medicalConditions: [],
    },
    request: { foodRequest: "rice cereal" },
    expectedRulesFired: ["MPB-GATE001"],
    expectedExclusions: [],
    expectedProtocols: [],
    mustFlagLanguage: ["formula modification", "homemade formula"],
    expectHardStop: true,
    expectHardStopReason: "early_infant",
  },
];
