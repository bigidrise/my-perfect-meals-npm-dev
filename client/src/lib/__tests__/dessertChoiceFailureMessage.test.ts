import { DESSERT_CHOICE_MESSAGES as messages } from "@shared/dessertChoiceMessages";
import { dessertChoiceFailureMessage, dessertFailureCopy } from "../dessertResult";

test.each([
  ["DISH_IDENTITY_FAILURE", messages.identity],
  ["HUMAN_FOOD_FINAL_VALIDATION_FAILED", messages.finalChecks],
  ["HUMAN_FOOD_FINAL_VALIDATION_FAILED", messages.budget],
])("recognizes only the exact %s source-owned failure", (code, message) => {
  expect(dessertChoiceFailureMessage(422, { code, message })).toBe(message);
  expect(dessertChoiceFailureMessage(422, { code, message: `${message} Untrusted extra text` })).toBeUndefined();
});

test.each([409, 422])("recognizes structured preparation failure without changing evidence at %i", status => {
  const data = {
    code: status === 409 ? "HUMAN_FOOD_FINAL_REVIEW_REQUIRED" : "HUMAN_FOOD_FINAL_VALIDATION_FAILED",
    findings: [{ code: "final_recipe_incomplete", message: messages.incomplete }],
  };
  const original = JSON.stringify(data);
  expect(dessertChoiceFailureMessage(status, data)).toBe(messages.incomplete);
  expect(JSON.stringify(data)).toBe(original);
});

test.each([undefined, 200, 400, 401, 403, 500])("never replaces other status %s guidance", status => {
  expect(dessertChoiceFailureMessage(status, {
    code: "DISH_IDENTITY_FAILURE", message: messages.identity,
  })).toBeUndefined();
});

test.each(["final_nutrition_invalid", "final_serving_mismatch"])("preserves priority of %s guidance", code => {
  const data = {
    code: "HUMAN_FOOD_FINAL_VALIDATION_FAILED",
    findings: [{ code: "final_recipe_incomplete", message: messages.incomplete }, { code }],
  };
  expect(dessertChoiceFailureMessage(422, data)).toBeUndefined();
  expect(dessertFailureCopy(422, data).message).toContain("nutrition");
});

test.each([
  undefined,
  { code: "UNKNOWN", message: messages.identity },
  { code: "HUMAN_FOOD_FINAL_VALIDATION_FAILED", message: "Untrusted provider content" },
  { code: "HUMAN_FOOD_FINAL_VALIDATION_FAILED", findings: [{ code: "unknown", message: messages.incomplete }] },
  { code: "HUMAN_FOOD_FINAL_VALIDATION_FAILED", findings: [{ code: "final_recipe_incomplete", message: "Untrusted evidence" }] },
])("does not localize arbitrary errors or unknown findings %#", data => {
  expect(dessertChoiceFailureMessage(422, data)).toBeUndefined();
});
