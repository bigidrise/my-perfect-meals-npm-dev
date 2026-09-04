import fs from "fs";
import path from "path";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  destroySession,
  isMfaVerifiedForUser,
  regenerateSession,
} from "../lib/sessionSecurity";

describe("U3 session security helpers", () => {
  it("waits for successful session regeneration", async () => {
    const regenerate = jest.fn((callback: (error?: Error) => void) => callback());
    const req = { session: { regenerate } } as any;

    await expect(regenerateSession(req)).resolves.toBeUndefined();
    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it("fails closed when regeneration fails or middleware is unavailable", async () => {
    const failure = new Error("regeneration failed");
    const req = {
      session: {
        regenerate: (callback: (error?: Error) => void) => callback(failure),
      },
    } as any;

    await expect(regenerateSession(req)).rejects.toBe(failure);
    await expect(regenerateSession({} as any)).rejects.toThrow(
      "Session middleware is unavailable",
    );
  });

  it("waits for session destruction and propagates failures", async () => {
    const destroy = jest.fn((callback: (error?: Error) => void) => callback());
    await expect(
      destroySession({ session: { destroy } } as any),
    ).resolves.toBeUndefined();
    expect(destroy).toHaveBeenCalledTimes(1);

    const failure = new Error("destruction failed");
    await expect(
      destroySession({
        session: {
          destroy: (callback: (error?: Error) => void) => callback(failure),
        },
      } as any),
    ).rejects.toBe(failure);
  });

  it("clears the configured session cookie with matching security attributes", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const clearCookie = jest.fn();

    clearSessionCookie({ clearCookie } as any);

    expect(clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("binds MFA proof to the authenticated user identity", () => {
    expect(
      isMfaVerifiedForUser(
        { session: { mfaVerified: true, userId: "user-a" } } as any,
        "user-a",
      ),
    ).toBe(true);
    expect(
      isMfaVerifiedForUser(
        { session: { mfaVerified: true, userId: "user-b" } } as any,
        "user-a",
      ),
    ).toBe(false);
    expect(
      isMfaVerifiedForUser(
        { session: { mfaVerified: false, userId: "user-a" } } as any,
        "user-a",
      ),
    ).toBe(false);
  });
});

describe("U3 session architecture invariants", () => {
  const read = (relativePath: string) =>
    fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

  it("does not permit a production MemoryStore fallback", () => {
    const productionSource = read("prod.ts");
    const developmentSource = read("index.ts");

    expect(productionSource).toContain(
      "DATABASE_URL is required for durable production sessions",
    );
    expect(productionSource).not.toContain(
      "sessions will use default MemoryStore",
    );
    expect(productionSource).not.toContain(
      "Failed to create PG session store, using default",
    );
    expect(developmentSource).toContain(
      "server/index.ts is development-only and cannot provide durable production sessions",
    );
    expect(productionSource).toContain(
      'if (!isInitialized) return res.status(503).send("starting")',
    );
  });

  it("rotates session IDs at every authentication promotion boundary", () => {
    const authSource = read("routes/auth.session.ts");
    const mfaSource = read("routes/auth.mfa.ts");

    expect(authSource.match(/await regenerateSession\(req\)/g)).toHaveLength(4);
    expect(mfaSource.match(/await regenerateSession\(req\)/g)).toHaveLength(3);
    expect(authSource).toContain("await destroySession(req)");
    expect(authSource).toContain("clearSessionCookie(res)");
  });

  it("binds MFA proof to identity and consumes backup codes atomically", () => {
    const middlewareSource = read("middleware/requireMfa.ts");
    const mfaSource = read("routes/auth.mfa.ts");

    expect(middlewareSource).toContain(
      "isMfaVerifiedForUser(req, userId)",
    );
    expect(mfaSource).toContain(
      "eq(users.mfaBackupCodes, hashedCodes as any)",
    );
    expect(mfaSource).toContain("const authenticatedUser = await ensureAuthToken(user)");
  });
});