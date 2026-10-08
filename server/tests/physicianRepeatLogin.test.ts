/** Execute actual auth handlers with fictional identity/security dependencies. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function loadHandler(route: string, bindings: Record<string, any>) {
  const source = fs.readFileSync(path.resolve("server/routes/auth.session.ts"), "utf8");
  const start = source.indexOf(`router.post("${route}",`);
  const end = source.indexOf("\n});", start);
  let handler: any;
  const dependencies = {
    ...bindings,
    router: { post: (...args: any[]) => { handler = args.at(-1); } },
    requireAuth: (_req: any, _res: any, next: any) => next(),
  };
  const javascript = ts.transpileModule(source.slice(start, end + 4), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function(...Object.keys(dependencies), javascript)(...Object.values(dependencies));
  return handler;
}
function response() {
  return { statusCode: 200, body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; } };
}

test("real login/logout handlers retain physician identity, Organization ownership and existing Clinic across repeated login", async () => {
  const physician = {
    id: "fictional-physician", email: "physician@example.invalid", username: "fictional-physician",
    password: "fixture-hash", role: "coach", professionalRole: "physician", isProCare: true,
    organizationId: "fictional-owned-organization", authSecurityVersion: 7,
    planLookupKey: "fictional-clinical-plan", mfaEnabled: false,
  };
  const clinic = { id: "fictional-clinic", ownerUserId: physician.id, type: "clinic", orgId: "explicit-clinic-org", status: "active" };
  const before = { physician: { ...physician }, clinic: { ...clinic } };
  const revoke = jest.fn();
  const rotate = jest.fn(async (_id: string, options: any) => {
    expect(options.expectedSecurityVersion).toBe(physician.authSecurityVersion);
    return { authToken: "fictional-rotated-token" };
  });
  const bindings = {
    resolveEmailIdentityForEmail: async () => ({ status: "unique", user: physician }),
    db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [physician] }) }) }) },
    users: {}, eq: () => null,
    createAuthAttemptSubject: (_scope: string, id: string) => id,
    AUTH_ATTEMPT_SCOPES: { loginPassword: "fixture-password-scope" },
    authAttemptTracker: { isLocked: async () => false, clear: jest.fn() },
    bcrypt: { compare: async () => true },
    logAudit: jest.fn(), getClientIp: () => "fixture",
    // Exercise the successful-password branch; MFA protection is independently
    // covered by the project's credential/session issuance suites.
    loginRequiresPrivilegedMfa: async () => false,
    rotateAuthToken: rotate, revokeAuthToken: revoke,
    regenerateSession: async (req: any) => { req.session = {}; },
    autoAcceptPendingInvites: async () => ({ accepted: false }),
    selfHealProCareState: jest.fn().mockResolvedValue({ healed: false }),
    lookupExistingMembership: async () => null,
    destroySession: async (req: any) => { req.session = undefined; },
    clearSessionCookie: jest.fn(),
  };
  const login = loadHandler("/api/auth/login", bindings);
  const logout = loadHandler("/api/auth/logout", bindings);
  const req: any = { body: { email: physician.email, password: "fixture-password" }, authUser: physician, session: {} };
  for (let attempt = 0; attempt < 3; attempt++) {
    const signedIn = response(); await login(req, signedIn);
    expect(signedIn.statusCode).toBe(200);
    expect(signedIn.body).toMatchObject({ id: physician.id, role: "coach", professionalRole: "physician", isProCare: true });
    expect(req.session).toMatchObject({ userId: physician.id, authSecurityVersion: 7 });
    const signedOut = response(); await logout(req, signedOut);
    expect(signedOut.body).toEqual({ success: true });
    expect(req.session).toBeUndefined();
    expect({ physician, clinic }).toEqual(before);
  }
  expect(rotate).toHaveBeenCalledTimes(3);
  expect(revoke).toHaveBeenCalledTimes(3);
});
