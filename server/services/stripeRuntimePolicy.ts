export type StripeKeyMode = "LIVE" | "TEST" | "UNKNOWN";

export function getStripeKeyMode(key = process.env.STRIPE_SECRET_KEY ?? ""): StripeKeyMode {
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "LIVE";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "TEST";
  return "UNKNOWN";
}

export function isProductionBillingRuntime(): boolean {
  return process.env.REPLIT_DEPLOYMENT === "1"
    || process.env.REPLIT_DEPLOYMENT === "true"
    || process.env.STRIPE_LIVE_BILLING_OWNER === "production";
}

export function canOwnStripeBilling(key = process.env.STRIPE_SECRET_KEY ?? ""): boolean {
  const mode = getStripeKeyMode(key);
  return mode !== "LIVE" || isProductionBillingRuntime();
}

export function assertStripeBillingOwnership(key = process.env.STRIPE_SECRET_KEY ?? ""): void {
  if (!canOwnStripeBilling(key)) {
    throw new Error(
      "Live Stripe billing is disabled outside the production billing runtime",
    );
  }
}
