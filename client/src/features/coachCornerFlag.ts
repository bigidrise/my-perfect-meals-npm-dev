import { isAskChefVisible } from "@shared/coaching/askChefRelease";

// Owner-approved Production activation. Development still requires opt-in;
// an explicit false can hide the feature without restoring the old assessment.
export const COACHES_CORNER_ENABLED =
  isAskChefVisible(import.meta.env.PROD, import.meta.env.VITE_COACHES_CORNER_ENABLED);

export function isCoachesCornerEnabled(): boolean {
  return COACHES_CORNER_ENABLED;
}
