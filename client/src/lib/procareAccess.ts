import type { User } from "@/lib/auth";

/**
 * Returns true if the user has completed Phase 2 ProCare onboarding.
 *
 * Today this checks the procare_training_completed boolean on the user record.
 * In the future this can be replaced with a query against a training_completion
 * table (e.g. user_training_completion with training_type + completed_at + version)
 * without touching any callsite — all checks go through this helper.
 */
export function hasCompletedProCareTraining(user: User): boolean {
  return user.procareTrainingCompleted === true;
}

/**
 * Returns true if the professional is fully cleared to enter the ProCare Studio.
 * Currently requires Phase 2 ProCare onboarding.
 * Phase 1 (Academy) is checked server-side via the launchpad-status endpoint.
 */
export function canAccessProCareStudio(user: User): boolean {
  if (user.isAdmin) return true;
  if (!user.professionalRole) return true;
  return hasCompletedProCareTraining(user);
}
