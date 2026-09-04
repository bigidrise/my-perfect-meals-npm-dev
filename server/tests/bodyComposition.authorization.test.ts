/**
 * Self-service body-composition routes must never let an authenticated account
 * select a different account through the `:userId` path parameter.
 */
const mockAuth = { user: null as { id: string; professionalRole?: string | null } | null };
const mockDb = {
  selectResults: [] as Array<Array<Record<string, unknown>>>,
  selectIndex: 0,
  queries: 0,
  mutations: 0,
  insertedValues: null as Record<string, unknown> | null,
};
const mockOrg = { same: true };

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockAuth.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.authUser = mockAuth.user;
    return next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("../lib/orgIsolation", () => ({
  assertSameOrg: async () => {
    if (!mockOrg.same) throw new Error("cross-org");
  },
  handleOrgIsolationError: (error: unknown, res: any) => {
    if (error instanceof Error && error.message === "cross-org") {
      res.status(403).json({ error: "ORG_ISOLATION_VIOLATION" });
      return true;
    }
    return false;
  },
}));

jest.mock("../db", () => {
  const selected = () => mockDb.selectResults[mockDb.selectIndex++] ?? [];
  return {
    db: {
      select: () => {
        mockDb.queries++;
        return {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve(selected()),
              }),
            }),
            where: () => ({
              orderBy: () => ({ limit: () => Promise.resolve(selected()) }),
              limit: () => Promise.resolve(selected()),
            }),
          }),
        };
      },
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          returning: () => {
            mockDb.mutations++;
            mockDb.insertedValues = values;
            return Promise.resolve([{ id: 17, userId: OWNER_ID }]);
          },
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => {
              mockDb.mutations++;
              return Promise.resolve([{ id: 17, userId: OWNER_ID }]);
            },
          }),
        }),
      }),
      delete: () => ({
        where: () => ({
          returning: () => {
            mockDb.mutations++;
            return Promise.resolve([{ id: 17, userId: OWNER_ID }]);
          },
        }),
      }),
    },
  };
});

import express from "express";
import request from "supertest";

const OWNER_ID = "body-composition-owner";
const OTHER_ID = "body-composition-attacker";
const entry = { id: 17, userId: OWNER_ID, source: "client", recordedAt: new Date() };
const createPayload = {
  currentBodyFatPct: 20,
  goalBodyFatPct: 15,
  scanMethod: "DEXA",
  source: "trainer",
  recordedAt: "2025-01-01T12:00:00.000Z",
};

async function app() {
  const server = express();
  server.use(express.json());
  const router = (await import("../routes/bodyComposition")).default;
  server.use("/api", router);
  return server;
}

beforeEach(() => {
  mockAuth.user = null;
  mockDb.selectResults = [];
  mockDb.selectIndex = 0;
  mockDb.queries = 0;
  mockDb.mutations = 0;
  mockDb.insertedValues = null;
  mockOrg.same = true;
});

