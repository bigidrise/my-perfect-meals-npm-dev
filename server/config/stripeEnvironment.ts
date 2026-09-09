export function isProductionStripeEnvironment(): boolean {
  return process.env.REPLIT_DEPLOYMENT === "1"
    || process.env.REPLIT_DEPLOYMENT === "true";
}

/**
 * Development must never fall back to the shared live Stripe key.
 * Production continues to use the existing live-key variable.
 */
export function getStripeSecretKey(): string {
  return isProductionStripeEnvironment()
    ? process.env.STRIPE_SECRET_KEY?.trim() ?? ""
    : process.env.STRIPE_TEST_SECRET_KEY?.trim() ?? "";
}

export function getStripePriceEnvName(liveEnvName: string): string {
  return isProductionStripeEnvironment()
    ? liveEnvName
    : liveEnvName.replace(/^STRIPE_/, "STRIPE_TEST_");
}

export function getStripePublishableKey(): string {
  return isProductionStripeEnvironment()
    ? process.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ?? ""
    : process.env.VITE_STRIPE_TEST_PUBLISHABLE_KEY?.trim() ?? "";
}