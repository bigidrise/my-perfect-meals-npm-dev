/** No replacement model or second provider is authorized by this registry. */
export interface ImageModelPolicy {
  readonly provider: "openai";
  readonly model: string;
  readonly endpoint: "/images/generations";
  readonly size: "1024x1024";
  readonly quality: "low";
  readonly shutdownDate: string | null;
  /** Reviewed all-in upper reservation (generation + verification). Unknown fails closed. */
  readonly reservationUSD: number | null;
}

export const APPROVED_IMAGE_MODEL: ImageModelPolicy = Object.freeze({
  provider: "openai",
  model: "gpt-image-1",
  endpoint: "/images/generations",
  size: "1024x1024",
  quality: "low",
  shutdownDate: "2026-10-23",
  reservationUSD: null,
});

export const IMAGE_VERIFICATION_MODEL = "gpt-4o";
export const IMAGE_LIMITS = Object.freeze({
  maxAttempts: 3,
  timeoutMs: 60_000,
  operationUSD: 0.50,
  processUSD: 5,
});

export function isRetiredModel(policy: ImageModelPolicy, now = new Date()): boolean {
  return policy.shutdownDate !== null && now.toISOString().slice(0, 10) >= policy.shutdownDate;
}
