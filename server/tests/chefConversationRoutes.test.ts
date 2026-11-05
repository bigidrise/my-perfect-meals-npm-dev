import express from "express";
import type { Server } from "node:http";
jest.mock("../db", () => ({ db: { execute: jest.fn(), select: jest.fn() } }));
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
  process.env.NODE_ENV = "development"; jest.clearAllMocks();
  (db.select as jest.Mock).mockImplementation(() => { throw new Error("Assessment must not be queried"); });
  (db.execute as jest.Mock).mockResolvedValue({ rows: [] });
  (engine.run as jest.Mock).mockResolvedValue({
    conversationId: "fixture-conversation", messageId: "fixture-message",
    presentation: { kind: "concierge", message: "Savory or sweet?" },
    whatIFound: "Savory or sweet?", whatItCouldMean: "", todayPlan: { items: [] }, learningOpportunity: null,
  });
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
test("Production ignores the new correlation field and retains concurrent endpoint behavior", async () => {
  process.env.NODE_ENV = "production";
  let finish!: (value: any) => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  (engine.run as jest.Mock).mockImplementationOnce(() => {
    started(); return new Promise(resolve => { finish = resolve; });
  });
  const first = postTurn("synthetic-member", { clientTurnId: "ignored-invalid-field" });
  await entered;
  const second = await postTurn("synthetic-member");
  expect(second.status).toBe(200);
  expect((await second.json()).clientTurnId).toBeUndefined();
  finish({ conversationId: "fixture-conversation", messageId: "fixture-message",
    whatIFound: "", whatItCouldMean: "", todayPlan: { items: [] } });
  expect((await first).status).toBe(200);
  expect(engine.run).toHaveBeenCalledTimes(2);
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
