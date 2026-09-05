import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_SCOPES,
  createAuthAttemptSubject,
  createAuthAttemptTracker,
  type AuthAttemptQueryClient,
} from "../services/authAttemptTracker";

describe("auth attempt tracker", () => {
  const priorSecret = process.env.AUTH_ATTEMPT_HMAC_KEY;

  beforeEach(() => {
    process.env.AUTH_ATTEMPT_HMAC_KEY = "auth-attempt-tracker-test-key";
  });

  afterAll(() => {
    if (priorSecret === undefined) delete process.env.AUTH_ATTEMPT_HMAC_KEY;
    else process.env.AUTH_ATTEMPT_HMAC_KEY = priorSecret;
  });

  it("creates deterministic, domain-separated opaque subjects", () => {
    const email = createAuthAttemptSubject("login-email", "athlete@example.com");
    expect(email).toMatch(/^h1_[A-Za-z0-9_-]{43}$/);
    expect(email).toBe(createAuthAttemptSubject("login-email", "athlete@example.com"));
    expect(email).not.toContain("athlete");
    expect(email).not.toBe(createAuthAttemptSubject("user", "athlete@example.com"));
  });

  it("uses an atomic parameterized upsert for failures", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ failure_count: AUTH_ATTEMPT_LIMIT, locked_until: "2030-01-01T00:00:00.000Z" }] });
    const tracker = createAuthAttemptTracker({ query } as unknown as AuthAttemptQueryClient);

    const state = await tracker.recordFailure("h1_subject", AUTH_ATTEMPT_SCOPES.mfaTotp);

    expect(state).toEqual({
      failureCount: AUTH_ATTEMPT_LIMIT,
      lockedUntil: new Date("2030-01-01T00:00:00.000Z"),
    });
    const [statement, values] = query.mock.calls[0];
    expect(statement).toContain("INSERT INTO auth_attempt_throttles AS target");
    expect(statement).toContain("ON CONFLICT (subject, scope) DO UPDATE");
    expect(statement).toContain("INTERVAL '15 minutes'");
    expect(values).toEqual(["h1_subject", AUTH_ATTEMPT_SCOPES.mfaTotp]);
  });

  it("uses the shared durable state for lock checks and successful clears", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const tracker = createAuthAttemptTracker({ query } as unknown as AuthAttemptQueryClient);

    await expect(tracker.isLocked("h1_subject", AUTH_ATTEMPT_SCOPES.loginPassword)).resolves.toBe(true);
    await tracker.clear("h1_subject", AUTH_ATTEMPT_SCOPES.loginPassword);

    expect(query.mock.calls[0][0]).toContain("locked_until > NOW()");
    expect(query.mock.calls[1][0]).toContain("DELETE FROM auth_attempt_throttles");
    expect(query.mock.calls[1][1]).toEqual(["h1_subject", AUTH_ATTEMPT_SCOPES.loginPassword]);
  });
});