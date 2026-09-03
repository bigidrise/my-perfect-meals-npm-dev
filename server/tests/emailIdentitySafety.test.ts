/**
 * Email identity safety regression coverage.
 *
 * The route suite intentionally uses the real database and real
 * emailIdentityService. Authentication and unrelated external workflows are
 * mocked so the tests can focus on the ordering of the identity guard versus
 * membership, trial, and invitation-state mutations.
 */

const mockAuth = {
  user: null as { id: string; email?: string; accessTier?: string; planLookupKey?: string | null } | null,
};

const mockStripePayment = {
  userId: "",
};

const mockActivateProCareClient = jest.fn(async (clientUserId: string, _proUserId: string) => ({
  studioId: "mock-studio-id",
  studioName: "Mock Studio",
  studioType: "studio",
  membershipId: `mock-membership-${clientUserId}`,
  clientLinkId: `mock-link-${clientUserId}`,
  alreadyActive: false,
  restored: false,
  ownerUserId: "mock-owner-id",
}));

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockAuth.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.authUser = mockAuth.user;
    next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("../middleware/requireEmailService", () => ({
  requireEmailService: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../middleware/requireProAccess", () => ({
  requireProAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../middleware/requireProOrOrgAdmin", () => ({
  requireProOrOrgAdmin: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../services/emailService", () => ({
  sendCareTeamInvite: jest.fn(),
  sendBusinessInviteEmail: jest.fn(),
  sendCoachActivationEmail: jest.fn(),
  sendCoachingInviteEmail: jest.fn(),
}));

jest.mock("../services/legalCheck", () => ({
  checkLegalAcceptance: jest.fn(async () => ({ allAccepted: true, missing: [] })),
}));

jest.mock("../services/procareProviderAccess", () => ({
  providerHasProCareStudioAccess: jest.fn(async () => true),
}));

jest.mock("../services/procareActivation", () => ({
  ActivationError: class ActivationError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  activateProCareClient: mockActivateProCareClient,
  deactivateProCareClient: jest.fn(),
}));

jest.mock("stripe", () => ({
  __esModule: true,
  default: class Stripe {
    checkout = {
      sessions: {
        retrieve: jest.fn(async () => ({
          status: "complete",
          payment_status: "paid",
          metadata: {
            userId: mockStripePayment.userId,
            sku: "mpm_guidance",
          },
        })),
      },
    };
  },
}));

jest.mock("nanoid", () => ({
  nanoid: jest.fn(() => "email-identity-test-token"),
}));

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { careInvite, careTeamMember } from "../db/schema/careTeam";
import { studios, studioInvites, studioMemberships, coachingInvites } from "../db/schema/studio";
import { businesses, businessInvitations, businessMembers } from "../db/schema/business";
import {
  normalizeEmailIdentity,
  resolveEmailIdentity,
  type EmailIdentityCandidate,
} from "../services/emailIdentityService";

const subscriptionServiceSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/services/subscriptionService.ts"),
  "utf8",
);
const careTeamRoutesSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/careTeamRoutes.ts"),
  "utf8",
);
const studioRoutesSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/studioRoutes.ts"),
  "utf8",
);
const businessRoutesSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/businessRoutes.ts"),
  "utf8",
);
const coachingRoutesSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/coaching.ts"),
  "utf8",
);

const caseVariantUsers: EmailIdentityCandidate[] = [
  { id: "account-lowercase", email: "member@example.com" },
  { id: "account-capitalized", email: "Member@example.com" },
];

async function buildApp(routerPath: string): Promise<express.Express> {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: Response, next: NextFunction) => {
    if (mockAuth.user) req.authUser = mockAuth.user;
    next();
  });
  const router = (await import(routerPath)).default;
  const mountPath = routerPath.endsWith("careTeamRoutes")
    ? "/api/care-team"
    : routerPath.endsWith("studioRoutes")
      ? "/api/studios"
      : routerPath.endsWith("businessRoutes")
        ? "/api/business"
        : "/api/coaching";
  app.use(mountPath, router);
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });
  return app;
}

