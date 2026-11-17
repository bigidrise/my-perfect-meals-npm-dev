import { fridgeRescueResultNotice, restoredFridgeRescueNotice } from "../fridgeRescueResultNotice";
import type { FridgeRescueCompletion } from "@shared/fridgeRescueCompletion";
const completion: FridgeRescueCompletion = {
  requestedCount: 3, returnedCount: 1, partial: true, attempts: 3, maxAttempts: 3,
  reasonCodes: ["CANDIDATES_REJECTED", "RETRY_LIMIT_REACHED"], message: "server summary",
};

test("partial results explain verification rather than silently claiming three choices", () => {
  expect(fridgeRescueResultNotice(1, completion)).toContain("Showing 1 of 3");
  expect(fridgeRescueResultNotice(1, completion)).toContain("could not be verified");
});
test("client diet filtering is explained using the actual visible count", () => {
  const message = fridgeRescueResultNotice(1, { ...completion, returnedCount: 3, partial: false, reasonCodes: [] }, true);
  expect(message).toContain("Showing 1 of 3");
  expect(message).toContain("selected diet");
});
test("complete results need no shortage notice", () => {
  expect(fridgeRescueResultNotice(3, completion)).toBeNull();
});
test("saved partial-result explanations restore unchanged", () => {
  expect(restoredFridgeRescueNotice("Only one could be verified", 1)).toBe("Only one could be verified");
});
test("older one-choice caches do not invent a rejection reason", () => {
  expect(restoredFridgeRescueNotice(undefined, 1)).toContain("does not record why");
  expect(restoredFridgeRescueNotice(undefined, 3)).toBeNull();
});
test("deleting cards from a previously complete result does not claim safety rejections", () => {
  expect(restoredFridgeRescueNotice(null, 1)).toBeNull();
});
