import express from "express";
import request from "supertest";
import { LEGAL_DOCUMENTS } from "../../shared/legalDocuments";

const mockRows: any[] = [];
const mockWrites = jest.fn(async (row: any) => { mockRows.push(row); });
jest.mock("../db", () => ({ db: {
  select: () => ({ from: () => ({ where: (condition: any) => {
    const { params } = new (require("drizzle-orm/pg-core").PgDialect)().sqlToQuery(condition);
    const selected = mockRows.filter(row => row.userId === params[0] &&
      (params.length === 1 || row.documentType === params[1] && row.version === params[2]));
    return Object.assign(Promise.resolve(selected), { limit: async () => selected.slice(0, 1) });
  } }) }),
  insert: () => ({ values: mockWrites }),
} }));
jest.mock("../middleware/requireAuth", () => ({ requireAuth: (req: any, res: any, next: any) => {
  if (!req.get("x-fixture-user")) return res.sendStatus(401);
  req.authUser = { id: req.get("x-fixture-user") }; next();
} }));
import router from "../routes/legalRoutes";
const app = express(); app.use(express.json()); app.use("/api/legal", router);
const accept = (body: any, id = "synthetic-a") => request(app).post("/api/legal/accept").set("x-fixture-user", id).set("user-agent", "synthetic-agent").set("x-forwarded-for", "203.0.113.10").send(body);
beforeEach(() => { mockRows.length = 0; mockWrites.mockClear(); });

test("only explicit authenticated current-version requests write consent and capture audit evidence", async () => {
  await request(app).post("/api/legal/accept").send({ documentType: "professional_attestation", version: 1 }).expect(401);
  await accept({ documentType: "professional_attestation", version: 0 }).expect(400);
  await accept({ documentType: "unknown", version: 1 }).expect(400);
  expect(mockWrites).not.toHaveBeenCalled();
  await accept({ documentType: "professional_attestation", version: 1, expectedUserId: "synthetic-a", userId: "synthetic-victim" }).expect(200);
  expect(mockWrites).toHaveBeenCalledWith({
    userId: "synthetic-a", documentType: "professional_attestation", version: 1,
    ipAddress: "203.0.113.10", userAgent: "synthetic-agent",
  });
  await accept({ documentType: "professional_attestation", version: 1 }).expect(200);
  expect(mockWrites).toHaveBeenCalledTimes(1);
});

test("changing accounts in flight cannot write acceptance for the new account", async () => {
  const result = await accept({ documentType: "professional_attestation", version: 1, expectedUserId: "synthetic-a" }, "synthetic-b");
  expect(result.status).toBe(409);
  expect(result.body.code).toBe("LEGAL_ACCOUNT_CHANGED");
  expect(mockWrites).not.toHaveBeenCalled();
});

test("status distinguishes actor identity, role sets and outdated versions without creating rows", async () => {
  for (const doc of LEGAL_DOCUMENTS.professional) mockRows.push({ userId: "synthetic-a", documentType: doc.type, version: doc.version });
  const status = (flow: string, id = "synthetic-a") => request(app).get(`/api/legal/status?flow=${flow}`).set("x-fixture-user", id);
  expect((await status("professional")).body.allAccepted).toBe(true);
  expect((await status("physician")).body.missing).toHaveLength(3);
  expect((await status("attestation")).body.allAccepted).toBe(false);
  expect((await status("professional", "synthetic-b")).body.missing).toHaveLength(3);
  const document = LEGAL_DOCUMENTS.professional[0]; const oldVersion = document.version;
  try { document.version = oldVersion + 1;
    const result = await status("professional");
    expect(result.body.missing).toContain(document.type);
    expect(result.body.documents[0]).toMatchObject({ acceptedVersion: oldVersion, requiredVersion: oldVersion + 1, isCurrent: false });
  } finally { document.version = oldVersion; }
  expect(mockWrites).not.toHaveBeenCalled();
});
