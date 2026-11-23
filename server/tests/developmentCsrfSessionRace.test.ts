import express from "express";
import session from "express-session";
import supertest from "supertest";
import { registerCsrfProtection } from "../lib/csrfProtection";
import { regenerateSession } from "../lib/sessionSecurity";

describe("Saved Menu session security across environments", () => {
  it.each([
    ["development", "0"],
    ["production", "0"],
    ["development", "1"],
    ["production", "1"],
  ] as const)(
    "%s with published=%s preserves the token during overlapping session writes",
    async (environment, published) => {
      const previousEnvironment = process.env.NODE_ENV;
      const previousDeployment = process.env.REPLIT_DEPLOYMENT;
      process.env.NODE_ENV = environment;
      process.env.REPLIT_DEPLOYMENT = published;
      let releaseSlowRequest!: () => void;
      let markSlowRequestStarted!: () => void;
      const slowRequestStarted = new Promise<void>(resolve => { markSlowRequestStarted = resolve; });
      const slowRequestReleased = new Promise<void>(resolve => { releaseSlowRequest = resolve; });
      try {
        const app = express();
        app.use(session({
          secret: "isolated-development-csrf-race-fixture",
          resave: false,
          saveUninitialized: false,
          cookie: { secure: false },
        }));
        registerCsrfProtection(app);
        app.post("/api/auth/login", async (req, res, next) => {
          try {
            await regenerateSession(req);
            req.session.userId = "synthetic-menu-owner";
            res.sendStatus(204);
          } catch (error) { next(error); }
        });
        app.get("/api/slow-profile", async (req, res) => {
          // Model requireAuth's last-active write on a session loaded before
          // the token endpoint. There is no database or provider in this test.
          (req.session as typeof req.session & { lastActiveAt: number }).lastActiveAt = Date.now();
          markSlowRequestStarted();
          await slowRequestReleased;
          res.sendStatus(204);
        });
        app.post("/api/one-touch-create/restore", (_req, res) => {
          res.json({ concepts: [{ id: "one" }, { id: "two" }, { id: "three" }] });
        });
        const login = await supertest(app).post("/api/auth/login")
          .set("Origin", "https://app.myperfectmeals.com");
        expect(login.status).toBe(204);
        const cookie = login.headers["set-cookie"][0].split(";")[0];
        const slowRequest = supertest(app).get("/api/slow-profile")
          .set("Cookie", cookie).then(response => response);
        await slowRequestStarted;
        const bootstrap = await supertest(app).get("/api/auth/csrf").set("Cookie", cookie);
        expect(bootstrap.status).toBe(200);
        releaseSlowRequest();
        expect((await slowRequest).status).toBe(204);
        const restore = await supertest(app).post("/api/one-touch-create/restore")
          .set("Origin", "https://app.myperfectmeals.com")
          .set("Cookie", cookie)
          .set("x-csrf-token", bootstrap.body.csrfToken);
        expect(restore.status).toBe(200);
        expect(restore.body.concepts).toHaveLength(3);
        const missingToken = await supertest(app).post("/api/one-touch-create/restore")
          .set("Origin", "https://app.myperfectmeals.com").set("Cookie", cookie);
        expect(missingToken.status).toBe(403);
        expect(missingToken.body.code).toBe("CSRF_TOKEN_INVALID");
        const untrustedOrigin = await supertest(app).post("/api/one-touch-create/restore")
          .set("Origin", "https://attacker.example").set("Cookie", cookie)
          .set("x-csrf-token", bootstrap.body.csrfToken);
        expect(untrustedOrigin.status).toBe(403);
        expect(untrustedOrigin.body.code).toBe("CSRF_ORIGIN_REJECTED");
      } finally {
        releaseSlowRequest?.();
        if (previousEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnvironment;
        if (previousDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
        else process.env.REPLIT_DEPLOYMENT = previousDeployment;
      }
    },
  );
});
