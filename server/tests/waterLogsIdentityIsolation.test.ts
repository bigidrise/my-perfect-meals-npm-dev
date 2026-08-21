/**
 * Route-level identity-isolation coverage for water logs.
 *
 * Water records are always scoped to the authenticated user. A `clientId` can
 * select a different record owner only after the shared ProCare relationship
 * verifier approves it; legacy caller-supplied `userId` values are ignored.
 */

import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";

const mockAuth = {
  user: null as Record<string, unknown> | null,
  tokenUser: null as Record<string, unknown> | null,
};

const mockDb = {
  whereConditions: [] as unknown[],
  insertedValues: [] as Array<Record<string, unknown>>,
  selectRows: [] as Array<Record<string, unknown>>,
};

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const tokenUser =
      req.headers["x-auth-token"] === "native-water-log-token"
        ? mockAuth.tokenUser
        : null;
    const authUser = mockAuth.user ?? tokenUser;
    if (!authUser) {
      return res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    }
    req.authUser = authUser;
    next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("../services/procareAccessService", () => ({
  verifyPhysicianClientAccess: jest.fn(),
}));

jest.mock("../lib/orgIsolation", () => ({
  handleOrgIsolationError: jest.fn(() => false),
}));

jest.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          mockDb.whereConditions.push(condition);
          return {
            orderBy: () => ({
              limit: () => Promise.resolve([...mockDb.selectRows]),
            }),
          };
        },
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mockDb.insertedValues.push(values);
        return {
          returning: () => Promise.resolve([{ id: "water-log-1", ...values }]),
        };
      },
    }),
  },
}));

import { verifyPhysicianClientAccess } from "../services/procareAccessService";
import { handleOrgIsolationError } from "../lib/orgIsolation";

const mockVerifyAccess = verifyPhysicianClientAccess as jest.MockedFunction<
  typeof verifyPhysicianClientAccess
>;
const mockHandleOrgError = handleOrgIsolationError as jest.MockedFunction<
  typeof handleOrgIsolationError
>;

async function buildApp() {
  const app = express();
  app.use(express.json());
  const router = (await import("../routes/waterLogs")).default;
  app.use("/api", router);
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });
  return app;
}

function authenticatedAs(id: string) {
  mockAuth.user = { id };
}

function queriedUserIds() {
  const dialect = new PgDialect();
  return mockDb.whereConditions.flatMap((condition) =>
    dialect.sqlToQuery(condition as any).params.filter(
      (value): value is string => typeof value === "string",
    ),
  );
}

beforeEach(() => {
  mockAuth.user = null;
  mockAuth.tokenUser = null;
  mockDb.whereConditions = [];
  mockDb.insertedValues = [];
  mockDb.selectRows = [];
  mockVerifyAccess.mockReset();
  mockHandleOrgError.mockReset();
  mockHandleOrgError.mockReturnValue(false);
});

describe("water-log route authentication", () => {
  it.each([
    ["GET", "/api/water-logs"],
    ["POST", "/api/water-logs"],
  ])("rejects unauthenticated %s requests", async (method, path) => {
    const app = await buildApp();
    const response =
      method === "GET"
        ? await request(app).get(path)
        : await request(app).post(path).send({ amount: 8, unit: "oz" });

    expect(response.status).toBe(401);
    expect(mockDb.whereConditions).toHaveLength(0);
    expect(mockDb.insertedValues).toHaveLength(0);
  });
});

describe("water-log account isolation", () => {
  it("scopes token-authenticated mobile reads and writes to the token account", async () => {
    mockAuth.tokenUser = { id: "native-account-a" };
    const app = await buildApp();

    const read = await request(app)
      .get("/api/water-logs?userId=account-b")
      .set("x-auth-token", "native-water-log-token");
    const write = await request(app)
      .post("/api/water-logs")
      .set("x-auth-token", "native-water-log-token")
      .send({ userId: "account-b", amount: 8, unit: "oz" });

    expect(read.status).toBe(200);
    expect(write.status).toBe(200);
    expect(queriedUserIds()).toContain("native-account-a");
    expect(queriedUserIds()).not.toContain("account-b");
    expect(mockDb.insertedValues[0]).toMatchObject({ userId: "native-account-a" });
  });

  it("ignores a caller-supplied userId on reads and scopes the query to the authenticated user", async () => {
    authenticatedAs("account-a");
    const app = await buildApp();

    const response = await request(app)
      .get("/api/water-logs?userId=account-b&from=2026-08-01&to=2026-08-02");

    expect(response.status).toBe(200);
    expect(queriedUserIds()).toContain("account-a");
    expect(queriedUserIds()).not.toContain("account-b");
    expect(mockVerifyAccess).not.toHaveBeenCalled();
  });

  it("ignores a caller-supplied userId on writes and persists the authenticated user", async () => {
    authenticatedAs("account-a");
    const app = await buildApp();

    const response = await request(app)
      .post("/api/water-logs")
      .send({ userId: "account-b", amount: 8, unit: "oz" });

    expect(response.status).toBe(200);
    expect(mockDb.insertedValues).toHaveLength(1);
    expect(mockDb.insertedValues[0]).toMatchObject({
      userId: "account-a",
      amountMl: 237,
      unit: "oz",
    });
    expect(mockVerifyAccess).not.toHaveBeenCalled();
  });

  it("returns 403 before querying another account when ProCare authorization fails", async () => {
    authenticatedAs("professional-a");
    mockVerifyAccess.mockResolvedValue(false);
    const app = await buildApp();

    const response = await request(app).get("/api/water-logs?clientId=account-b");

    expect(response.status).toBe(403);
    expect(mockVerifyAccess).toHaveBeenCalledWith("professional-a", "account-b");
    expect(mockDb.whereConditions).toHaveLength(0);
  });

  it("allows a verified ProCare professional to read a client's records", async () => {
    authenticatedAs("professional-a");
    mockVerifyAccess.mockResolvedValue(true);
    const app = await buildApp();

    const response = await request(app).get("/api/water-logs?clientId=account-b");

    expect(response.status).toBe(200);
    expect(queriedUserIds()).toContain("account-b");
    expect(mockVerifyAccess).toHaveBeenCalledWith("professional-a", "account-b");
  });

  it("allows a verified ProCare professional to write a client's record", async () => {
    authenticatedAs("professional-a");
    mockVerifyAccess.mockResolvedValue(true);
    const app = await buildApp();

    const response = await request(app)
      .post("/api/water-logs")
      .send({ clientId: "account-b", amount: 500, unit: "ml" });

    expect(response.status).toBe(200);
    expect(mockDb.insertedValues[0]).toMatchObject({
      userId: "account-b",
      amountMl: 500,
    });
    expect(mockVerifyAccess).toHaveBeenCalledWith("professional-a", "account-b");
  });

  it("fails closed when the delegated authorization check errors", async () => {
    authenticatedAs("professional-a");
    mockVerifyAccess.mockRejectedValue(new Error("authorization service unavailable"));
    const app = await buildApp();

    const response = await request(app).get("/api/water-logs?clientId=account-b");

    expect(response.status).toBe(503);
    expect(mockDb.whereConditions).toHaveLength(0);
  });
});