import { UnsupportedProductMedicalClaim } from "./productMedicalClaimPolicy";

export type ProductLookupFailure = "provider_unavailable" | "invalid_response" | "unsupported_medical_claim";

/** Never serialize provider errors: they can contain prompts, profiles or keys. */
export function classifyProductLookupFailure(error: unknown): ProductLookupFailure {
  if (error instanceof UnsupportedProductMedicalClaim) return "unsupported_medical_claim";
  if (error instanceof SyntaxError || (error instanceof Error && error.message === "Product analysis was empty.")) {
    return "invalid_response";
  }
  return "provider_unavailable";
}
