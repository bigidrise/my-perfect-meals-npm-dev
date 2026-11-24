/** Offline route-boundary check: no application DB, credentials or providers. */
import express from "express";
import request from "supertest";
import fs from "node:fs";
import { requireLegacyNarration } from "../middleware/legacyNarration";

test.each(["An explanation", " ", ""])("stale TTS request is rejected before the provider for %j", async text => {
  const provider = jest.fn((_req: express.Request, res: express.Response) => res.send("must not execute"));
  const app = express();
  app.use(express.json());
  app.post("/api/tts", requireLegacyNarration, provider);
  const response = await request(app).post("/api/tts").send({ text });
  expect(response.status).toBe(410);
  expect(response.body.code).toBe("LEGACY_NARRATION_DISABLED");
  expect(provider).not.toHaveBeenCalled();
});

test("the production-effective legacy TTS registration retains authentication then applies the pause", () => {
  expect(fs.readFileSync("server/routes.ts", "utf8"))
    .toContain('app.post("/api/tts", requireAuth, requireLegacyNarration, async');
});
