import fs from "fs";
import path from "path";
import {
  BEARER_TOKEN_MAX_AGE_MS,
  isBearerTokenFresh,
} from "../services/authTokenService";

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");

describe("U3 closure bearer and MFA invariants", () => {
  it("accepts tokens before 30 days and rejects the boundary, later, or missing timestamps", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    expect(isBearerTokenFresh(new Date(now.getTime() - BEARER_TOKEN_MAX_AGE_MS + 1), now)).toBe(true);
    expect(isBearerTokenFresh(new Date(now.getTime() - BEARER_TOKEN_MAX_AGE_MS), now)).toBe(false);
    expect(isBearerTokenFresh(new Date(now.getTime() - BEARER_TOKEN_MAX_AGE_MS - 1), now)).toBe(false);
    expect(isBearerTokenFresh(null, now)).toBe(false);
    expect(isBearerTokenFresh(undefined, now)).toBe(false);
  });

  it("keeps equality-only token lookup inside the canonical validator", () => {
    const files = [
      "server/routes.ts",
      "server/middleware/requireAuth.ts",
      "server/routes/auth.session.ts",
      "server/routes/craving-creator.ts",
      "server/routes/studioRoutes.ts",
      "server/routes/safetyRoutes.ts",
      "server/routes/mealFinder.ts",
      "server/routes/companion-nutrition.ts",
      "server/data/weekBoardsRepo.ts",
    ];
    for (const file of files) {
      expect(read(file)).not.toContain("eq(users.authToken");
    }
    const validator = read("server/services/authTokenService.ts");
    expect(validator).toContain("eq(users.authToken, token)");
    expect(validator).toContain("gt(users.authTokenCreatedAt, cutoff)");
  });

  it("password reset revokes prior bearer credentials and requires login", () => {
    const source = read("server/routes/auth.session.ts");
    const reset = source.slice(source.indexOf('router.post("/api/auth/reset-password"'));
    expect(reset).toContain("authToken: null");
    expect(reset).toContain("authTokenCreatedAt: null");
    expect(reset).toContain("requiresLogin: true");
    expect(reset).not.toContain("authToken: newAuthToken");
  });

  it("does not issue a privileged mobile token before MFA", () => {
    const login = read("server/routes/auth.session.ts");
    expect(login).toContain("if (user.mfaEnabled)");
    expect(login).toContain("await revokeAuthToken(user.id)");
    expect(login).toContain("if (await loginRequiresPrivilegedMfa(user))");
    expect(login).toContain("mfaEnrollmentRequired: true");
    expect(login).toContain("privilegedSignup");
    expect(login).toContain("authToken: issuedCredential?.authToken ?? null");

    const challenge = read("server/routes/auth.mfa.ts");
    expect(challenge).toContain("expectedSecurityVersion: user.authSecurityVersion");
    expect(challenge).toContain("requireMfaEnabled: true");

    const auth = read("server/middleware/requireAuth.ts");
    const mfa = read("server/middleware/requireMfa.ts");
    expect(auth).toContain("bearerMfaVerified");
    expect(auth).toContain("authTokenMfaVerifiedAt");
    expect(mfa).toContain("(req as any).bearerMfaVerified !== true");
  });

  it("invalidates pre-reset browser sessions with the security version", () => {
    const auth = read("server/middleware/requireAuth.ts");
    const session = read("server/routes/auth.session.ts");
    expect(auth).toContain("sessionSecurityVersion !== user.authSecurityVersion");
    expect(auth).toContain("AUTH_REAUTHENTICATION_REQUIRED");
    expect(session).toContain("authSecurityVersion: sql`${users.authSecurityVersion} + 1`");
    expect(session).toMatch(
      /where\(and\(\s*eq\(users\.id,\s*matchedUser\.id\),\s*eq\(users\.resetTokenHash,\s*matchedUser\.resetTokenHash!?\),\s*gt\(users\.resetTokenExpires!?,\s*now\),\s*\)\)/s,
    );
    expect(session).toContain("if (!consumedReset)");
  });

  it("invalidates old proof when MFA is enrolled, replaced, or disabled", () => {
    const mfa = read("server/routes/auth.mfa.ts");
    expect(mfa.match(/authSecurityVersion: sql/g)).toHaveLength(2);
    expect(mfa.match(/authTokenMfaVerifiedAt: null/g)).toHaveLength(2);
    expect(mfa).toContain("await destroySession(req)");
    expect(mfa).toContain("expectedSecurityVersion: enrolled.authSecurityVersion");
    expect(mfa).toContain("MFA_ALREADY_ENABLED");
  });

  it("refuses production readiness without the security schema", () => {
    const prod = read("server/prod.ts");
    expect(prod).toContain("to_regclass('public.auth_attempt_throttles')");
    expect(prod).toContain("Required U3 authentication security schema is missing");
  });
});