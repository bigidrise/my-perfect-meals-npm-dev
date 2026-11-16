/** No account is linked, selected or merged by an unverified provider email. */
export function accountEmailUniquenessEnabled(): boolean {
  return process.env.ACCOUNT_EMAIL_UNIQUENESS_ENABLED === "true";
}

export const SAFE_REGISTRATION_GUIDANCE = {
  code: "ACCOUNT_SIGNIN_REQUIRED",
  error: "Unable to create an account with these details. Try signing in or using account recovery.",
};

export function assertVerifiedProviderLink(input: {
  providerEmailVerified: boolean;
  authenticatedUserId: string | null;
  targetUserId: string;
  explicitLinkConsent: boolean;
}): void {
  if (!input.providerEmailVerified || !input.authenticatedUserId ||
      input.authenticatedUserId !== input.targetUserId || !input.explicitLinkConsent) {
    throw new Error("ACCOUNT_LINK_REAUTHENTICATION_REQUIRED");
  }
}
