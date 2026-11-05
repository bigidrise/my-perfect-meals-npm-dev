import express from "express";
import type { Server } from "node:http";
jest.mock("../db", () => ({ db: { execute: jest.fn(), select: jest.fn(), transaction: jest.fn() } }));
jest.mock("../services/coaching/engine", () => ({ engine: { run: jest.fn() } }));
jest.mock("../services/coaching/activityEvents", () => ({ emitActivityEvent: jest.fn() }));
jest.mock("../routes/coachingNavigation", () => ({ __esModule: true, default: require("express").Router() }));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.headers["x-test-user"]) return res.status(401).json({ error: "Unauthorized" });
    req.authUser = { id: req.headers["x-test-user"], accessTier: "PAID_FULL", planLookupKey: "mpm_premium" }; next();
  },
}));
import router from "../routes/coachingEngine";
import { db } from "../db";
import { engine } from "../services/coaching/engine";
import { PgDialect } from "drizzle-orm/pg-core";
let server: Server;
let base: string;
const oldEnvironment = process.env.NODE_ENV;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/api/coach", router);
  server = await new Promise<Server>(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  base = `http://127.0.0.1:${(server.address() as any).port}/api/coach`;
});
afterAll(async () => { process.env.NODE_ENV = oldEnvironment; await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  process.env.NODE_ENV = oldEnvironment === "production" ? "production" : "development"; jest.clearAllMocks();
  (db.select as jest.Mock).mockImplementation(() => { throw new Error("Assessment must not be queried"); });
  (db.execute as jest.Mock).mockResolvedValue({ rows: [] });
  (db.transaction as jest.Mock).mockImplementation(callback => callback({ execute: db.execute }));
  (engine.run as jest.Mock).mockResolvedValue({
    conversationId: "fixture-conversation", messageId: "fixture-message",
    presentation: { kind: "concierge", message: "Savory or sweet?" },
    whatIFound: "Savory or sweet?", whatItCouldMean: "", todayPlan: { items: [] }, learningOpportunity: null,
  });
});

const clearRow = { owner_id: "clear-owner", specialization: "corner",
  subject_type: "user", subject_id: "clear-owner" };
const clearRequest = (owner = "clear-owner") => fetch(`${base}/conversation/selected-chat`, {
  method: "DELETE", headers: { "x-test-user": owner },
});

test("clear is transactional and scopes every deletion to the owner's open Ask Chef history", async () => {
  (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [clearRow] });
  const response = await clearRequest();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(db.transaction).toHaveBeenCalledTimes(1);
  const queries = (db.execute as jest.Mock).mock.calls.map(([query]) => new PgDialect().sqlToQuery(query));
  expect(queries).toHaveLength(6);
  expect(queries[1].sql).toContain("FOR UPDATE");
  for (const query of queries.slice(2)) {
    expect(query.sql).toMatch(/^DELETE FROM coach_/);
    expect(query.sql).toContain("owner_id =");
    expect(query.sql).toContain("subject_id =");
    expect(query.sql).toContain("status = 'open'");
    expect(query.params).toEqual(["clear-owner", "corner", "user", "clear-owner", "selected-chat", true]);
  }
});

test.each([[[], 404], [[{ ...clearRow, owner_id: "another-owner" }], 403]])(
  "missing or foreign conversations never trigger deletion", async (rows, status) => {
    (db.execute as jest.Mock).mockResolvedValueOnce({ rows });
    const response = await clearRequest();
    expect(response.status).toBe(status);
    expect(db.execute).toHaveBeenCalledTimes(1);
  },
);

test("non-corner clear remains scoped to the selected conversation", async () => {
  (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [{ ...clearRow, specialization: "pediatric" }] });
  expect((await clearRequest()).status).toBe(200);
  const last = new PgDialect().sqlToQuery((db.execute as jest.Mock).mock.calls[5][0]);
  expect(last.params.at(-1)).toBe(false);
});

test("transaction failure reports failure and releases the send/clear exclusion", async () => {
  (db.transaction as jest.Mock).mockRejectedValueOnce(new Error("Synthetic rollback"));
  expect((await clearRequest()).status).toBe(500);
  (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [clearRow] });
  expect((await clearRequest()).status).toBe(200);
});

test("clear cannot race an in-flight Chef reply", async () => {
  let finish!: (value: unknown) => void;
  let markStarted!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  (engine.run as jest.Mock).mockImplementationOnce(() => {
    markStarted();
    return new Promise(resolve => { finish = resolve; });
  });
  const sending = fetch(`${base}/message`, { method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user": "clear-owner" },
    body: JSON.stringify({ message: "Hello Chef." }) });
  await started;
  try {
    expect((await clearRequest()).status).toBe(409);
    expect(db.transaction).not.toHaveBeenCalled();
  } finally {
    finish({ conversationId: "selected-chat", messageId: "reply", todayPlan: { items: [] } });
    await sending;
  }
  (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [clearRow] });
  expect((await clearRequest()).status).toBe(200);
});

test("anonymous clear never touches the database", async () => {
  expect((await fetch(`${base}/conversation/selected-chat`, { method: "DELETE" })).status).toBe(401);
  expect(db.transaction).not.toHaveBeenCalled();
  expect(db.execute).not.toHaveBeenCalled();
});

