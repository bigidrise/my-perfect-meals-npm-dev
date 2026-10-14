/** Pure policy: consumer Clinical access is never clinical practitioner authority. */
export const ORGANIZATION_BILLING_TERMS_VERSION = "organization-monthly-v1";
export const FOUNDER_ACTIVATION_WORKFLOW = "founder_activation_30d";
export const CLINICAL_PILOT_WINDOW_MS = 720 * 60 * 60 * 1000;

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

export function finitePilotTimestamp(value: unknown): Date {
  // Do not coerce null to the epoch or accept PostgreSQL's numeric infinities.
  const date = value instanceof Date ? new Date(value.getTime())
    : typeof value === "string" && value.trim() ? new Date(value) : new Date(NaN);
  if (!Number.isFinite(date.getTime())) {
    throw new BusinessPilotActivationError(
      "Pilot dates could not be verified. No new access was granted.", "PILOT_WINDOW_INVALID", 503,
    );
  }
  return date;
}

export function validateClinicalPilotWindow(start: unknown, end: unknown) {
  const startedAt = finitePilotTimestamp(start);
  const endsAt = finitePilotTimestamp(end);
  if (endsAt.getTime() - startedAt.getTime() !== CLINICAL_PILOT_WINDOW_MS) {
    throw new BusinessPilotActivationError(
      "Pilot duration could not be verified. No new access was granted.", "PILOT_WINDOW_INVALID", 503,
    );
  }
  return { startedAt, endsAt };
}

export function clinicalPilotWindow(now: Date) {
  const startedAt = finitePilotTimestamp(now);
  return validateClinicalPilotWindow(startedAt, new Date(startedAt.getTime() + CLINICAL_PILOT_WINDOW_MS));
}

export function requirePilotClaim(input: {
  authorizedEmail: string; accountEmail: string; revoked: boolean;
  invitationExpiresAt: Date; activatedUserId: string | null; userId: string;
}, now: Date) {
  finitePilotTimestamp(now);
  finitePilotTimestamp(input.invitationExpiresAt);
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
        finitePilotTimestamp(business.commercialAccessEndsAt) > finitePilotTimestamp(now)) {
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
