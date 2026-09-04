const ACTOR_ID = "phone-owner";
const OTHER_ID = "other-user";

const auth = { user: null as { id: string } | null };
const mockMessageCreate = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!auth.user) return res.status(401).json({ error: "Authentication required" });
    req.authUser = auth.user;
    next();
  },
}));

jest.mock("twilio", () => jest.fn(() => ({
  messages: { create: mockMessageCreate },
})));

jest.mock("../db", () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    update: (...args: any[]) => mockUpdate(...args),
  },
}));

import express from "express";
import request from "supertest";
import phoneRouter from "../routes/phone";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", phoneRouter);
  return app;
}

beforeEach(() => {
  auth.user = null;
  mockMessageCreate.mockReset();
  mockSelect.mockReset();
  mockUpdate.mockReset();
});

describe("phone and SMS-consent actor isolation", () => {
  const attacks = [
    ["GET phone", (app: express.Express) => request(app).get(`/api/users/${OTHER_ID}/phone`)],
    ["request code", (app: express.Express) => request(app).post(`/api/users/${OTHER_ID}/phone/request-code`).send({ phone: "+15555550100" })],
    ["verify code", (app: express.Express) => request(app).post(`/api/users/${OTHER_ID}/phone/verify`).send({ code: "123456" })],
    ["change consent", (app: express.Express) => request(app).put(`/api/users/${OTHER_ID}/sms-consent`).send({ consent: true })],
  ] as const;

  for (const [name, attack] of attacks) {
    it(`denies cross-user ${name} before database or SMS access`, async () => {
      auth.user = { id: ACTOR_ID };

      const response = await attack(buildApp());

      expect(response.status).toBe(403);
      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockMessageCreate).not.toHaveBeenCalled();
    });
  }

  it("permits the owner to read their phone state", async () => {
    auth.user = { id: ACTOR_ID };
    mockSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{
            id: ACTOR_ID,
            phoneE164: "+15555550100",
            phoneVerified: true,
            smsConsent: true,
          }]),
        }),
      }),
    });

    const response = await request(buildApp()).get(`/api/users/${ACTOR_ID}/phone`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      phoneE164: "+15555550100",
      phoneVerified: true,
      smsConsent: true,
    });
  });
});