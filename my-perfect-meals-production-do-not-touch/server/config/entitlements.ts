export type Plan = "BASIC" | "UPGRADE" | "ULTIMATE" | "TESTER_ALPHA" | "TESTER_BETA";

export const FEATURE_KEYS = {
  FRIDGE_RESCUE: "FRIDGE_RESCUE",
} as const;

export const FeatureMinPlan: Record<(typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS], Exclude<Plan, "TESTER_ALPHA" | "TESTER_BETA">> = {
  FRIDGE_RESCUE: "UPGRADE",
};

export function planMeets(min: Plan, actual: Plan) {
  const order: Plan[] = ["BASIC", "UPGRADE", "ULTIMATE", "TESTER_ALPHA", "TESTER_BETA"];
  // Testers bypass all restrictions
  if (actual === "TESTER_ALPHA" || actual === "TESTER_BETA") return true;
  return order.indexOf(actual) >= order.indexOf(min);
}