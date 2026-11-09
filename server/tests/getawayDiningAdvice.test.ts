import { getawayDiningScan } from "../services/getawayDiningAdvice";
import type { ProtocolScanResult } from "../services/protocolEnvelope";
const missing = { term: "ingredients", category: "anti-inflammatory-support",
  reason: "Ingredient details are required to verify optional Anti-Inflammatory support." };
const scan = (violations = [missing], instructionViolations: string[] = []): ProtocolScanResult =>
  ({ passed: false, violations, instructionViolations, message: "Fixture" });

test("only missing optional recipe evidence becomes advisory", () => {
  const result = getawayDiningScan(scan(), true);
  expect(result.scan.passed).toBe(true);
  expect(result.cautions[0]).toContain("Full restaurant ingredients are unverified");
});
test("inactive optional support does not rewrite a rejection", () => {
  expect(getawayDiningScan(scan(), false).scan.passed).toBe(false);
});
test("known optional conflicts remain blocking", () => {
  expect(getawayDiningScan(scan([{ ...missing, reason: "Contains prohibited ingredient" }]), true).scan.passed).toBe(false);
});
test.each(["allergy:milk", "alpha-gal", "pregnancy", "dietary:vegan"])("retains %s alongside missing optional evidence", category => {
  const result = getawayDiningScan(scan([missing, { term: "food", category, reason: "Actual conflict" }]), true);
  expect(result.scan.passed).toBe(false);
  expect(result.scan.violations).toEqual([{ term: "food", category, reason: "Actual conflict" }]);
});
test("preparation conflicts remain blocking", () => {
  expect(getawayDiningScan(scan([missing], ["forbidden preparation"]), true).scan.passed).toBe(false);
});
test("unclassified failures never become approvals", () => {
  expect(getawayDiningScan(scan([]), true).scan.passed).toBe(false);
});
