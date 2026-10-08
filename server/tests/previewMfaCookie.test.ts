import express from "express";
import session from "express-session";
import request from "supertest";
import { regenerateSession, sessionCookieSecurity, clearSessionCookie } from "../lib/sessionSecurity";

test("embedded Development uses secure partitioned cookies, while local HTTP and Production keep their policies", () => {
  expect(sessionCookieSecurity("development", true)).toEqual({
    httpOnly: true, secure: true, sameSite: "none", partitioned: true,
  });
  expect(sessionCookieSecurity("development", false)).toEqual({
    httpOnly: true, secure: false, sameSite: "lax",
  });
  expect(sessionCookieSecurity("production", true)).toEqual({
    httpOnly: true, secure: true, sameSite: "none",
  });
});

test("the regenerated pending-MFA session survives the next HTTPS-proxied request", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(session({
    secret: "isolated-fixture-secret-not-a-real-credential",
    resave: false, saveUninitialized: false,
    cookie: sessionCookieSecurity("development", true),
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
  expect(cookies[0]).toContain("Partitioned");
  const challenge = await request(app).post("/fixture/challenge")
    .set("x-forwarded-proto", "https").set("Cookie", cookies.map(cookie => cookie.split(";")[0]).join("; "));
  expect(challenge.status).toBe(200);
  expect((await request(app).post("/fixture/challenge").set("x-forwarded-proto", "https")).status).toBe(400);
});

test("logout clears the same partitioned preview cookie", () => {
  const previous = process.env.REPLIT_DEV_DOMAIN;
  const env = process.env.NODE_ENV;
  try {
    process.env.REPLIT_DEV_DOMAIN = "fixture.replit.dev";
    process.env.NODE_ENV = "development";
    const clearCookie = jest.fn();
    clearSessionCookie({ clearCookie } as any);
    expect(clearCookie).toHaveBeenCalledWith("connect.sid", expect.objectContaining({
      secure: true, sameSite: "none", partitioned: true,
    }));
  } finally {
    if (previous === undefined) delete process.env.REPLIT_DEV_DOMAIN;
    else process.env.REPLIT_DEV_DOMAIN = previous;
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
  }
});
