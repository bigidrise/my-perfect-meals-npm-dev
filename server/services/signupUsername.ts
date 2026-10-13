import crypto from "crypto";

const MAX_USERNAME_ATTEMPTS = 5;

/** Drizzle wraps PostgreSQL errors in `cause`; never inspect query/parameter text. */
export function signupDatabaseError(error: unknown): { code?: string; constraint?: string } {
  const visited = new Set<unknown>();
  let current = error;
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const value = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof value.code === "string") {
      return {
        code: value.code,
        constraint: typeof value.constraint === "string" ? value.constraint : undefined,
      };
    }
    current = value.cause;
  }
  return {};
}

export function isSignupEmailConflict(error: unknown): boolean {
  const failure = signupDatabaseError(error);
  return failure.code === "23505" && failure.constraint === "users_email_unique";
}

/**
 * The DB's username constraint is the authority, not a check-before-insert.
 * Each callback must own a fresh transaction: PostgreSQL aborts the transaction
 * after a uniqueness failure. Retry only that exact username constraint.
 */
export async function createWithUniqueSignupUsername<T>(
  preferredUsername: string,
  createInFreshTransaction: (username: string) => Promise<T>,
): Promise<T> {
  let username = preferredUsername;
  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
    try {
      return await createInFreshTransaction(username);
    } catch (error) {
      const failure = signupDatabaseError(error);
      if (failure.code !== "23505" || failure.constraint !== "users_username_unique"
        || attempt === MAX_USERNAME_ATTEMPTS - 1) throw error;
      // Keep the readable prefix; 96 random bits avoid sequential guessing/races.
      username = `${preferredUsername}-${crypto.randomBytes(12).toString("hex")}`;
    }
  }
  throw new Error("Signup username attempts exhausted");
}
