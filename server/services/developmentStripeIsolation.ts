/**
 * Captured once per process. A billing-owner override cannot turn a Development
 * process into Production. Test is reserved for isolated, credential-free fixtures.
 */
export function resolveStripeIsolation(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== "production" && env.NODE_ENV !== "test";
}

const isolated = resolveStripeIsolation(process.env);
export function developmentStripeIsolated(): boolean { return isolated; }

export class DevelopmentStripeIsolationError extends Error {
  readonly code = "DEVELOPMENT_STRIPE_ISOLATION";
  readonly statusCode = 503;
  constructor() {
    super("Stripe and billing changes are disabled in the Development free-pilot runtime.");
  }
}

export function assertStripeOperationsAllowed(): void {
  if (isolated) throw new DevelopmentStripeIsolationError();
}
