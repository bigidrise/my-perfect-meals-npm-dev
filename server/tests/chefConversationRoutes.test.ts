import express from "express";
import type { Server } from "node:http";
jest.mock("../db", () => ({ db: { execute: jest.fn(), select: jest.fn() } }));
jest.mock("../services/coaching/engine", () => ({ engine: { run: jest.fn() } }));
jest.mock("../services/coaching/activityEvents", () => ({ emitActivityEvent: jest.fn() }));
jest.mock("../routes/coachingNavigation", () => ({ __esModule: true, default: require("express").Router() }));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.headers["x-test-user"]) return res.status(401).json({ error: "Unauthorized" });
    req.authUser = { id: req.headers["x-test-user"] }; next();
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
test.each(["new-member", "existing-member"])("%s can send an authenticated message without any assessment lookup", async id => {
  const result = await fetch(`${base}/message`, { method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user": id }, body: JSON.stringify({ message: "I'm hungry." }) });
  expect(result.status).toBe(200);
  expect((await result.json()).response.presentation.message).toBe("Savory or sweet?");
  expect(db.select).not.toHaveBeenCalled();
  expect(engine.run).toHaveBeenCalledTimes(1);
});
test("Development bootstrap restores stored structured conversation without an assessment lookup", async () => {
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
test("Production still enforces its historical intake gate", async () => {
  process.env.NODE_ENV = "production";
  const builder: any = { from: () => builder, where: () => builder, limit: () => Promise.resolve([]) };
  (db.select as jest.Mock).mockReturnValue(builder);
  const result = await fetch(`${base}/message`, { method: "POST", headers: { "Content-Type": "application/json",
    "x-test-user": "new-member" }, body: JSON.stringify({ message: "Hello" }) });
  expect(result.status).toBe(403);
  expect((await result.json()).code).toBe("INTAKE_REQUIRED");
  expect(engine.run).not.toHaveBeenCalled();
});
