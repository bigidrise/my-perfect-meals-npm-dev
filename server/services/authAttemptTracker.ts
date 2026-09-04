import crypto from "crypto";

export const AUTH_ATTEMPT_LIMIT = 5;
export const AUTH_ATTEMPT_WINDOW_MINUTES = 15;

export const AUTH_ATTEMPT_SCOPES = {
  loginPassword: "login_password",
  mfaTotp: "mfa_totp",
  mfaBackup: "mfa_backup",
  mfaSetupConfirm: "mfa_setup_confirm",
  mfaDisable: "mfa_disable",
} as const;

type QueryResult<Row> = { rows: Row[] };

export interface AuthAttemptQueryClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    query: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface AuthAttemptState {
  failureCount: number;
  lockedUntil: Date | null;
}

export interface AuthAttemptTracker {
  isLocked(subject: string, scope: string): Promise<boolean>;
  recordFailure(subject: string, scope: string): Promise<AuthAttemptState>;
  clear(subject: string, scope: string): Promise<void>;
}

function hmacKey(): string {
  const value = process.env.AUTH_ATTEMPT_HMAC_KEY ?? process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("AUTH_ATTEMPT_HMAC_KEY or SESSION_SECRET is required for authentication attempt tracking");
  }
  return value;
}

/**
 * Derives a non-reversible subject suitable for the durable throttle table.
 * Delimiters make subject kinds domain-separated (for example, an email can
 * never collide with a user ID having the same text).
 */
export function createAuthAttemptSubject(kind: string, identifier: string): string {
  if (!kind || !identifier) throw new Error("Authentication attempt subject requires a kind and identifier");
  const digest = crypto
    .createHmac("sha256", hmacKey())
    .update(`${kind}\u0000${identifier}`)
    .digest("base64url");
  return `h1_${digest}`;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Creates the shared PostgreSQL-backed tracker. recordFailure is one atomic
 * UPSERT, so concurrent requests cannot lose increments or create duplicate
 * throttle rows. Rows reset their rolling window without retaining event data.
 */
export function createAuthAttemptTracker(client: AuthAttemptQueryClient): AuthAttemptTracker {
  return {
    async isLocked(subject, scope) {
       const result = await client.query<{ locked: boolean }>(
        `WITH expired AS (
           DELETE FROM auth_attempt_throttles
            WHERE ctid IN (
              SELECT ctid FROM auth_attempt_throttles
               WHERE expires_at <= NOW()
               LIMIT 100
            )
         )
         SELECT locked_until > NOW() AS locked
           FROM auth_attempt_throttles
          WHERE subject = $1 AND scope = $2`,
        [subject, scope],
      );
      return result.rows[0]?.locked === true;
    },

    async recordFailure(subject, scope) {
      const result = await client.query<{ failure_count: number; locked_until: Date | string | null }>(
        `INSERT INTO auth_attempt_throttles AS target
           (subject, scope, failure_count, window_started_at, locked_until, expires_at, updated_at)
         VALUES ($1, $2, 1, NOW(), NULL, NOW() + INTERVAL '24 hours', NOW())
         ON CONFLICT (subject, scope) DO UPDATE
         SET failure_count = CASE
               WHEN target.locked_until > NOW() THEN target.failure_count
               WHEN target.window_started_at <= NOW() - INTERVAL '15 minutes' THEN 1
               ELSE target.failure_count + 1
             END,
             window_started_at = CASE
               WHEN target.locked_until > NOW() THEN target.window_started_at
               WHEN target.window_started_at <= NOW() - INTERVAL '15 minutes' THEN NOW()
               ELSE target.window_started_at
             END,
             locked_until = CASE
               WHEN target.locked_until > NOW() THEN target.locked_until
               WHEN (CASE
                 WHEN target.window_started_at <= NOW() - INTERVAL '15 minutes' THEN 1
                 ELSE target.failure_count + 1
               END) >= ${AUTH_ATTEMPT_LIMIT}
               THEN NOW() + INTERVAL '${AUTH_ATTEMPT_WINDOW_MINUTES} minutes'
               ELSE NULL
             END,
             expires_at = NOW() + INTERVAL '24 hours',
             updated_at = NOW()
         RETURNING failure_count, locked_until`,
        [subject, scope],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Authentication attempt throttle update returned no state");
      return { failureCount: Number(row.failure_count), lockedUntil: asDate(row.locked_until) };
    },

    async clear(subject, scope) {
      await client.query(
        `DELETE FROM auth_attempt_throttles WHERE subject = $1 AND scope = $2`,
        [subject, scope],
      );
    },
  };
}