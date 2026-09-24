import express from "express";
import request from "supertest";
import { csrfProtection } from "../lib/csrfProtection";

const mockPhysicianLock = jest.fn();
const mockDiscontinue = jest.fn();
const mockInvalidate = jest.fn();
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: () => void) => {
    const id = req.get("x-test-user");
    if (!id) return res.status(401).json({ message: "Authentication required." });
    req.authUser = { id };
    next();
  },
}));
jest.mock("../services/labProtocolOwnership", () => ({
  getPhysicianLockStatus: (...args: unknown[]) => mockPhysicianLock(...args),
  discontinueLabDrivenCardiac: (...args: unknown[]) => mockDiscontinue(...args),
}));
jest.mock("../services/queryCache", () => ({
  invalidatePrefix: (...args: unknown[]) => mockInvalidate(...args),
}));

describe("subject's lab-derived Cardiac choice", () => {
  const app = express();
  const path = "/api/user/lab-cardiac-support";
  beforeAll(() => {
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = { userId: "subject", csrfToken: "csrf-test" };
      next();
    });
    app.use(csrfProtection);
    app.use("/api/user", require("../routes/cardiacLabChoice").default());
  });
  beforeEach(() => {
    jest.clearAllMocks();
    mockPhysicianLock.mockResolvedValue(false);
    mockDiscontinue.mockResolvedValue(["renal"]);
  });
  const asSubject = (r: request.Test) => r.set("x-test-user", "subject");
  const withCsrf = (r: request.Test) =>
    asSubject(r).set("Origin", "http://localhost:5000").set("x-csrf-token", "csrf-test");

  it("requires the subject's session and a valid off-only request", async () => {
    expect((await request(app).patch(path).set("Origin", "http://localhost:5000")
      .set("x-csrf-token", "csrf-test").send({ enabled: false })).status).toBe(401);
    expect((await asSubject(request(app).patch(path)).send({ enabled: false })).status).toBe(403);
    expect((await withCsrf(request(app).patch(path)).send({ enabled: true })).status).toBe(400);
    expect((await withCsrf(request(app).patch(path))
      .send({ enabled: false, subjectUserId: "other" })).status).toBe(400);
    expect(mockDiscontinue).not.toHaveBeenCalled();
  });

  it("rejects changes while the physician controls the protocol", async () => {
    mockPhysicianLock.mockResolvedValue(true);
    const result = await withCsrf(request(app).patch(path)).send({ enabled: false });
    expect(result.status).toBe(403);
    expect(mockDiscontinue).not.toHaveBeenCalled();
  });

  it("discontinues only the signed-in subject's Cardiac choice and clears cached profile", async () => {
    const result = await withCsrf(request(app).patch(path)).send({ enabled: false });
    expect(result.status).toBe(200);
    expect(result.body.specialtyConditions).toEqual(["renal"]);
    expect(result.body.message).toContain("lab values were not changed");
    expect(mockDiscontinue).toHaveBeenCalledWith("subject");
    expect(mockInvalidate).toHaveBeenCalledWith("profile:subject");
  });

  it("reports failure rather than pretending the change persisted", async () => {
    mockDiscontinue.mockRejectedValueOnce(new Error("write failed"));
    const result = await withCsrf(request(app).patch(path)).send({ enabled: false });
    expect(result.status).toBe(503);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("fails closed if physician ownership cannot be checked", async () => {
    mockPhysicianLock.mockRejectedValueOnce(new Error("database unavailable"));
    const result = await withCsrf(request(app).patch(path)).send({ enabled: false });
    expect(result.status).toBe(503);
    expect(mockDiscontinue).not.toHaveBeenCalled();
  });
});