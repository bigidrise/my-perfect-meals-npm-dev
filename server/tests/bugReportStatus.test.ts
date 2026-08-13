/**
 * Route-level tests for the bugReports router.
 *
 * Mounts the real server/routes/bugReports.ts router in a minimal Express
 * test app, then uses supertest to make HTTP requests.  Authentication (requireAuth)
 * and the DB/email boundaries are mocked so each test controls the exact
 * conditions without touching any database or sending real emails.
 *
 * What is exercised by the real code:
 *   • The full middleware chain wired by the router (requireAuth → requireAdmin → handler)
 *   • Status validation logic (400 for unknown status values)
 *   • 404 branch when the DB update touches no rows
 *   • PATCH → GET round-trip (simulates an admin changing status then reloading)
 *
 * Mock strategy:
 *   jest.mock() factories use closures over `mockDb` / `mockAuth` objects
 *   (names starting with "mock" to satisfy ts-jest hoisting rules).
 *   Individual tests mutate those objects in beforeEach/within the test.
 */

// ── Mutable singletons captured by mock factories ─────────────────────────────

const mockAuth = {
  user: null as Record<string, unknown> | null,
  isAdmin: false,
};

const mockDb = {
  /** Rows returned by the GET list handler (db.select…orderBy) */
  selectRows: [] as Record<string, unknown>[],
  /** Rows returned by the PATCH handler's .returning() call */
  updateRows: [] as Record<string, unknown>[],
};

// ── jest.mock — factories must come before imports in ts-jest ESM ─────────────

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

jest.mock("../middleware/requireAdmin", () => ({
  requireAdmin: (_req: any, res: any, next: any) => {
    if (!mockAuth.isAdmin) {
      return res.status(403).json({ error: "Forbidden", code: "ADMIN_REQUIRED" });
    }
    next();
  },
}));

jest.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        orderBy: () => Promise.resolve([...mockDb.selectRows]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([...mockDb.updateRows]),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () =>
          Promise.resolve([
            {
              id:                 "mock-report-id",
              userId:             "u1",
              userEmail:          "u@example.com",
              userName:           "Tester",
              description:        "desc",
              intent:             null,
              route:              null,
              buildVersion:       null,
              environment:        null,
              userAgent:          null,
              includeDiagnostics: false,
              diagnostics:        null,
              status:             "new",
              createdAt:          new Date().toISOString(),
            },
          ]),
      }),
    }),
  },
}));