function authenticate(userId: string, email?: string) {
  mockAuth.user = {
    id: userId,
    email,
    accessTier: "PAID_FULL",
    planLookupKey: "mpm_ultimate",
  };
  mockStripePayment.userId = userId;
}

async function seedUser(id: string, email: string, suffix: string, trialEndsAt?: Date) {
  await db.insert(users).values({
    id,
    username: `email-identity-${suffix}-${id.slice(0, 8)}`,
    email,
    password: "email-identity-regression-test",
    plan: "basic",
    trialEndsAt,
  });
}

async function firstRow<T>(query: Promise<T[]>): Promise<T> {
  const [row] = await query;
  if (!row) throw new Error("Expected fixture row to exist");
  return row;
}

describe("email identity safety", () => {
  it("normalizes delivery identity without losing the stored account spelling", () => {
    expect(normalizeEmailIdentity(" Member@Example.com ")).toBe("member@example.com");

    const resolved = resolveEmailIdentity(
      [{ id: "one-account", email: "member@example.com" }],
      "Member@Example.com",
    );
    expect(resolved.status).toBe("unique");
    expect(resolved.status === "unique" && resolved.user.id).toBe("one-account");
  });

  it("requires an exact legacy spelling before selecting a case-variant account", () => {
    const lowercase = resolveEmailIdentity(caseVariantUsers, "member@example.com");
    const capitalized = resolveEmailIdentity(caseVariantUsers, "Member@example.com");

    expect(lowercase.status).toBe("legacy_exact");
    expect(lowercase.status === "legacy_exact" && lowercase.user.id).toBe("account-lowercase");
    expect(capitalized.status).toBe("legacy_exact");
    expect(capitalized.status === "legacy_exact" && capitalized.user.id).toBe("account-capitalized");
  });

  it("never chooses an arbitrary account for an ambiguous normalized email", () => {
    const ambiguous = resolveEmailIdentity(caseVariantUsers, "MEMBER@example.com");

    expect(ambiguous.status).toBe("ambiguous");
    expect(ambiguous.candidates.map((candidate) => candidate.id)).toEqual([
      "account-lowercase",
      "account-capitalized",
    ]);
    expect("user" in ambiguous).toBe(false);
  });

  it("updates subscription state by a resolved primary key, never by email or customer-wide update", () => {
    expect(subscriptionServiceSource).toContain("resolveSubscriptionUser");
    expect(subscriptionServiceSource).toContain(".where(eq(users.id, verifiedUser.id))");
    expect(subscriptionServiceSource).toContain(".where(eq(users.id, user.id))");
    expect(subscriptionServiceSource).not.toContain(".where(eq(users.email");
    expect(subscriptionServiceSource).not.toContain(".where(eq(users.stripeCustomerId, stripeCustomerId))");
  });

  it("does not let either case-variant account redeem a care or studio invitation", () => {
    for (const routeSource of [careTeamRoutesSource, studioRoutesSource]) {
      expect(routeSource).toContain("resolveEmailIdentityForUser(userId)");
      expect(routeSource).toContain("identity.candidates.length > 1");
      expect(routeSource).toContain("EMAIL_IDENTITY_REVIEW_REQUIRED");
      expect(routeSource).toContain("normalizeEmailIdentity(identity.user.email)");
      expect(routeSource).toContain("normalizeEmailIdentity(invite.email)");
    }
  });

  it("applies the same verified identity rule before business access or coaching changes", () => {
    expect(businessRoutesSource).toContain("resolveEmailIdentityForUser(userId)");
    expect(businessRoutesSource).toContain("acceptingIdentity.candidates.length > 1");
    expect(businessRoutesSource).toContain("EMAIL_IDENTITY_REVIEW_REQUIRED");
    expect(businessRoutesSource).toContain("normalizeEmailIdentity(acceptingIdentity.user.email)");

    expect(coachingRoutesSource).toContain("resolveEmailIdentityForUser(authUser.id)");
    expect(coachingRoutesSource).toContain("identity.candidates.length > 1");
    expect(coachingRoutesSource).toContain("EMAIL_IDENTITY_REVIEW_REQUIRED");
    expect(coachingRoutesSource).toContain("normalizeEmailIdentity(identity.user.email)");
  });
});

