import express, { NextFunction, Request, Response } from "express";
import request from "supertest";

const mockAuth = { user: null as { id: string } | null };
const mockStorage = {
  createPhysicianReport: jest.fn(),
  getUserPhysicianReports: jest.fn(),
  getPhysicianReportById: jest.fn(),
  deactivatePhysicianReport: jest.fn(),
};

jest.mock("../storage", () => ({ storage: mockStorage }));
jest.mock("../services/procareAccessService", () => ({
  verifyPhysicianClientAccess: jest.fn(),
}));
jest.mock("../lib/orgIsolation", () => ({
  handleOrgIsolationError: jest.fn(() => false),
}));

import { verifyPhysicianClientAccess } from "../services/procareAccessService";

const mockVerifyAccess = verifyPhysicianClientAccess as jest.MockedFunction<
  typeof verifyPhysicianClientAccess
>;

async function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).authUser = mockAuth.user;
    next();
  });
  app.use("/api/physician-reports", (await import("../routes/physicianReports")).default);
  return app;
}

const reportPayload = (userId: string) => ({
  userId,
  healthProfile: {
    hasDiabetes: false,
    allergies: [],
    medicalConditions: [],
    medications: [],
    dietaryRestrictions: [],
  },
  mealPlan: [],
});

beforeEach(() => {
  mockAuth.user = null;
  jest.clearAllMocks();
});

describe("physician report ownership", () => {
  it("denies cross-user creation before storage writes", async () => {
    mockAuth.user = { id: "user-a" };
    mockVerifyAccess.mockResolvedValue(false);
    const response = await request(await buildApp())
      .post("/api/physician-reports")
      .send(reportPayload("user-b"));

    expect(response.status).toBe(403);
    expect(mockStorage.createPhysicianReport).not.toHaveBeenCalled();
  });

  it("creates a delegated report only after active relationship authorization", async () => {
    mockAuth.user = { id: "physician-a" };
    mockVerifyAccess.mockResolvedValue(true);
    mockStorage.createPhysicianReport.mockResolvedValue({
      id: "report-1", accessCode: "MPM-ABC-1234", reportDate: new Date(),
    });
    const response = await request(await buildApp())
      .post("/api/physician-reports")
      .send(reportPayload("client-b"));

    expect(response.status).toBe(200);
    expect(mockVerifyAccess).toHaveBeenCalledWith("physician-a", "client-b");
    expect(mockStorage.createPhysicianReport).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "client-b" }),
    );
  });

  it("denies cross-user report listing before storage reads", async () => {
    mockAuth.user = { id: "user-a" };
    mockVerifyAccess.mockResolvedValue(false);
    const response = await request(await buildApp()).get("/api/physician-reports/user/user-b");

    expect(response.status).toBe(403);
    expect(mockStorage.getUserPhysicianReports).not.toHaveBeenCalled();
  });

  it("lists a client's reports after relationship authorization", async () => {
    mockAuth.user = { id: "physician-a" };
    mockVerifyAccess.mockResolvedValue(true);
    mockStorage.getUserPhysicianReports.mockResolvedValue([]);
    const response = await request(await buildApp()).get("/api/physician-reports/user/client-b");

    expect(response.status).toBe(200);
    expect(mockStorage.getUserPhysicianReports).toHaveBeenCalledWith("client-b");
  });

  it("denies deletion of another user's report", async () => {
    mockAuth.user = { id: "user-a" };
    mockStorage.getPhysicianReportById.mockResolvedValue({ id: "report-1", userId: "user-b" });
    const response = await request(await buildApp()).delete("/api/physician-reports/report-1");

    expect(response.status).toBe(403);
    expect(mockStorage.deactivatePhysicianReport).not.toHaveBeenCalled();
  });

  it("deactivates an owned report through storage", async () => {
    mockAuth.user = { id: "user-a" };
    mockStorage.getPhysicianReportById.mockResolvedValue({ id: "report-1", userId: "user-a" });
    mockStorage.deactivatePhysicianReport.mockResolvedValue(true);
    const response = await request(await buildApp()).delete("/api/physician-reports/report-1");

    expect(response.status).toBe(200);
    expect(mockStorage.deactivatePhysicianReport).toHaveBeenCalledWith("report-1");
  });
});