/**
 * Regression coverage for GET /api/business/mine's organizational pilot query.
 *
 * The pilot dates are already resolved from the selected Business above the
 * query.  Keeping those values in the projection avoids referencing the
 * businesses table from a query whose FROM clause is organizationalPilots.
 */

const OWNER_ID = "organization-owner-1";
const TABLE_NAME = Symbol.for("drizzle:Name");
const pilotStartAt = new Date("2026-09-01T05:00:00.000Z");
const pilotEndAt = new Date("2026-10-01T05:00:00.000Z");

const business = {
  id: "business-1",
  name: "Existing Organization",
  ownerUserId: OWNER_ID,
  organizationId: "organization-1",
  plan: "clinical_business_monthly",
  seatLimit: 4,
  status: "active",
  commercialAccessMode: "onboarding_pilot",
  commercialAccessStartedAt: pilotStartAt,
  commercialAccessEndsAt: pilotEndAt,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
};

const pilot = {
  id: "pilot-1",
  status: "active",
  professionalCapacity: 2,
  clientCapacity: 20,
  durationDays: 30,
};

const auth = { user: { id: OWNER_ID } as Record<string, unknown> | null };
const dbState = { missingFromErrors: 0 };

function tableName(table: any): string | undefined {
  return table?.[TABLE_NAME] ?? table?._?.name;
}

function referencesBusinessesColumn(fields: any): boolean {
  return Object.values(fields ?? {}).some(
    (field: any) => field?.table?.[TABLE_NAME] === "businesses",
  );
}

function rowsFor(source: string | undefined): Array<Record<string, unknown>> {
  switch (source) {
    case "businesses":
      return [business];
    case "organizations":
      return [{ featureFlags: {} }];
    case "organizational_pilots":
      return [{ ...pilot, pilotStartAt, pilotEndAt }];
    case "users":
      return [{ signupSource: null }];
    default:
      return [];
  }
}

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.authUser = auth.user;
    next();
  },
}));

jest.mock("../middleware/requireProOrOrgAdmin", () => ({
  requireProOrOrgAdmin: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../middleware/requireProAccess", () => ({
  requireProAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../middleware/requireAdmin", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../services/organizationWorkspaceService", () => ({
  ensureCanonicalWorkspaceForBusiness: jest.fn(),
  resolveActiveWorkspace: jest.fn(async () => ({
    organizationId: "organization-1",
    organizationName: "Existing Organization",
    organizationRole: "owner",
    organizationRelationshipType: "owner",
    locationId: "location-1",
    locationName: "Main Location",
    locationRole: "owner",
    autoSelected: true,
  })),
  WorkspaceContextError: class WorkspaceContextError extends Error {
    status = 500;
    code = "INVALID_WORKSPACE_SELECTION";
  },
}));

jest.mock("../routes/organizationWorkspaceRoutes", () => {
  const { Router } = require("express");
  return { __esModule: true, default: Router() };
});

jest.mock("../services/emailService", () => ({
  sendBusinessInviteEmail: jest.fn(),
}));

jest.mock("../services/organizationalPilotInvitationService", () => ({
  acceptOrganizationalPilotInvitation: jest.fn(),
  cancelOrganizationalPilotInvitation: jest.fn(),
  createOrganizationalPilotInvitation: jest.fn(),
  expireOrganizationalPilotInvitation: jest.fn(),
  findOrganizationalPilotInvitation: jest.fn(),
  PilotInvitationError: class PilotInvitationError extends Error {},
  resendOrganizationalPilotInvitation: jest.fn(),
}));

jest.mock("../services/organizationalPilotAuthorizationService", () => ({
  claimPilotAuthorization: jest.fn(),
  createManagedPilotOrganization: jest.fn(),
  createApprovedPilotAuthorization: jest.fn(),
  getClaimedChampionSetup: jest.fn(),
  getOrganizationWorkspaceOptions: jest.fn(),
  inspectPilotAuthorizationToken: jest.fn(),
  listPilotAuthorizations: jest.fn(),
  PilotAuthorizationError: class PilotAuthorizationError extends Error {},
  revokeUnusedPilotAuthorization: jest.fn(),
  updateClaimedChampionSetup: jest.fn(),
}));

jest.mock("../services/organizationInvitationBatchService", () => ({
  MAX_ORGANIZATION_INVITATION_BATCH: 100,
  reviewOrganizationInvitationRecipients: jest.fn(),
}));

jest.mock("../services/procareActivation", () => ({
  activateProCareClient: jest.fn(),
  ActivationError: class ActivationError extends Error {},
}));

jest.mock("../services/stripeRuntimePolicy", () => ({
  assertStripeBillingOwnership: jest.fn(),
}));

jest.mock("../lib/orgContext", () => ({
  loadOrgContext: jest.fn(),
}));

jest.mock("../services/businessPilotGuidanceService", () => ({
  getBusinessPilotGuidance: jest.fn(),
  setBusinessPilotAssignment: jest.fn(),
  getBusinessPilotWeek: jest.fn(),
  WEEKS: [],
}));

jest.mock("../services/businessPilotDeliveryService", () => ({
  processDueBusinessPilotDeliveries: jest.fn(),
  suppressBusinessPilotRecipient: jest.fn(),
}));

jest.mock("../db", () => ({
  db: {
    select: (fields?: any) => {
      let source: string | undefined;
      const query: any = {
        from(table: any) {
          source = tableName(table);
          if (
            source === "organizational_pilots"
            && referencesBusinessesColumn(fields)
          ) {
            dbState.missingFromErrors++;
            throw new Error('missing FROM-clause entry for table "businesses"');
          }
          return query;
        },
        leftJoin() {
          return query;
        },
        innerJoin() {
          return query;
        },
        where() {
          return query;
        },
        orderBy() {
          return query;
        },
        limit() {
          return Promise.resolve(rowsFor(source));
        },
        then(resolve: any, reject: any) {
          return Promise.resolve(rowsFor(source)).then(resolve, reject);
        },
      };
      return query;
    },
  },
}));

import express from "express";
import request from "supertest";
import businessRouter from "../routes/businessRoutes";

describe("GET /api/business/mine organizational pilot query", () => {
  beforeEach(() => {
    auth.user = { id: OWNER_ID };
    dbState.missingFromErrors = 0;
  });

  it("lets an existing organization owner load the route without a missing-FROM error", async () => {
    const app = express();
    app.use("/api/business", businessRouter);

    const response = await request(app).get("/api/business/mine");

    expect(response.status).toBe(200);
    expect(dbState.missingFromErrors).toBe(0);
    expect(response.body.pilot).toMatchObject({
      id: pilot.id,
      status: pilot.status,
      pilotStartAt: pilotStartAt.toISOString(),
      pilotEndAt: pilotEndAt.toISOString(),
    });
  });
});