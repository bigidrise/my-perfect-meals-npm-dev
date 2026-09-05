import type { NextFunction, Request, Response } from "express";
import express from "express";
import session from "express-session";
import fs from "fs";
import supertest from "supertest";
import {
  csrfProtection,
  isTrustedRequestOrigin,
  registerCsrfProtection,
} from "../lib/csrfProtection";

function request(overrides: Record<string, any> = {}): Request {
  const headers = new Map<string, string>(
    Object.entries(overrides.headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      String(value),
    ]),
  );
  return {
    method: "POST",
    protocol: "https",
    session: {},
    get: (name: string) => headers.get(name.toLowerCase()),
    ...overrides,
    headers: Object.fromEntries(headers),
  } as unknown as Request;
}

function response() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
}

describe("U4 CSRF protection", () => {
  it("rejects an unsafe request from an untrusted origin before authentication", () => {
    const req = request({ headers: { origin: "https://attacker.example" } });
    const res = response();
    const next = jest.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CSRF_ORIGIN_REJECTED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an originless browser form but permits a marked API client", () => {
    const rejectedRes = response();
    csrfProtection(request(), rejectedRes, jest.fn());
    expect(rejectedRes.status).toHaveBeenCalledWith(403);

    const next = jest.fn();
    csrfProtection(
      request({ headers: { "x-requested-with": "XMLHttpRequest" } }),
      response(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not trust arbitrary Vercel or Replit application origins", () => {
    expect(
      isTrustedRequestOrigin(
        request({ headers: { origin: "https://evil.vercel.app" } }),
      ),
    ).toBe(false);
    expect(
      isTrustedRequestOrigin(
        request({ headers: { origin: "https://evil.replit.app" } }),
      ),
    ).toBe(false);
  });

  it("does not reintroduce browser-reachable localhost in production CORS", () => {
    const productionSource = fs.readFileSync("server/prod.ts", "utf8");
    expect(productionSource).not.toContain(
      'normalizedOrigin === "https://localhost"',
    );
    expect(productionSource).not.toContain(
      'normalizedOrigin === "http://localhost"',
    );
  });

  it("accepts an exact same-origin request", () => {
    expect(
      isTrustedRequestOrigin(
        request({
          headers: {
            origin: "https://app.myperfectmeals.ai",
            host: "app.myperfectmeals.ai",
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a cookie-authenticated mutation without a synchronizer token", () => {
    const req = request({
      session: { userId: "user-1", csrfToken: "expected" },
      headers: { origin: "https://app.myperfectmeals.ai" },
    });
    const res = response();
    const next = jest.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CSRF_TOKEN_INVALID" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a mismatched token and accepts the exact token", () => {
    const invalidReq = request({
      session: { userId: "user-1", csrfToken: "expected-token" },
      headers: {
        origin: "https://app.myperfectmeals.ai",
        "x-csrf-token": "wrong-token",
      },
    });
    const invalidRes = response();
    csrfProtection(invalidReq, invalidRes, jest.fn());
    expect(invalidRes.status).toHaveBeenCalledWith(403);

    const validReq = request({
      session: { userId: "user-1", csrfToken: "expected-token" },
      headers: {
        origin: "https://app.myperfectmeals.ai",
        "x-csrf-token": "expected-token",
      },
    });
    const validNext = jest.fn();
    csrfProtection(validReq, response(), validNext);
    expect(validNext).toHaveBeenCalledTimes(1);
  });

  it("issues CSRF protection for an authenticated MFA-enrollment-pending session", () => {
    let bootstrapHandler:
      | ((req: Request, res: Response) => unknown)
      | undefined;
    const app = {
      get: jest.fn((path: string, handler: typeof bootstrapHandler) => {
        if (path === "/api/auth/csrf") bootstrapHandler = handler;
      }),
      use: jest.fn(),
    };
    registerCsrfProtection(app as any);

    const req = request({
      method: "GET",
      session: {
        userId: "privileged-user",
        authSecurityVersion: 3,
        mfaVerified: false,
      },
    });
    const res = response();

    expect(bootstrapHandler).toBeDefined();
    bootstrapHandler!(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.json).toHaveBeenCalledWith({
      csrfToken: expect.any(String),
    });
    expect((req.session as any).csrfToken).toEqual(expect.any(String));
  });

  it("requires the issued CSRF token for MFA enrollment mutations", () => {
    const missingTokenReq = request({
      path: "/api/auth/mfa/setup/begin",
      session: {
        userId: "privileged-user",
        csrfToken: "enrollment-token",
        mfaVerified: false,
      },
      headers: { origin: "https://app.myperfectmeals.com" },
    });
    const missingTokenRes = response();
    csrfProtection(missingTokenReq, missingTokenRes, jest.fn());
    expect(missingTokenRes.status).toHaveBeenCalledWith(403);
    expect(missingTokenRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CSRF_TOKEN_INVALID" }),
    );

    const validNext = jest.fn();
    csrfProtection(
      request({
        path: "/api/auth/mfa/setup/confirm",
        session: {
          userId: "privileged-user",
          csrfToken: "enrollment-token",
          mfaVerified: false,
        },
        headers: {
          origin: "https://app.myperfectmeals.com",
          "x-csrf-token": "enrollment-token",
        },
      }),
      response(),
      validNext,
    );
    expect(validNext).toHaveBeenCalledTimes(1);
  });

  it("preserves the Production login to mandatory-MFA CSRF lifecycle", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.use(
      session({
        secret: "focused-csrf-regression-test-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: true,
          httpOnly: true,
          sameSite: "none",
        },
      }),
    );
    registerCsrfProtection(app);

    app.post("/api/auth/login", (req, res) => {
      req.session.userId = "privileged-user";
      (req.session as any).authSecurityVersion = 3;
      (req.session as any).mfaVerified = false;
      res.status(403).json({
        code: "MFA_ENROLLMENT_REQUIRED",
        mfaEnrollmentRequired: true,
      });
    });
    app.post("/api/auth/mfa/setup/begin", (_req, res) => {
      res.sendStatus(204);
    });

    const loginResponse = await supertest(app)
      .post("/api/auth/login")
      .set("Origin", "https://app.myperfectmeals.com")
      .set("Host", "app.myperfectmeals.com")
      .set("X-Forwarded-Proto", "https");
    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.code).toBe("MFA_ENROLLMENT_REQUIRED");

    const setCookie = loginResponse.headers["set-cookie"];
    expect(setCookie).toEqual(expect.any(Array));
    const sessionCookie = setCookie![0].split(";")[0];

    const bootstrapResponse = await supertest(app)
      .get("/api/auth/csrf")
      .set("Cookie", sessionCookie)
      .set("Host", "app.myperfectmeals.com")
      .set("X-Forwarded-Proto", "https");
    expect(bootstrapResponse.status).toBe(200);
    expect(bootstrapResponse.body.csrfToken).toEqual(expect.any(String));

    const missingTokenResponse = await supertest(app)
      .post("/api/auth/mfa/setup/begin")
      .set("Cookie", sessionCookie)
      .set("Origin", "https://app.myperfectmeals.com")
      .set("Host", "app.myperfectmeals.com")
      .set("X-Forwarded-Proto", "https");
    expect(missingTokenResponse.status).toBe(403);
    expect(missingTokenResponse.body.code).toBe("CSRF_TOKEN_INVALID");

    const validTokenResponse = await supertest(app)
      .post("/api/auth/mfa/setup/begin")
      .set("Cookie", sessionCookie)
      .set("Origin", "https://app.myperfectmeals.com")
      .set("Host", "app.myperfectmeals.com")
      .set("X-Forwarded-Proto", "https")
      .set("x-csrf-token", bootstrapResponse.body.csrfToken);
    expect(validTokenResponse.status).toBe(204);
  });

  it("allows exact-origin pre-authentication requests with a stale session", () => {
    for (const path of [
      "/api/auth/signup",
      "/api/auth/login",
      "/api/auth/forgot-password",
      "/api/auth/reset-password",
    ]) {
      const next = jest.fn();
      csrfProtection(
        request({
          path,
          session: { userId: "stale-user", csrfToken: "existing-token" },
          headers: { origin: "https://app.myperfectmeals.ai" },
        }),
        response(),
        next,
      );
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it("still rejects stale-session login from an untrusted origin", () => {
    const res = response();
    const next = jest.fn();
    csrfProtection(
      request({
        path: "/api/auth/login",
        session: { userId: "stale-user", csrfToken: "existing-token" },
        headers: { origin: "https://attacker.example" },
      }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CSRF_ORIGIN_REJECTED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("allows safe methods, public callbacks, and explicit bearer requests", () => {
    for (const req of [
      request({ method: "GET" }),
      request({ headers: { "x-requested-with": "XMLHttpRequest" } }),
      request({
        session: { userId: "user-1" },
        headers: { "x-auth-token": "explicit-bearer" },
      }),
    ]) {
      const next = jest.fn();
      csrfProtection(req, response(), next);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });
});