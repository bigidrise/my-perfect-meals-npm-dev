/** @jest-environment jsdom */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import GatheringsValidationBadges from "@/components/GatheringsValidationBadges";
import { buildGatheringsValidationEvidence } from "../../../../server/services/gatheringsValidationEvidence";
const good = {
  name: "Baked Apples", description: "Warm apples.", ingredients: [{ name: "apples" }],
  instructions: ["Bake apples."], servings: 6, outcome: "success", medicalBadges: ["kosher"],
};
const passed = { passed: true, violations: [], instructionViolations: [], message: "passed" };
const withEvidence = (diet = "kosher", overrides = {}) => {
  const course = { ...good, medicalBadges: [diet], ...overrides };
  const validationEvidence = buildGatheringsValidationEvidence(course, passed, [diet]);
  return { ...course, medicalBadges: validationEvidence?.dietaryBadges ?? [], validationEvidence };
};
afterEach(cleanup);
it.each(["kosher", "halal", "vegan", "vegetarian"])("labels %s preference separately without recipe evidence", diet => {
  render(<GatheringsValidationBadges preferences={[diet]} course={{ ...good, medicalBadges: [diet] }} />);
  expect(screen.getByText(/selected preference, not recipe verification/)).toBeTruthy();
  expect(screen.getByText("Recipe dietary compliance: not verified.")).toBeTruthy();
  expect(screen.queryByText(/ingredient\/protocol checks passed/)).toBeNull();
});
it.each(["kosher", "halal", "vegan", "vegetarian"])("displays bounded %s validation evidence, never a certification claim", diet => {
  render(<GatheringsValidationBadges course={withEvidence(diet)} />);
  expect(screen.getByText(new RegExp(`^${diet} ingredient/protocol checks passed$`, "i"))).toBeTruthy();
  if (["kosher", "halal"].includes(diet)) expect(screen.getByText(/not Kosher or Halal certification/)).toBeTruthy();
  expect(screen.getByText(/Medical suitability has not been established/)).toBeTruthy();
});
it.each([[], undefined].map(medicalBadges => ({ medicalBadges })))("respects an empty or missing server badge list even with otherwise valid evidence: %j", ({ medicalBadges }) => {
  render(<GatheringsValidationBadges preferences={["kosher"]} course={{ ...withEvidence(), medicalBadges }} />);
  expect(screen.queryByText("Kosher ingredient/protocol checks passed")).toBeNull();
});
it.each(["generation_failed", "incomplete", "protocol_rejected", "duplicate_exhausted", "clinical_withheld"])(
  "never displays a positive badge for a %s course", outcome => {
    render(<GatheringsValidationBadges course={{ ...withEvidence(), outcome, _fallback: true }} />);
    expect(screen.queryByText(/ingredient\/protocol checks passed/)).toBeNull();
    expect(screen.getByText(/This course is not a cleared recipe/)).toBeTruthy();
  },
);
it.each(["unavailable", "needs_review", "available"])(
  "never turns missing nutrient values into medical clearance when nutrition is %s", status => {
    render(<GatheringsValidationBadges course={withEvidence("kosher", {
      nutrition: {}, nutritionResult: { status }, medicalBadges: ["kosher", "renal", "cardiac"],
    })} />);
    expect(screen.getByText(/Medical suitability has not been established/)).toBeTruthy();
    expect(screen.queryByText(/renal|cardiac|Medical Safety|0 mg|0g/i)).toBeNull();
  },
);
it("suppresses stale cached flags and classification without matching evidence", () => {
  render(<GatheringsValidationBadges course={{
    ...withEvidence(), instructions: ["Add pork and bake."],
    dietaryComplianceVerified: true, dietClassification: { kosherCategory: "pareve" },
  } as any} />);
  expect(screen.queryByText("Kosher ingredient/protocol checks passed")).toBeNull();
  expect(screen.queryByText(/Pareve/)).toBeNull();
});
