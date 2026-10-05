import { oncologyDevelopmentReviewAllowed } from "../../shared/oncologyDevelopmentGate";
import { oncologySymptomPriorityEnabled } from "../services/guardrails/prompt/oncologySymptomPriority";

const matrix = [false, true].flatMap(developmentRuntime =>
  [false, true].flatMap(publishedRuntime =>
    [false, true].flatMap(productionProject =>
      [false, true].map(explicitDevelopmentReview =>
        ({ developmentRuntime, publishedRuntime, productionProject, explicitDevelopmentReview })))));

test.each(matrix)("shared client/server gate obeys all guards: %j", input => {
  expect(oncologyDevelopmentReviewAllowed(input)).toBe(
    input.developmentRuntime && !input.publishedRuntime &&
    (!input.productionProject || input.explicitDevelopmentReview),
  );
});

test("explicit oncology review cannot enable Production or published server runtimes", () => {
  const keys = ["NODE_ENV", "REPLIT_DEPLOYMENT", "VITE_IS_PRODUCTION_PROJECT", "VITE_ONCOLOGY_DEVELOPMENT_REVIEW_ENABLED"] as const;
  const original = keys.map(key => [key, process.env[key]] as const);
  try {
    process.env.VITE_IS_PRODUCTION_PROJECT = "true";
    process.env.VITE_ONCOLOGY_DEVELOPMENT_REVIEW_ENABLED = "true";
    delete process.env.REPLIT_DEPLOYMENT;
    process.env.NODE_ENV = "development";
    expect(oncologySymptomPriorityEnabled()).toBe(true);
    process.env.NODE_ENV = "production";
    expect(oncologySymptomPriorityEnabled()).toBe(false);
    process.env.NODE_ENV = "development";
    process.env.REPLIT_DEPLOYMENT = "1";
    expect(oncologySymptomPriorityEnabled()).toBe(false);
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.VITE_ONCOLOGY_DEVELOPMENT_REVIEW_ENABLED;
    expect(oncologySymptomPriorityEnabled()).toBe(false);
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
