import { pool } from "../db";
import {
  AUTH_ATTEMPT_SCOPES,
  createAuthAttemptSubject,
  createAuthAttemptTracker,
  type AuthAttemptQueryClient,
} from "../services/authAttemptTracker";

describe("PostgreSQL authentication attempt tracking", () => {
  const priorKey = process.env.AUTH_ATTEMPT_HMAC_KEY;
  const subject = createAuthAttemptSubject("integration", "u3-closure-concurrency");
  const first = createAuthAttemptTracker(pool as unknown as AuthAttemptQueryClient);
  const second = createAuthAttemptTracker(pool as unknown as AuthAttemptQueryClient);

  beforeAll(async () => {
    process.env.AUTH_ATTEMPT_HMAC_KEY = priorKey ?? "u3-integration-only-key";
    await first.clear(subject, AUTH_ATTEMPT_SCOPES.mfaTotp);
  });

  afterAll(async () => {
    await first.clear(subject, AUTH_ATTEMPT_SCOPES.mfaTotp);
    if (priorKey === undefined) delete process.env.AUTH_ATTEMPT_HMAC_KEY;
  });

  it("atomically shares the fifth-failure lock across service instances", async () => {
    const results = await Promise.all([
      first.recordFailure(subject, AUTH_ATTEMPT_SCOPES.mfaTotp),
      second.recordFailure(subject, AUTH_ATTEMPT_SCOPES.mfaTotp),
      first.recordFailure(subject, AUTH_ATTEMPT_SCOPES.mfaTotp),
      second.recordFailure(subject, AUTH_ATTEMPT_SCOPES.mfaTotp),
      first.recordFailure(subject, AUTH_ATTEMPT_SCOPES.mfaTotp),
    ]);

    expect(Math.max(...results.map((result) => result.failureCount))).toBe(5);
    expect(results.some((result) => result.lockedUntil instanceof Date)).toBe(true);
    await expect(second.isLocked(subject, AUTH_ATTEMPT_SCOPES.mfaTotp)).resolves.toBe(true);
  });

  it("successful verification clears only its own scope", async () => {
    await first.clear(subject, AUTH_ATTEMPT_SCOPES.mfaTotp);
    await expect(second.isLocked(subject, AUTH_ATTEMPT_SCOPES.mfaTotp)).resolves.toBe(false);
  });
});