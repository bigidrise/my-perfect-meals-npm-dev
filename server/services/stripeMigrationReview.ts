export const STRIPE_OWNERSHIP_REVIEW_MESSAGE =
  "Conflicting Stripe identity ownership requires manual review";

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
  originalError?: unknown;
  error?: unknown;
};

/**
 * Drizzle wraps the PostgreSQL error, so the SQLSTATE and exact message are
 * normally on a nested cause rather than on the top-level error.
 */
export function isReviewedStripeOwnershipConflict(error: unknown): boolean {
  const visited = new Set<object>();
  let current: unknown = error;

  while (current && typeof current === "object") {
    const candidate = current as ErrorLike;
    if (visited.has(candidate)) return false;
    visited.add(candidate);

    if (
      candidate.code === "P0001" &&
      candidate.message === STRIPE_OWNERSHIP_REVIEW_MESSAGE
    ) {
      return true;
    }

    current = candidate.cause ?? candidate.originalError ?? candidate.error;
  }

  return false;
}

/**
 * Only the one known, manually-reviewable Stripe invariant may be downgraded.
 * The schema guard is deliberately awaited before the warning is emitted.
 */
export async function handleStripeMigrationFailure(
  error: unknown,
  assertSchema: () => Promise<void>,
  logWarning: (event: string, payload: Record<string, unknown>) => void = (
    event,
    payload,
  ) => console.warn(event, JSON.stringify(payload)),
): Promise<void> {
  if (!isReviewedStripeOwnershipConflict(error)) {
    throw error;
  }

  await assertSchema();
  logWarning("[ALERT] stripe_identity_ownership_review_required", {
    event: "stripe_identity_ownership_review_required",
    sqlState: "P0001",
    message: STRIPE_OWNERSHIP_REVIEW_MESSAGE,
    startup: "continued_after_stripe_schema_guard",
    dataMutation: false,
  });
}