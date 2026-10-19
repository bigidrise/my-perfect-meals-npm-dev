const INGREDIENT_EXPLANATION =
  "Verified pairing ingredients are unavailable for your active food-safety restrictions. Please check a complete label or ask the venue.";

/**
 * apiJSON puts the server's JSON error response in ApiError.body.
 * Match the stable reason code, not message substrings or HTTP 503 alone.
 */
export function chefPairingIngredientNotice(error: unknown, developmentEnabled: boolean) {
  if (!developmentEnabled || !error || typeof error !== "object") return null;
  const body = (error as { body?: unknown }).body;
  if (typeof body !== "string") return null;
  let response: unknown;
  try {
    response = JSON.parse(body);
  } catch {
    return null;
  }
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  const { code, error: explanation } = response as { code?: unknown; error?: unknown };
  if (code !== "PAIRING_INGREDIENTS_UNVERIFIED") return null;
  return {
    title: "Ingredient verification required",
    description: typeof explanation === "string" && explanation.trim()
      ? explanation.trim() : INGREDIENT_EXPLANATION,
    variant: "warning" as const,
  };
}
