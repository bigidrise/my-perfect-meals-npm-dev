import express from "express";
import request from "supertest";
import fs from "fs";
import path from "path";
import {
  createOrgConfigHandler,
  type OrgConfigDependencies,
  type OrgConfigUser,
} from "../routes/orgConfig";
import type { OrgContext } from "../lib/orgContext";

function makeOrg(id: string, partnerMarketplace = true): OrgContext {
  return {
    id,
    slug: id,
    name: id,
    activeStatus: "active",
    organizationType: "business",
    dataAccessMode: "standalone",
    appName: id,
    appShortName: id,
    supportEmail: "support@example.test",
    supportUrl: null,
    primaryColor: "#000000",
    secondaryColor: "#ffffff",
    accentColor: null,
    logoUrl: null,
    logoDarkUrl: null,
    onboardingHeadline: null,
    poweredByVisible: true,
    customDomain: null,
    featureFlags: {
      whiteLabelMode: false,
      customBranding: false,
      partnerMarketplace,
      requireAcademy: false,
      requireProfessionalVerification: false,
    },
    isDefault: id === "default",
    isWhiteLabel: false,
  } as OrgContext;
}

const defaultOrg = makeOrg("default");
const directOrg = makeOrg("direct-org");
const businessOrg = makeOrg("business-org", false);
const publicSlugOrg = makeOrg("public-slug-org");

function makeDependencies(overrides: Partial<OrgConfigDependencies> = {}): OrgConfigDependencies {
  const organizations = new Map([
    [directOrg.id, directOrg],
    [businessOrg.id, businessOrg],
  ]);
  return {
    findUser: async () => null,
    findBusinessOrganizationIds: async () => [],
    loadOrgContext: async (id) => organizations.get(id ?? "") ?? defaultOrg,
    loadOrgBySlug: async (slug) => slug === "public-slug" ? publicSlugOrg : null,
    getDefaultOrgContext: () => defaultOrg,
    now: () => Date.parse("2026-09-09T12:00:00.000Z"),
    ...overrides,
  };
}

function makeApp(
  dependencies: OrgConfigDependencies,
  session?: Record<string, unknown>,
) {
  const app = express();
  app.use((req, _res, next) => {
    if (session) (req as any).session = session;
    next();
  });
  app.get("/api/org/config", createOrgConfigHandler(dependencies));
  return app;
}

const validUser: OrgConfigUser = {
  id: "user-1",
  organizationId: directOrg.id,
  authSecurityVersion: 3,
  role: "client",
  professionalRole: null,
};

const validSession = {
  userId: validUser.id,
  authSecurityVersion: 3,
  lastActiveAt: Date.parse("2026-09-09T11:55:00.000Z"),
  cookie: { expires: new Date("2026-09-10T12:00:00.000Z") },
};

describe("GET /api/org/config", () => {
  test("returns public default config without authentication", async () => {
    const response = await request(makeApp(makeDependencies()))
      .get("/api/org/config")
      .expect(200);
    expect(response.body.id).toBe(defaultOrg.id);
  });

  test("returns the authenticated user's direct organization", async () => {
    const dependencies = makeDependencies({
      findUser: async () => validUser,
    });
    const response = await request(makeApp(dependencies, validSession))
      .get("/api/org/config")
      .expect(200);
    expect(response.body.id).toBe(directOrg.id);
  });

  test("returns an active business-membership organization", async () => {
    const dependencies = makeDependencies({
      findUser: async () => ({ ...validUser, organizationId: null }),
      findBusinessOrganizationIds: async () => [businessOrg.id],
    });
    const response = await request(makeApp(dependencies, validSession))
      .get("/api/org/config")
      .expect(200);
    expect(response.body.id).toBe(businessOrg.id);
  });

  test.each([
    ["missing user", async () => null, validSession],
    [
      "revoked security version",
      async () => validUser,
      { ...validSession, authSecurityVersion: 2 },
    ],
    [
      "expired idle session",
      async () => validUser,
      {
        ...validSession,
        lastActiveAt: Date.parse("2026-09-09T10:00:00.000Z"),
      },
    ],
  ])("%s safely falls back to public config", async (_label, findUser, session) => {
    const dependencies = makeDependencies({ findUser });
    const response = await request(makeApp(dependencies, session))
      .get("/api/org/config")
      .expect(200);
    expect(response.body.id).toBe(defaultOrg.id);
  });

  test("does not reuse a personalized response through browser caching", async () => {
    const dependencies = makeDependencies({
      findUser: async () => validUser,
    });
    const app = makeApp(dependencies, validSession);
    const first = await request(app).get("/api/org/config").expect(200);
    const second = await request(app)
      .get("/api/org/config")
      .set("If-None-Match", first.headers.etag ?? '"stale"')
      .expect(200);

    expect(second.headers["cache-control"]).toContain("private");
    expect(second.headers["cache-control"]).toContain("no-store");
    expect(second.body.id).toBe(directOrg.id);
  });

  test("a public slug cannot override a valid session organization", async () => {
    const dependencies = makeDependencies({
      findUser: async () => validUser,
    });
    const response = await request(makeApp(dependencies, validSession))
      .get("/api/org/config")
      .set("x-org-slug", "public-slug")
      .expect(200);
    expect(response.body.id).toBe(directOrg.id);
  });

  test("Development and Production register the same authoritative handler", () => {
    const root = path.resolve(process.cwd());
    const development = fs.readFileSync(path.join(root, "server/index.ts"), "utf8");
    const production = fs.readFileSync(path.join(root, "server/prod.ts"), "utf8");
    const sharedRoute = fs.readFileSync(
      path.join(root, "server/routes/orgConfig.ts"),
      "utf8",
    );

    expect(development).toContain("registerOrgConfigRoute(app)");
    expect(production).toContain("registerOrgConfigRoute(app)");
    expect(production).not.toContain('import("./db/schema") as any');
    expect(sharedRoute).toContain('import { users } from "@shared/schema"');
  });
});