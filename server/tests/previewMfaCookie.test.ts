import express from "express";
import session from "express-session";
import request from "supertest";
import { readFileSync } from "node:fs";
import { regenerateSession, sessionCookieSecurity, clearSessionCookie } from "../lib/sessionSecurity";

const runtimeCases = [
  { name: "Development preview", nodeEnv: "development", preview: true, published: false, partitioned: true },
  { name: "Production workspace preview", nodeEnv: "production", preview: true, published: false, partitioned: true },
  { name: "published Production domain", nodeEnv: "production", preview: true, published: true, partitioned: false },
] as const;

test("the Production entrypoint uses the shared policy with a strict Production security baseline", () => {
  const productionSource = readFileSync("server/prod.ts", "utf8");
  expect(productionSource).toContain('import { sessionCookieSecurity } from "./lib/sessionSecurity"');
  expect(productionSource).toMatch(/cookie:\s*\{\s*\.\.\.sessionCookieSecurity\("production"\)/);
});

test.each(runtimeCases)("$name uses the correct secure cookie policy", ({ nodeEnv, preview, published, partitioned }) => {
  expect(sessionCookieSecurity(nodeEnv, preview, published)).toEqual({
    httpOnly: true, secure: true, sameSite: "none",
    ...(partitioned ? { partitioned: true } : {}),
  });
});

test("local HTTP and standalone Production retain their existing cookie policies", () => {
  expect(sessionCookieSecurity("development", false, false)).toEqual({
    httpOnly: true, secure: false, sameSite: "lax",
  });
  expect(sessionCookieSecurity("production", false, false)).toEqual({
    httpOnly: true, secure: true, sameSite: "none",
  });
  expect(sessionCookieSecurity("production", false, true)).toEqual({
    httpOnly: true, secure: true, sameSite: "none",
  });
});

test("the published runtime stays secure and unpartitioned independently of NODE_ENV", () => {
  expect(sessionCookieSecurity("development", true, true)).toEqual({
    httpOnly: true, secure: true, sameSite: "none",
  });
});

test.each(runtimeCases)("$name preserves the pending-MFA session over HTTPS-proxied requests", async ({ nodeEnv, preview, published, partitioned }) => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(session({
    secret: "isolated-fixture-secret-not-a-real-credential",
    resave: false, saveUninitialized: false,
    cookie: sessionCookieSecurity(nodeEnv, preview, published),
  }));
  // Isolated transport fixture only: no password or TOTP bypass is added to
  // the application. The real challenge verifier remains unchanged.
  app.post("/fixture/password-accepted", async (req, res) => {
    await regenerateSession(req);
    (req.session as any).pendingMfaUserId = "fixture-provider";
    res.json({ mfaRequired: true });
  });
  app.post("/fixture/challenge", (req, res) => {
    if (!(req.session as any).pendingMfaUserId) return res.sendStatus(400);
    expect((req.session as any).userId).toBeUndefined();
    return res.json({ pending: true });
  });
  const login = await request(app).post("/fixture/password-accepted").set("x-forwarded-proto", "https");
  const cookies = login.headers["set-cookie"] as unknown as string[];
  expect(cookies[0]).toContain("Secure");
  expect(cookies[0]).toContain("HttpOnly");
  expect(cookies[0]).toContain("SameSite=None");
  if (partitioned) expect(cookies[0]).toContain("Partitioned");
  else expect(cookies[0]).not.toContain("Partitioned");
  const challenge = await request(app).post("/fixture/challenge")
    .set("x-forwarded-proto", "https").set("Cookie", cookies.map(cookie => cookie.split(";")[0]).join("; "));
  expect(challenge.status).toBe(200);
  expect((await request(app).post("/fixture/challenge").set("x-forwarded-proto", "https")).status).toBe(400);
});

test.each(runtimeCases)("$name logout clears the matching cookie", ({ nodeEnv, published, partitioned }) => {
  const previous = process.env.REPLIT_DEV_DOMAIN;
  const env = process.env.NODE_ENV;
  const deployment = process.env.REPLIT_DEPLOYMENT;
  try {
    process.env.REPLIT_DEV_DOMAIN = "fixture.replit.dev";
    process.env.NODE_ENV = nodeEnv;
    if (published) process.env.REPLIT_DEPLOYMENT = "1";
    else delete process.env.REPLIT_DEPLOYMENT;
    expect(sessionCookieSecurity()).toEqual(sessionCookieSecurity(nodeEnv, true, published));
    const clearCookie = jest.fn();
    clearSessionCookie({ clearCookie } as any);
    expect(clearCookie).toHaveBeenCalledWith("connect.sid", {
      path: "/", httpOnly: true, secure: true, sameSite: "none",
      ...(partitioned ? { partitioned: true } : {}),
    });
  } finally {
    if (previous === undefined) delete process.env.REPLIT_DEV_DOMAIN;
    else process.env.REPLIT_DEV_DOMAIN = previous;
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
    if (deployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = deployment;
  }
});
