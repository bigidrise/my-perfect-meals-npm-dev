import express from "express";
import request from "supertest";
import { billingSafeguardsRouter } from "../routes/billingSafeguards";
import { pool } from "../db";
import { scanBillingDuplicates } from "../services/billingSafeguards/monitor";

jest.mock("../db", () => ({ pool: { query: jest.fn() }, db: {} }));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.get("x-fixture-user")) return res.status(401).json({ code: "AUTH_REQUIRED" });
    req.authUser = { id: req.get("x-fixture-user") };
    next();
  },
}));
jest.mock("../middleware/requireAdmin", () => ({
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.get("x-fixture-admin") !== "true") return res.status(403).json({ code: "ADMIN_REQUIRED" });
    if (req.get("x-fixture-mfa") !== "true") return res.status(403).json({ code: "MFA_REQUIRED" });
    next();
  },
}));
jest.mock("../services/billingSafeguards/monitor", () => ({
  scanBillingDuplicates: jest.fn(),
  startBillingDuplicateMonitor: jest.fn(),
}));
jest.mock("../services/isolatedStripeClient", () => ({ __esModule: true, default: jest.fn() }));

describe("billing safety operator routes (all provider and database I/O mocked)", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/billing-safety", billingSafeguardsRouter);
  const prior = process.env.BILLING_CHECKOUT_SAFEGUARDS_ENABLED;
  beforeEach(() => { delete process.env.BILLING_CHECKOUT_SAFEGUARDS_ENABLED; jest.clearAllMocks(); });
  afterAll(() => {
    if (prior === undefined) delete process.env.BILLING_CHECKOUT_SAFEGUARDS_ENABLED;
    else process.env.BILLING_CHECKOUT_SAFEGUARDS_ENABLED = prior;
  });
  const operator = (path: string) => request(app).get(path)
    .set("x-fixture-user", "admin_fixture").set("x-fixture-admin", "true").set("x-fixture-mfa", "true");
  it("denies unauthenticated operators before any database/provider operation", async () => {
    await request(app).post("/api/admin/billing-safety/scan").expect(401);
    expect(scanBillingDuplicates).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });
  it("requires both administrator authority and MFA", async () => {
    await request(app).get("/api/admin/billing-safety/incidents").set("x-fixture-user", "regular_fixture").expect(403);
    await request(app).get("/api/admin/billing-safety/incidents")
      .set("x-fixture-user", "admin_fixture").set("x-fixture-admin", "true").expect(403);
    expect(pool.query).not.toHaveBeenCalled();
  });
  it("keeps the new feature off by default without touching unprovisioned tables", async () => {
    await operator("/api/admin/billing-safety/incidents").expect(503, { code: "BILLING_SAFEGUARDS_NOT_RELEASED" });
    expect(pool.query).not.toHaveBeenCalled();
  });
  it("returns durable incidents and scan freshness only to an authorized operator after activation", async () => {
    process.env.BILLING_CHECKOUT_SAFEGUARDS_ENABLED = "true";
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
    await operator("/api/admin/billing-safety/incidents").expect(200, { incidents: [], scans: [] });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});
