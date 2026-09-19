export function isOnboardingAllergyBootstrapAuthorized(
  fromOnboarding: unknown,
  onboardingCompletedAt: Date | string | null | undefined,
): boolean {
  return fromOnboarding === true && onboardingCompletedAt == null;
}