describe("email identity safety — database-backed invitation routes", () => {
  const originalCoachUserId = process.env.COACH_IDRISE_USER_ID;
  const originalCoachStudioId = process.env.COACH_IDRISE_STUDIO_ID;
  const fixtureId = randomUUID();
  const duplicateLowerId = randomUUID();
  const duplicateCapitalizedId = randomUUID();
  const duplicateEmail = `legacy-${fixtureId.slice(0, 12)}@example.test`;
  const duplicateCapitalizedEmail = `${duplicateEmail[0].toUpperCase()}${duplicateEmail.slice(1)}`;
  const uniqueUserId = randomUUID();
  const uniqueEmail = `unique-${fixtureId.slice(0, 12)}@example.test`;
  const trialBeforeAcceptance = new Date("2020-01-01T00:00:00.000Z");

  const careInviteId = randomUUID();
  const studioId = randomUUID();
  const studioInviteId = randomUUID();
  const businessId = randomUUID();
  const businessInviteId = randomUUID();
  const coachingInviteId = randomUUID();
  const uniqueBusinessId = randomUUID();
  const uniqueBusinessInviteId = randomUUID();
  const coachUserId = randomUUID();
  const coachStudioId = randomUUID();
  const coachToken = `coach-${fixtureId}`;

  let careApp: express.Express;
  let studioApp: express.Express;
  let businessApp: express.Express;
  let coachingApp: express.Express;

  beforeAll(async () => {
    await seedUser(duplicateLowerId, duplicateEmail, "lower", trialBeforeAcceptance);
    await seedUser(duplicateCapitalizedId, duplicateCapitalizedEmail, "capitalized", trialBeforeAcceptance);
    await seedUser(uniqueUserId, uniqueEmail, "unique", trialBeforeAcceptance);
    await seedUser(coachUserId, `coach-${fixtureId.slice(0, 12)}@example.test`, "coach");

    await db.insert(studios).values([
      {
        id: studioId,
        ownerUserId: `studio-owner-${fixtureId}`,
        name: "Email Identity Regression Studio",
        type: "studio",
        status: "active",
      },
      {
        id: coachStudioId,
        ownerUserId: coachUserId,
        name: "Email Identity Regression Coach Studio",
        type: "studio",
        status: "active",
      },
    ]);

    await db.insert(careInvite).values({
      id: careInviteId,
      userId: `care-owner-${fixtureId}`,
      email: duplicateEmail,
      role: "client",
      permissions: { canViewMacros: true, canAddMeals: true, canEditPlan: false },
      inviteCode: `CARE-${fixtureId.slice(0, 8)}`,
      urlToken: `care-token-${fixtureId}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await db.insert(studioInvites).values({
      id: studioInviteId,
      studioId,
      email: duplicateEmail,
      inviteCode: `STUDIO-${fixtureId}`,
      urlToken: `studio-token-${fixtureId}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await db.insert(businesses).values([
      {
        id: businessId,
        name: "Email Identity Regression Business",
        ownerUserId: `business-owner-${fixtureId}`,
        seatLimit: 5,
        status: "active",
      },
      {
        id: uniqueBusinessId,
        name: "Email Identity Unique Acceptance Business",
        ownerUserId: `unique-business-owner-${fixtureId}`,
        seatLimit: 5,
        status: "active",
      },
    ]);

    await db.insert(businessInvitations).values([
      {
        id: businessInviteId,
        businessId,
        email: duplicateEmail,
        token: `business-${fixtureId}`,
        role: "staff",
        status: "pending",
        invitedByUserId: `business-owner-${fixtureId}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        invitationType: "client",
        trialDays: 30,
      },
      {
        id: uniqueBusinessInviteId,
        businessId: uniqueBusinessId,
        email: uniqueEmail.toUpperCase(),
        token: `business-unique-${fixtureId}`,
        role: "staff",
        status: "pending",
        invitedByUserId: `unique-business-owner-${fixtureId}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        invitationType: "client",
        trialDays: 30,
      },
    ]);

    await db.insert(coachingInvites).values({
      id: coachingInviteId,
      studioId: coachStudioId,
      coachSlug: "idrise",
      email: duplicateEmail,
      token: coachToken,
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    process.env.COACH_IDRISE_USER_ID = coachUserId;
    process.env.COACH_IDRISE_STUDIO_ID = coachStudioId;

    careApp = await buildApp("../routes/careTeamRoutes");
    studioApp = await buildApp("../routes/studioRoutes");
    businessApp = await buildApp("../routes/businessRoutes");
    coachingApp = await buildApp("../routes/coaching");
  }, 30_000);

  afterEach(() => {
    mockAuth.user = null;
    mockStripePayment.userId = "";
    mockActivateProCareClient.mockClear();
  });

  afterAll(async () => {
    if (originalCoachUserId === undefined) delete process.env.COACH_IDRISE_USER_ID;
    else process.env.COACH_IDRISE_USER_ID = originalCoachUserId;
    if (originalCoachStudioId === undefined) delete process.env.COACH_IDRISE_STUDIO_ID;
    else process.env.COACH_IDRISE_STUDIO_ID = originalCoachStudioId;

    await db.delete(careTeamMember).where(eq(careTeamMember.userId, duplicateLowerId)).catch(() => {});
    await db.delete(careTeamMember).where(eq(careTeamMember.userId, duplicateCapitalizedId)).catch(() => {});
    await db.delete(studioMemberships).where(eq(studioMemberships.clientUserId, duplicateLowerId)).catch(() => {});
    await db.delete(studioMemberships).where(eq(studioMemberships.clientUserId, duplicateCapitalizedId)).catch(() => {});
    await db.delete(studioMemberships).where(eq(studioMemberships.clientUserId, uniqueUserId)).catch(() => {});
    await db.delete(businessMembers).where(eq(businessMembers.userId, duplicateLowerId)).catch(() => {});
    await db.delete(businessMembers).where(eq(businessMembers.userId, duplicateCapitalizedId)).catch(() => {});
    await db.delete(businessMembers).where(eq(businessMembers.userId, uniqueUserId)).catch(() => {});
    await db.delete(coachingInvites).where(eq(coachingInvites.id, coachingInviteId)).catch(() => {});
    await db.delete(studioInvites).where(eq(studioInvites.id, studioInviteId)).catch(() => {});
    await db.delete(careInvite).where(eq(careInvite.id, careInviteId)).catch(() => {});
    await db.delete(businessInvitations).where(eq(businessInvitations.id, businessInviteId)).catch(() => {});
    await db.delete(businessInvitations).where(eq(businessInvitations.id, uniqueBusinessInviteId)).catch(() => {});
    await db.delete(businesses).where(eq(businesses.id, businessId)).catch(() => {});
    await db.delete(businesses).where(eq(businesses.id, uniqueBusinessId)).catch(() => {});
    await db.delete(studios).where(eq(studios.id, studioId)).catch(() => {});
    await db.delete(studios).where(eq(studios.id, coachStudioId)).catch(() => {});
    await db.delete(users).where(eq(users.id, duplicateLowerId)).catch(() => {});
    await db.delete(users).where(eq(users.id, duplicateCapitalizedId)).catch(() => {});
    await db.delete(users).where(eq(users.id, uniqueUserId)).catch(() => {});
    await db.delete(users).where(eq(users.id, coachUserId)).catch(() => {});
  }, 30_000);

  const duplicateAccounts = [
    [duplicateLowerId, duplicateEmail],
    [duplicateCapitalizedId, duplicateCapitalizedEmail],
  ] as const;

  it.each(duplicateAccounts)(
    "rejects care-team acceptance for legacy duplicate %s before membership or invite writes",
    async (userId, email) => {
      authenticate(userId, email);
      const res = await request(careApp)
        .post("/api/care-team/connect")
        .send({ code: `CARE-${fixtureId.slice(0, 8)}` });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("EMAIL_IDENTITY_REVIEW_REQUIRED");
      expect(mockActivateProCareClient).not.toHaveBeenCalled();
      const invite = await firstRow(db.select().from(careInvite).where(eq(careInvite.id, careInviteId)));
      expect(invite.accepted).toBe(false);
      const members = await db.select().from(careTeamMember).where(eq(careTeamMember.userId, userId));
      expect(members).toHaveLength(0);
    },
  );

  it.each(duplicateAccounts)(
    "rejects studio acceptance for legacy duplicate %s before membership or invite writes",
    async (userId, email) => {
      authenticate(userId, email);
      const res = await request(studioApp)
        .post("/api/studios/connect")
        .send({ code: `STUDIO-${fixtureId}` });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("EMAIL_IDENTITY_REVIEW_REQUIRED");
      expect(mockActivateProCareClient).not.toHaveBeenCalled();
      const invite = await firstRow(db.select().from(studioInvites).where(eq(studioInvites.id, studioInviteId)));
      expect(invite.acceptedAt).toBeNull();
      const memberships = await db.select().from(studioMemberships).where(eq(studioMemberships.clientUserId, userId));
      expect(memberships).toHaveLength(0);
    },
  );

  it.each(duplicateAccounts)(
    "rejects business client acceptance for legacy duplicate %s before trial or invite writes",
    async (userId, email) => {
      authenticate(userId, email);
      const res = await request(businessApp)
        .post(`/api/business/invite/business-${fixtureId}/accept`)
        .send();

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("EMAIL_IDENTITY_REVIEW_REQUIRED");
      const invite = await firstRow(db.select().from(businessInvitations).where(eq(businessInvitations.id, businessInviteId)));
      expect(invite.status).toBe("pending");
      expect(invite.acceptedAt).toBeNull();
      const user = await firstRow(
        db.select({ trialEndsAt: users.trialEndsAt }).from(users).where(eq(users.id, userId)),
      );
      expect(user.trialEndsAt?.getTime()).toBe(trialBeforeAcceptance.getTime());
    },
  );

  it.each(duplicateAccounts)(
    "rejects coaching acceptance for legacy duplicate %s before membership or invite writes",
    async (userId, email) => {
      authenticate(userId, email);
      const res = await request(coachingApp)
        .post("/api/coaching/notify-coach")
        .send({
          coachSlug: "idrise",
          stripeSessionId: `session-${userId}`,
          inviteToken: coachToken,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("EMAIL_IDENTITY_REVIEW_REQUIRED");
      const invite = await firstRow(db.select().from(coachingInvites).where(eq(coachingInvites.id, coachingInviteId)));
      expect(invite.status).toBe("pending");
      expect(invite.acceptedAt).toBeNull();
      const memberships = await db.select().from(studioMemberships).where(eq(studioMemberships.clientUserId, userId));
      expect(memberships).toHaveLength(0);
    },
  );

  it("allows the only matching account to accept a business invitation and receive its trial", async () => {
    authenticate(uniqueUserId, uniqueEmail);
    const res = await request(businessApp)
      .post(`/api/business/invite/business-unique-${fixtureId}/accept`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.invitationType).toBe("client");

    const invite = await firstRow(
      db.select().from(businessInvitations).where(eq(businessInvitations.id, uniqueBusinessInviteId)),
    );
    expect(invite.status).toBe("accepted");
    expect(invite.acceptedByUserId).toBe(uniqueUserId);
    const user = await firstRow(
      db.select({ trialEndsAt: users.trialEndsAt }).from(users).where(eq(users.id, uniqueUserId)),
    );
    expect(user.trialEndsAt).not.toBeNull();
    expect(user.trialEndsAt!.getTime()).toBeGreaterThan(trialBeforeAcceptance.getTime());
  });
});