describe("/api/users/:userId/body-composition self-service authorization", () => {
  test.each([
    ["latest", (server: express.Express) => request(server).get(`/api/users/${OTHER_ID}/body-composition/latest`)],
    ["history", (server: express.Express) => request(server).get(`/api/users/${OTHER_ID}/body-composition/history`)],
  ])("denies cross-user GET %s before querying", async (_route, send) => {
    mockAuth.user = { id: OWNER_ID };
    const response = await send(await app());

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/forbidden/i);
    expect(mockDb.queries).toBe(0);
  });

  test.each([
    ["POST", (server: express.Express) => request(server).post(`/api/users/${OTHER_ID}/body-composition`).send(createPayload)],
    ["PUT", (server: express.Express) => request(server).put(`/api/users/${OTHER_ID}/body-composition/17`).send({ notes: "unauthorized" })],
    ["DELETE", (server: express.Express) => request(server).delete(`/api/users/${OTHER_ID}/body-composition/17`)],
  ])("denies cross-user %s before mutating", async (_method, send) => {
    mockAuth.user = { id: OWNER_ID };
    const response = await send(await app());

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/forbidden/i);
    expect(mockDb.mutations).toBe(0);
  });

  test("denies cross-user goal changes before querying or updating", async () => {
    mockAuth.user = { id: OWNER_ID };
    const response = await request(await app())
      .patch(`/api/users/${OTHER_ID}/body-composition/goal`)
      .send({ goalBodyFatPct: 15 });

    expect(response.status).toBe(403);
    expect(mockDb.queries).toBe(0);
    expect(mockDb.mutations).toBe(0);
  });

  test("permits the owner to read latest and history entries", async () => {
    mockAuth.user = { id: OWNER_ID };
    mockDb.selectResults = [[entry], [entry]];
    const server = await app();

    expect((await request(server).get(`/api/users/${OWNER_ID}/body-composition/latest`)).status).toBe(200);
    expect((await request(server).get(`/api/users/${OWNER_ID}/body-composition/history`)).status).toBe(200);
    expect(mockDb.queries).toBe(2);
  });

  test.each([
    ["POST", (server: express.Express) => request(server).post(`/api/users/${OWNER_ID}/body-composition`).send(createPayload)],
    ["PUT", (server: express.Express) => request(server).put(`/api/users/${OWNER_ID}/body-composition/17`).send({ notes: "owner update" })],
    ["DELETE", (server: express.Express) => request(server).delete(`/api/users/${OWNER_ID}/body-composition/17`)],
  ])("permits the owner to %s their entry", async (_method, send) => {
    mockAuth.user = { id: OWNER_ID };
    const response = await send(await app());

    expect(response.status).toBe(200);
    expect(mockDb.mutations).toBe(1);
  });
});

describe("/api/pro/clients/:clientId/body-composition professional authorization", () => {
  test("denies an unrelated professional before body-composition data access", async () => {
    mockAuth.user = { id: OWNER_ID, professionalRole: "trainer" };
    mockDb.selectResults = [[], [], []];
    const response = await request(await app()).get(`/api/pro/clients/${OTHER_ID}/body-composition`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/relationship/i);
    expect(mockDb.queries).toBe(3);
  });

  test("denies a cross-organization professional before relationship lookup", async () => {
    mockAuth.user = { id: OWNER_ID, professionalRole: "physician" };
    mockOrg.same = false;
    const response = await request(await app()).get(`/api/pro/clients/${OTHER_ID}/body-composition`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("ORG_ISOLATION_VIOLATION");
    expect(mockDb.queries).toBe(0);
  });

  test("denies a revoked or inactive relationship", async () => {
    mockAuth.user = { id: OWNER_ID, professionalRole: "trainer" };
    // The route predicates require active care-team/client-link rows and an
    // active, unarchived studio membership; none is returned for a revoked link.
    mockDb.selectResults = [[], [], []];
    const response = await request(await app())
      .post(`/api/pro/clients/${OTHER_ID}/body-composition`)
      .send(createPayload);

    expect(response.status).toBe(403);
    expect(mockDb.mutations).toBe(0);
  });

  test("denies a linked actor with a non-body-composition professional role", async () => {
    mockAuth.user = { id: OWNER_ID, professionalRole: "dietitian" };
    const response = await request(await app()).get(`/api/pro/clients/${OTHER_ID}/body-composition`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/trainers and physicians/i);
    expect(mockDb.queries).toBe(0);
  });

  test.each(["trainer", "physician"])("permits an authorized %s to read a client's entry", async (professionalRole) => {
    mockAuth.user = { id: OWNER_ID, professionalRole };
    mockDb.selectResults = [[{ id: "active-care-team-link" }], [entry]];
    const response = await request(await app()).get(`/api/pro/clients/${OTHER_ID}/body-composition`);

    expect(response.status).toBe(200);
    expect(response.body.entry.id).toBe(17);
  });

  test.each(["trainer", "physician"])("binds a %s-created entry to the authenticated professional", async (professionalRole) => {
    mockAuth.user = { id: OWNER_ID, professionalRole };
    mockDb.selectResults = [[{ id: "active-care-team-link" }]];
    const response = await request(await app())
      .post(`/api/pro/clients/${OTHER_ID}/body-composition`)
      .send({ ...createPayload, createdById: "forged-user-id" });

    expect(response.status).toBe(200);
    expect(mockDb.insertedValues?.createdById).toBe(OWNER_ID);
    expect(mockDb.insertedValues?.userId).toBe(OTHER_ID);
  });
});