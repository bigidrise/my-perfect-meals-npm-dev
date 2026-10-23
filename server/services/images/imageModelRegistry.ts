/** Stage 3A source preparation. No automatic switching or runtime release authority. */
export interface ImageModelPolicy {
  readonly provider: "openai";
  readonly model: string;
  readonly endpoint: "/images/generations";
  readonly size: "1024x1024";
  readonly quality: "low";
  readonly shutdownDate: string | null;
  /** Planning risk reservation, NOT a guaranteed provider billing cap. */
  readonly reservationUSD: number | null;
  readonly requiresDevelopmentActivation?: boolean;
}

export const APPROVED_IMAGE_MODEL: ImageModelPolicy = Object.freeze({
  provider: "openai",
  model: "gpt-image-2.5-flare-2026-09-08",
  endpoint: "/images/generations",
  size: "1024x1024",
  quality: "low",
  shutdownDate: null,
  reservationUSD: 0.25,
  requiresDevelopmentActivation: true,
});

export const IMAGE_VERIFICATION_MODEL = "gpt-4o";
/** Source preparation is not paid runtime activation. No environment flag is set here. */
export function developmentImageActivationAllowed(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV === "development" && env.REPLIT_DEPLOYMENT !== "1" &&
    env.IMAGE_DEVELOPMENT_ACTIVATION === "approved-flare";
}
export const IMAGE_LIMITS = Object.freeze({
  maxAttempts: 2,
  timeoutMs: 150_000,
  verificationMs: 20_000,
  operationMs: 180_000,
  operationUSD: 0.50,
  processUSD: 5,
});

export const IMAGE_REQUEST_FORMAT = Object.freeze({
  output_format: "png" as const, background: "opaque" as const,
  moderation: "auto" as const,
});

export function isRetiredModel(policy: ImageModelPolicy, now = new Date()): boolean {
  return policy.shutdownDate !== null && now.toISOString().slice(0, 10) >= policy.shutdownDate;
}
