/** Image outcome is independent of the recipe's success and of its display URL. */
export interface ImageResult {
  generation: "not_requested" | "pending" | "succeeded" | "failed";
  verification: "not_started" | "pending" | "passed" | "failed" | "unavailable";
  persistence: "not_started" | "pending" | "durable" | "failed";
  display: "photograph" | "placeholder" | "none";
  url: string | null;
  reason: string | null;
  provider?: "openai";
  model?: string;
  requestId?: string;
  attempts: number;
  cancellation: "not_requested" | "requested_unconfirmed";
}

export function isPlaceholderImage(url?: string | null): boolean {
  if (!url) return false;
  try {
    const path = new URL(url, "https://image.invalid").pathname;
    return path.startsWith("/images/fallback/") || path.startsWith("/images/placeholders/");
  } catch { return false; }
}

export function placeholderResult(url: string | null, reason: string): ImageResult {
  return {
    generation: "failed", verification: "not_started", persistence: "not_started",
    display: url ? "placeholder" : "none", url, reason, attempts: 0,
    cancellation: "not_requested",
  };
}

export function isVerifiedPhotograph(result: ImageResult): boolean {
  return result.generation === "succeeded" && result.verification === "passed"
    && result.display === "photograph" && !!result.url && !isPlaceholderImage(result.url);
}

export function imageOutcome(result: ImageResult): "generated_verified" | "pending" | "failed" | "placeholder" {
  if (isVerifiedPhotograph(result)) return "generated_verified";
  if (result.generation === "pending") return "pending";
  if (result.generation === "failed" || result.verification === "failed" || result.verification === "unavailable") return "failed";
  return "placeholder";
}
