interface OnboardingWelcomeAccount {
  id: string;
  onboardingCompletedAt?: unknown;
  isSandbox?: boolean;
}

/** The personal onboarding page edits this account, not a selected household
 * member or Studio client. Guide eligibility must follow that page's saved work.
 * This is presentation only and never authorizes access or changes completion.
 */
export function onboardingWelcomeEligible(
  development: boolean,
  loading: boolean,
  account: OnboardingWelcomeAccount | null | undefined,
): boolean {
  return development && !loading && !!account
    && !account.id.startsWith("guest-") && !account.isSandbox
    && !account.onboardingCompletedAt;
}
