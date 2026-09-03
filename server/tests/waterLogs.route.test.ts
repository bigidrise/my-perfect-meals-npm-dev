/**
 * waterLogs.route.test.ts
 *
 * Water-log ownership must come exclusively from the authenticated session.
 * These route-level tests deliberately send another user's ID in the request
 * and prove it cannot select the read or write owner.
 */

const mockAuth = {
  user: null as Record<string, unknown> | null,
};

const mockDb = {
  inserted: [] as Array<Record<string, unknown>>,
  readRows: [] as Array<Record<string, unknown>>,
};

const mockEq = jest.fn();

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockAuth.user) {
      return res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    }
    req.authUser = mockAuth.user;
    next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("drizzle-orm", () => {
  const actual = jest.requireActual("drizzle-orm");
  return {
    ...actual,
    eq: (...args: unknown[]) => {
      mockEq(...args);
      return actual.eq(...args);
    },
  };
});

jest.mock("../db", () => ({
  db: {
    insert: jest.fn(() => ({
      values: (value: Record<string, unknown>) => ({
        returning: async () => {
          mockDb.inserted.push(value);
          return [{ id: "water-log-1", ...value }];
        },
      }),
    })),
    select: jest.fn(() => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => mockDb.readRows,
          }),
        }),
      }),
    })),
  },
}));

import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { waterLogs } from "../../shared/schema";

const OWNER_USER_ID = "water-owner-001";
const ATTACKER_USER_ID = "water-other-999";

async function buildApp(user: Record<string, unknown> | null) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).__testAuthUser = user;
    mockAuth.user = (req as any).__testAuthUser;
    next();
  });
  const router = (await import("../routes/waterLogs")).default;
  app.use("/api", router);
  return app;
}

beforeEach(() => {
  mockAuth.user = null;
  mockDb.inserted = [];
  mockDb.readRows = [];
  mockEq.mockClear();
});

describe("water logs — session ownership", () => {
  it("rejects unauthenticated reads and writes", async () => {
    const app = await buildApp(null);

    const [getResponse, postResponse] = await Promise.all([
      request(app).get(`/api/water-logs?userId=${ATTACKER_USER_ID}`),
      request(app).post("/api/water-logs").send({ userId: ATTACKER_USER_ID, amount: 12, unit: "oz" }),
    ]);

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(mockDb.inserted).toEqual([]);
  });

  it("writes only to the authenticated user's hydration history", async () => {
    const app = await buildApp({ id: OWNER_USER_ID });
    const response = await request(app)
      .post("/api/water-logs")
      .send({ userId: ATTACKER_USER_ID, amount: 12, unit: "oz" });

    expect(response.status).toBe(200);
    expect(mockDb.inserted).toHaveLength(1);
    expect(mockDb.inserted[0]).toEqual(expect.objectContaining({
      userId: OWNER_USER_ID,
      unit: "oz",
    }));
    expect(mockDb.inserted[0].userId).not.toBe(ATTACKER_USER_ID);
  });

  it("reads only the authenticated user's hydration history even when another ID is supplied", async () => {
    mockDb.readRows = [{
      id: "water-log-owner",
      userId: OWNER_USER_ID,
      amountMl: 355,
      unit: "ml",
      intakeTime: new Date("2026-08-21T12:00:00.000Z"),
    }];

    const app = await buildApp({ id: OWNER_USER_ID });
    const response = await request(app)
      .get(`/api/water-logs?userId=${ATTACKER_USER_ID}&from=2026-08-01&to=2026-08-31`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].userId).toBe(OWNER_USER_ID);
    expect(mockEq).toHaveBeenCalledWith(waterLogs.userId, OWNER_USER_ID);
    expect(mockEq).not.toHaveBeenCalledWith(waterLogs.userId, ATTACKER_USER_ID);
  });
});