jest.mock("../services/bugReportEmail", () => ({
  sendBugReportEmail: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mock declarations) ────────────────────────────────────────

import request from "supertest";
import express from "express";
import bugReportsRouter from "../routes/bugReports";

// ── Test app ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use("/api/bug-reports", bugReportsRouter);

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_USER = { id: "admin-1", email: "admin@example.com", username: "admin" };
const REPORT_ID  = "rpt-uuid-001";

function asAdmin() {
  mockAuth.user    = ADMIN_USER;
  mockAuth.isAdmin = true;
}

beforeEach(() => {
  mockAuth.user    = null;
  mockAuth.isAdmin = false;
  mockDb.selectRows  = [];
  mockDb.updateRows  = [];
});

// ─── (A) Admin gate ───────────────────────────────────────────────────────────

describe("Admin gate", () => {
  it("GET — unauthenticated receives 401", async () => {
    const res = await request(app).get("/api/bug-reports");
    expect(res.status).toBe(401);
  });

  it("GET — authenticated but non-admin receives 403", async () => {
    mockAuth.user    = ADMIN_USER;
    mockAuth.isAdmin = false;
    const res = await request(app).get("/api/bug-reports");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_REQUIRED");
  });

  it("GET — admin receives 200 with array of reports", async () => {
    asAdmin();
    mockDb.selectRows = [
      { id: "r1", status: "new",       createdAt: new Date().toISOString() },
      { id: "r2", status: "reviewing", createdAt: new Date().toISOString() },
    ];
    const res = await request(app).get("/api/bug-reports");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("PATCH — unauthenticated receives 401", async () => {
    const res = await request(app)
      .patch(`/api/bug-reports/${REPORT_ID}/status`)
      .send({ status: "reviewing" });
    expect(res.status).toBe(401);
  });

  it("PATCH — authenticated but non-admin receives 403", async () => {
    mockAuth.user    = ADMIN_USER;
    mockAuth.isAdmin = false;
    const res = await request(app)
      .patch(`/api/bug-reports/${REPORT_ID}/status`)
      .send({ status: "reviewing" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_REQUIRED");
  });
});

// ─── (B) Status persistence — PATCH then GET simulates a page reload ─────────

describe("Status persistence round-trip", () => {
  beforeEach(asAdmin);

  it("PATCH to 'reviewing' returns the updated status in the response", async () => {
    mockDb.updateRows = [{ id: REPORT_ID, status: "reviewing" }];
    const res = await request(app)
      .patch(`/api/bug-reports/${REPORT_ID}/status`)
      .send({ status: "reviewing" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(REPORT_ID);
    expect(res.body.status).toBe("reviewing");
  });

  it("after PATCH to 'reviewing', GET list shows the report with that status", async () => {
    // Simulate the DB state after the PATCH has committed
    mockDb.selectRows = [
      { id: REPORT_ID, status: "reviewing", createdAt: new Date().toISOString() },
    ];
    const res = await request(app).get("/api/bug-reports");
    expect(res.status).toBe(200);
    const match = (res.body as Array<Record<string, unknown>>).find(
      (r) => r.id === REPORT_ID,
    );
    expect(match).toBeDefined();
    expect(match!.status).toBe("reviewing");
  });

  it("PATCH + GET full round-trip: 'new' → 'reviewing' status badge is correct after reload", async () => {
    // Step 1 — PATCH
    mockDb.updateRows = [{ id: REPORT_ID, status: "reviewing" }];
    const patchRes = await request(app)
      .patch(`/api/bug-reports/${REPORT_ID}/status`)
      .send({ status: "reviewing" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status).toBe("reviewing");

    // Step 2 — GET (page reload): DB now holds the updated row
    mockDb.selectRows = [{ id: REPORT_ID, status: "reviewing", createdAt: new Date().toISOString() }];
    const getRes = await request(app).get("/api/bug-reports");
    expect(getRes.status).toBe(200);
    const match = (getRes.body as Array<Record<string, unknown>>).find(
      (r) => r.id === REPORT_ID,
    );
    expect(match?.status).toBe("reviewing");
  });

  it("PATCH + GET full round-trip: 'reviewing' → 'resolved'", async () => {
    mockDb.updateRows = [{ id: REPORT_ID, status: "resolved" }];
    const patchRes = await request(app)
      .patch(`/api/bug-reports/${REPORT_ID}/status`)
      .send({ status: "resolved" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status).toBe("resolved");

    mockDb.selectRows = [{ id: REPORT_ID, status: "resolved", createdAt: new Date().toISOString() }];
    const getRes = await request(app).get("/api/bug-reports");
    expect(getRes.status).toBe(200);
    const match = (getRes.body as Array<Record<string, unknown>>).find(
      (r) => r.id === REPORT_ID,
    );
    expect(match?.status).toBe("resolved");
  });
});

// ─── (C) Status validation ────────────────────────────────────────────────────

describe("PATCH — status validation", () => {
  beforeEach(asAdmin);

  it.each(["new", "reviewing", "resolved"] as const)(
    "accepts valid status '%s' → 200",
    async (status) => {
      mockDb.updateRows = [{ id: REPORT_ID, status }];
      const res = await request(app)
        .patch(`/api/bug-reports/${REPORT_ID}/status`)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    },
  );

  it.each(["", "open", "closed", "REVIEWING", "pending", "in-progress"])(
    "rejects invalid status '%s' with 400",
    async (status) => {
      const res = await request(app)
        .patch(`/api/bug-reports/${REPORT_ID}/status`)
        .send({ status });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/status must be one of/i);
    },
  );

  it("returns 400 when body is missing the status field", async () => {
    const res = await request(app)
      .patch(`/api/bug-reports/${REPORT_ID}/status`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── (D) Not-found ────────────────────────────────────────────────────────────

describe("PATCH — not-found", () => {
  beforeEach(asAdmin);

  it("returns 404 when the report ID does not exist (empty .returning())", async () => {
    mockDb.updateRows = []; // empty → handler returns 404
    const res = await request(app)
      .patch("/api/bug-reports/non-existent-id/status")
      .send({ status: "reviewing" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
