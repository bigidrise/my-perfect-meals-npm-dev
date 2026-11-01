import express from "express";
import request from "supertest";
import fs from "node:fs";

const mockList = jest.fn();
const mockWrite = jest.fn(() => { throw new Error("Storage writes forbidden in this suite"); });
jest.mock("@replit/object-storage", () => ({
  Client: jest.fn().mockImplementation(() => ({
    list: mockList,
    uploadFromText: mockWrite,
    uploadFromBytes: mockWrite,
    delete: mockWrite,
  })),
}));
jest.mock("../services/mealImageBucket", () => ({ resolveMealImageStorageContext: jest.fn() }));
import { Client } from "@replit/object-storage";
import { resolveMealImageStorageContext } from "../services/mealImageBucket";
import router from "../routes/storageHealth";
const { isReadableStorageResponse, checkStorageHealth } = require("../../scripts/check-object-storage-health.cjs");

const app = express();
app.use("/api/health/storage", router);
const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  (resolveMealImageStorageContext as jest.Mock).mockReturnValue({ bucketId: "fixture-bucket", environment: "production" });
  mockList.mockResolvedValue({ ok: true, value: [] });
});
afterEach(() => { global.fetch = originalFetch; });

test("valid configuration and an empty readable bucket pass without any mutation", async () => {
  const response = await request(app).get("/api/health/storage");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ objectStorage: "readable", probe: "read-only", writeVerified: false });
  expect(Client).toHaveBeenCalledWith({ bucketId: "fixture-bucket" });
  expect(mockList).toHaveBeenCalledWith({ prefix: "health-probe/", maxResults: 1 });
  expect(mockWrite).not.toHaveBeenCalled();
});

test.each(["permission denied", "credential failure", "storage unavailable"])("%s fails closed without leaking SDK details", async error => {
  mockList.mockResolvedValue({ ok: false, error: new Error(error) });
  const response = await request(app).get("/api/health/storage");
  expect(response.status).toBe(503);
  expect(response.body.objectStorage).toBe("unhealthy");
  expect(JSON.stringify(response.body)).not.toContain(error);
  expect(mockWrite).not.toHaveBeenCalled();
});

test("SDK exceptions fail closed", async () => {
  mockList.mockRejectedValue(new Error("private SDK diagnostic"));
  expect((await request(app).get("/api/health/storage")).status).toBe(503);
  expect(mockWrite).not.toHaveBeenCalled();
});

test("invalid bucket/environment configuration fails before constructing a client", async () => {
  (resolveMealImageStorageContext as jest.Mock).mockImplementation(() => { throw new Error("wrong bucket"); });
  expect((await request(app).get("/api/health/storage")).status).toBe(503);
  expect(Client).not.toHaveBeenCalled();
  expect(mockList).not.toHaveBeenCalled();
});

test.each([
  [503, { objectStorage: "readable", probe: "read-only", writeVerified: false }],
  [200, { hasS3: true }],
  [200, { storageBucketId: "configured-but-not-probed" }],
  [200, { objectStorage: "unhealthy", probe: "read-only", writeVerified: false }],
  [200, { objectStorage: "readable" }],
  [200, null],
])("release validator rejects non-authoritative or failed response %j %j", (status, body) => {
  expect(isReadableStorageResponse(status, body)).toBe(false);
});

test("release validator accepts exactly the new read-only contract", () => {
  expect(isReadableStorageResponse(200, { objectStorage: "readable", probe: "read-only", writeVerified: false })).toBe(true);
});

test.each(["network failure", "invalid JSON"])("release client rejects %s", async error => {
  global.fetch = jest.fn().mockImplementation(async () => {
    if (error === "network failure") throw new Error(error);
    return { status: 200, json: async () => { throw new Error(error); } };
  });
  await expect(checkStorageHealth("https://preview.example")).rejects.toThrow();
});

test("release client uses a bounded, non-redirecting GET to the read-only route", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    json: async () => ({ objectStorage: "readable", probe: "read-only", writeVerified: false }),
  });
  await checkStorageHealth("https://preview.example");
  expect(global.fetch).toHaveBeenCalledWith(new URL("https://preview.example/api/health/storage"),
    expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }));
});

test("both entrypoints mount the same probe and the release script no longer infers S3 readiness", () => {
  for (const file of ["server/prod.ts", "server/routes.ts"]) {
    expect(fs.readFileSync(file, "utf8")).toContain('app.use("/api/health/storage", storageHealthRouter)');
  }
  const script = fs.readFileSync("scripts/release-check.sh", "utf8");
  expect(script).toContain('node scripts/check-object-storage-health.cjs "$BASE_URL"');
  expect(script).not.toContain('"hasS3":true');
  expect(script).toContain('fail "Object Storage configuration/read readiness failed"');
});