test("Production uses the same transactional, owner-scoped conversation clear", async () => {
  process.env.NODE_ENV = "production";
  (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [clearRow] });
  expect((await clearRequest()).status).toBe(200);
  expect(db.transaction).toHaveBeenCalledTimes(1);
  expect(db.execute).toHaveBeenCalledTimes(6);
});
test.each([
  ["development", "new-member"], ["development", "existing-member"],
  ["production", "new-member"], ["production", "existing-member"],
])("%s %s can send an authenticated message without any assessment lookup", async (environment, id) => {
  process.env.NODE_ENV = environment;
  const result = await fetch(`${base}/message`, { method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user": id }, body: JSON.stringify({ message: "I'm hungry." }) });
  expect(result.status).toBe(200);
  expect((await result.json()).response.presentation.message).toBe("Savory or sweet?");
  expect(db.select).not.toHaveBeenCalled();
  expect(engine.run).toHaveBeenCalledTimes(1);
});
test.each(["development", "production"])("%s bootstrap restores stored structured conversation without an assessment lookup", async environment => {
  process.env.NODE_ENV = environment;
  const payload = { presentation: { kind: "concierge", message: "A previous reply." } };
  (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [{ id: "saved-conversation" }] })
    .mockResolvedValueOnce({ rows: [{ id: "saved-message", role: "assistant", structured_payload: payload }] });
  const result = await fetch(`${base}/bootstrap`, { headers: { "x-test-user": "existing-member" } });
  const body = await result.json();
  expect(result.status).toBe(200);
  expect(body.messages[0].structured_payload).toEqual(payload);
  expect(body.profile).toBeNull();
  expect(body.dueFollowup).toBeNull();
  expect(db.select).not.toHaveBeenCalled();
});
test("authentication remains required", async () => {
  expect((await fetch(`${base}/message`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hello" }) })).status).toBe(401);
  expect(engine.run).not.toHaveBeenCalled();
});

const turnId = "00000000-0000-4000-8000-000000000001";
async function postTurn(user: string, extra: Record<string, unknown> = {}) {
  return fetch(`${base}/message`, { method: "POST", headers: {
    "Content-Type": "application/json", "x-test-user": user,
  }, body: JSON.stringify({ message: "Latest member message", clientTurnId: turnId, ...extra }) });
}
test("Development echoes the submitted turn and delivers the latest message unchanged", async () => {
  const result = await postTurn("synthetic-member");
  expect((await result.json()).clientTurnId).toBe(turnId);
  expect(engine.run).toHaveBeenCalledWith(expect.objectContaining({
    userMessage: "Latest member message", subject: expect.objectContaining({ ownerId: "synthetic-member" }),
  }), expect.anything());
  expect(db.execute).not.toHaveBeenCalled();
});
test("Development rejects invalid correlation IDs before invoking the engine", async () => {
  expect((await postTurn("synthetic-member", { clientTurnId: "not-a-uuid" })).status).toBe(400);
  expect(engine.run).not.toHaveBeenCalled();
});
test.each(["duplicate", "overlap"])("Development excludes a same-member %s while allowing other members", async kind => {
  let finish!: (value: any) => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const firstResult = { conversationId: "fixture-conversation", messageId: "first-message",
    whatIFound: "First reply", whatItCouldMean: "", todayPlan: { items: [] }, learningOpportunity: null };
  (engine.run as jest.Mock).mockImplementationOnce(() => {
    started();
    return new Promise(resolve => { finish = resolve; });
  });
  const first = postTurn("synthetic-member");
  await entered;
  const second = await postTurn("synthetic-member", kind === "overlap"
    ? { clientTurnId: "00000000-0000-4000-8000-000000000002", message: "Another question" } : {});
  expect(second.status).toBe(409);
  expect((await second.json()).code).toBe("CHEF_TURN_IN_PROGRESS");
  expect(engine.run).toHaveBeenCalledTimes(1);
  expect((await postTurn("different-synthetic-member")).status).toBe(200);
  finish(firstResult);
  expect((await first).status).toBe(200);
  expect((await postTurn("synthetic-member")).status).toBe(200);
  expect(engine.run).toHaveBeenCalledTimes(3);
});
test.each([401, 403, 500])("a Development engine failure %s releases the member's in-flight guard", async status => {
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    (engine.run as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("Synthetic failure"), { status }));
    expect((await postTurn("synthetic-member")).status).toBe(status);
    expect((await postTurn("synthetic-member")).status).toBe(200);
  } finally { errors.mockRestore(); }
});
test("Production validates correlation and excludes overlapping turns just like Development", async () => {
  process.env.NODE_ENV = "production";
  expect((await postTurn("synthetic-member", { clientTurnId: "invalid-field" })).status).toBe(400);
  let finish!: (value: any) => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  (engine.run as jest.Mock).mockImplementationOnce(() => {
    started(); return new Promise(resolve => { finish = resolve; });
  });
  const first = postTurn("synthetic-member");
  await entered;
  const second = await postTurn("synthetic-member");
  expect(second.status).toBe(409);
  expect((await second.json()).code).toBe("CHEF_TURN_IN_PROGRESS");
  finish({ conversationId: "fixture-conversation", messageId: "fixture-message",
    whatIFound: "", whatItCouldMean: "", todayPlan: { items: [] } });
  expect((await first).status).toBe(200);
  expect(engine.run).toHaveBeenCalledTimes(1);
});
test("Production does not fall back to an intake for a newly eligible member", async () => {
  process.env.NODE_ENV = "production";
  const result = await fetch(`${base}/message`, { method: "POST", headers: { "Content-Type": "application/json",
    "x-test-user": "new-member" }, body: JSON.stringify({ message: "Hello" }) });
  expect(result.status).toBe(200);
  expect((await result.json()).response.presentation.kind).toBe("concierge");
  expect(db.select).not.toHaveBeenCalled();
  expect(engine.run).toHaveBeenCalledTimes(1);
});
