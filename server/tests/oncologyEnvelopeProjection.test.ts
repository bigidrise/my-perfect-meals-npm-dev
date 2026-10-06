import fs from "fs";
import path from "path";
import ts from "typescript";
import { projectOncologyRecommendationContext } from "../services/guardrails/prompt/oncologyRecommendationContext";

const keys = ["NODE_ENV", "REPLIT_DEPLOYMENT", "VITE_IS_PRODUCTION_PROJECT", "VITE_ONCOLOGY_DEVELOPMENT_REVIEW_ENABLED"] as const;
let original: Record<string, string | undefined>;
beforeEach(() => {
  original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  process.env.VITE_IS_PRODUCTION_PROJECT = "true";
  process.env.VITE_ONCOLOGY_DEVELOPMENT_REVIEW_ENABLED = "true";
});
afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
  }
});

// Exercise the actual envelope's projection expression, not a manually
// constructed envelope that already contains the field we are trying to prove.
function realEnvelopeProjection(user: object) {
  const source = ts.createSourceFile("protocolEnvelope.ts",
    fs.readFileSync(path.join(__dirname, "../services/protocolEnvelope.ts"), "utf8"), ts.ScriptTarget.Latest, true);
  let expression: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isSpreadAssignment(node) && ts.isCallExpression(node.expression)
      && node.expression.expression.getText(source) === "projectOncologyRecommendationContext") {
      expression = node.expression;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!expression) throw new Error("The authoritative envelope must project the oncology record.");
  const compiled = ts.transpileModule(expression.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return new Function("user", "projectOncologyRecommendationContext", `return ${compiled}`)(
    user, projectOncologyRecommendationContext);
}

const record = {
  enabled: true, symptoms: ["mouth_sensitivity"], source: "self",
  emphasis: { highProteinNutrientDensity: true }, locked: false,
  updatedBy: "mock-subject", updatedAt: null,
};
test("the real envelope carries the saved record under the explicit Development review opt-in", () => {
  expect(realEnvelopeProjection({ oncologySupportContext: record }).oncologySupportContext).toBe(record);
});
test.each(["production", "published", "review-disabled"])("the real envelope remains closed for %s", runtime => {
  if (runtime === "production") process.env.NODE_ENV = "production";
  if (runtime === "published") process.env.REPLIT_DEPLOYMENT = "1";
  if (runtime === "review-disabled") delete process.env.VITE_ONCOLOGY_DEVELOPMENT_REVIEW_ENABLED;
  expect(realEnvelopeProjection({ oncologySupportContext: record })).toEqual({});
});
test("an absent subject record stays absent, with no synthetic symptoms", () => {
  expect(realEnvelopeProjection({ oncologySupportContext: null })).toEqual({ oncologySupportContext: null });
});
