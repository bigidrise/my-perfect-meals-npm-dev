/** Pure policy: consumer Clinical access is never clinical practitioner authority. */
export const ORGANIZATION_BILLING_TERMS_VERSION = "organization-monthly-v1";
export const FOUNDER_ACTIVATION_WORKFLOW = "founder_activation_30d";

export class BusinessPilotActivationError extends Error {
  constructor(message: string, public code: string, public statusCode = 409) {
    super(message);
  }
}

export function businessPilotActivationEnabled(): boolean {
  // Both switches require separate release/schema approval. Neither is set by startup.
  return process.env.BUSINESS_PILOT_ACTIVATION_ENABLED === "true"
    && process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED === "true";
}

export function clinicalPilotWindow(now: Date) {
  return { startedAt: now, endsAt: new Date(now.getTime() + 30 * 86400000) };
}

export function requirePilotClaim(input: {
  authorizedEmail: string; accountEmail: string; revoked: boolean;
  invitationExpiresAt: Date; activatedUserId: string | null; userId: string;
}, now: Date) {
  if (input.authorizedEmail.trim().toLowerCase() !== input.accountEmail.trim().toLowerCase()) {
    throw new BusinessPilotActivationError("Sign in with the email that received this invitation.", "EMAIL_MISMATCH", 403);
  }
  if (input.revoked) throw new BusinessPilotActivationError("Invitation revoked.", "PILOT_REVOKED", 410);
  if (input.activatedUserId && input.activatedUserId !== input.userId) {
    throw new BusinessPilotActivationError("Invitation already belongs to another account.", "PILOT_ALREADY_CLAIMED", 403);
  }
  // An existing claim is idempotent, including after its original window has ended.
  if (!input.activatedUserId && input.invitationExpiresAt <= now) {
    throw new BusinessPilotActivationError("Invitation expired.", "PILOT_INVITATION_EXPIRED", 410);
  }
}

export function assertOrganizationChargeAllowed(business: {
  commercialAccessMode: string | null;
  commercialAccessEndsAt: Date | string | null;
}, now = new Date()) {
  if (business.commercialAccessMode === "onboarding_pilot") {
    if (!business.commercialAccessEndsAt ||
        new Date(business.commercialAccessEndsAt) > now) {
      throw new BusinessPilotActivationError(
        "Your complimentary pilot is still active. No paid checkout was started.",
        "COMPLIMENTARY_PILOT_ACTIVE",
      );
    }
  }
}

export function validateOrganizationBillingConsent(
  consent: unknown, priceId: string,
): asserts consent is { accepted: true; priceId: string; termsVersion: string } {
  const value = consent as any;
  if (value?.accepted !== true || value.priceId !== priceId ||
      value.termsVersion !== ORGANIZATION_BILLING_TERMS_VERSION) {
    throw new BusinessPilotActivationError(
      "Review and explicitly accept the current Organization subscription price and billing terms.",
      "BILLING_CONSENT_REQUIRED", 400,
    );
  }
}
