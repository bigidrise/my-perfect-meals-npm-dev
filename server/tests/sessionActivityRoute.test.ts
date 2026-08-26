import express from "express";
import request from "supertest";

const mockAuthUser = {
  role: "client",
  professionalRole: "trainer",
};

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.authUser = mockAuthUser;
    next();
  },
}));

import keepaliveRouter from "../routes/keepalive";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", keepaliveRouter);
  return app;
}

describe("clinical Studio recording session activity", () => {
  it("accepts the narrowly scoped activity for clinical recording", async () => {
    const response = await request(buildApp())
      .post("/api/session/activity")
      .send({ activity: "studio_video_recording" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, activity: "studio_video_recording" });
  });

  it("rejects unsupported activity names", async () => {
    const response = await request(buildApp())
      .post("/api/session/activity")
      .send({ activity: "general_keepalive" });

    expect(response.status).toBe(400);
  });

  it("leaves consumer sessions outside the clinical recording exception", async () => {
    mockAuthUser.professionalRole = null;
    const response = await request(buildApp())
      .post("/api/session/activity")
      .send({ activity: "studio_video_recording" });

    expect(response.status).toBe(403);
    mockAuthUser.professionalRole = "trainer";
  });
});