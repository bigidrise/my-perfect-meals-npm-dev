export type Plan = "BASIC" | "UPGRADE" | "ULTIMATE" | "TESTER_ALPHA" | "TESTER_BETA";

export const FEATURE_KEYS = { FRIDGE_RESCUE: "FRIDGE_RESCUE" } as const;

const minPlan: Record<string, Plan> = { 
  FRIDGE_RESCUE: "UPGRADE" 
};

export function hasAccess(userPlan: Plan, feature: keyof typeof FEATURE_KEYS) {
  // Alpha/Beta testers bypass all restrictions
  if (userPlan === "TESTER_ALPHA" || userPlan === "TESTER_BETA") return true;
  
  const rank = ["BASIC", "UPGRADE", "ULTIMATE"];
  const userRank = rank.indexOf(userPlan);
  const requiredRank = rank.indexOf(minPlan[feature]);
  
  return userRank >= requiredRank;
}

// For alpha testing - all users are treated as testers
export function getCurrentUserPlan(): Plan {
  // During alpha testing, everyone is a tester
  return "TESTER_ALPHA"; 
  
  // TODO: Replace with actual user plan logic when authentication is implemented
  // return user?.plan ?? "BASIC";
}