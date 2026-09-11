export type PilotReviewConfiguration = {
  bookingUrl: string | null;
  fallbackEmail: string | null;
};

function readHttpsUrl(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:") {
    throw new Error("PILOT_REVIEW_BOOKING_URL must use HTTPS.");
  }
  return parsed.toString();
}

function readOptionalEmail(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("PILOT_REVIEW_CONTACT_EMAIL must be a valid email address.");
  }
  return normalized;
}

export function getPilotReviewConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): PilotReviewConfiguration {
  return {
    bookingUrl: readHttpsUrl(environment.PILOT_REVIEW_BOOKING_URL),
    fallbackEmail: readOptionalEmail(environment.PILOT_REVIEW_CONTACT_EMAIL),
  };
}