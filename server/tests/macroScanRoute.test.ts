const mockVisionCreate = jest.fn();

jest.mock("../db", () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.authUser = { id: "macro-scan-test-user", planLookupKey: "mpm_premium" };
    next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("../middleware/requireActiveAccess", () => ({
  requireActiveAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../utils/openaiSafe", () => ({
  openai: {
    chat: {
      completions: {
        create: mockVisionCreate,
      },
    },
  },
  chatJson: jest.fn(),
}));

jest.mock("../services/ingredientScanService", () => ({
  analyzeProductByName: jest.fn(),
}));

import express from "express";
import request from "supertest";
import biometricsRouter from "../routes/biometricsRoutes";

function app() {
  const instance = express();
  instance.use(express.json({ limit: "2mb" }));
  instance.use("/api/biometrics", biometricsRouter);
  return instance;
}

function visionResult(payload: Record<string, unknown>) {
  mockVisionCreate.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  });
}

describe("POST /api/biometrics/analyze-photo", () => {
  beforeEach(() => {
    mockVisionCreate.mockReset();
  });

  it("returns real macros from a readable Nutrition Facts result using high detail", async () => {
    visionResult({
      status: "success",
      calories: 240,
      protein: 8,
      carbs: 34,
      fat: 9,
      description: "Nutrition Facts label",
    });

    const response = await request(app())
      .post("/api/biometrics/analyze-photo")
      .send({ image: "data:image/jpeg;base64,ZmFrZQ==" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "success",
      calories: 240,
      protein: 8,
      carbs: 34,
      fat: 9,
    });
    const requestBody = mockVisionCreate.mock.calls[0][0];
    expect(requestBody.messages[1].content[1].image_url.detail).toBe("high");
  });

  it("rejects a barcode-only image without inventing macros", async () => {
    visionResult({
      status: "barcode_only",
      calories: 900,
      protein: 50,
      carbs: 80,
      fat: 40,
      description: "barcode",
    });

    const response = await request(app())
      .post("/api/biometrics/analyze-photo")
      .send({ image: "data:image/jpeg;base64,ZmFrZQ==" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("barcode_only");
    expect(response.body).toMatchObject({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(response.body.description).toContain("barcode");
  });

  it("turns an all-zero image result into an unreadable-label response", async () => {
    visionResult({
      status: "success",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      description: "unclear",
    });

    const response = await request(app())
      .post("/api/biometrics/analyze-photo")
      .send({ image: "data:image/jpeg;base64,ZmFrZQ==" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("nutrition_facts_unreadable");
    expect(response.body).toMatchObject({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("returns a retryable failure instead of average macros when vision fails", async () => {
    mockVisionCreate.mockRejectedValueOnce(new Error("vision unavailable"));

    const response = await request(app())
      .post("/api/biometrics/analyze-photo")
      .send({ image: "data:image/jpeg;base64,ZmFrZQ==" });

    expect(response.status).toBe(503);
    expect(response.body.error).toContain("temporarily unavailable");
    expect(response.body).not.toHaveProperty("calories");
  });

  it("preserves text estimation as a successful non-image path", async () => {
    visionResult({
      calories: 310,
      protein: 24,
      carbs: 28,
      fat: 11,
      description: "chicken and rice",
    });

    const response = await request(app())
      .post("/api/biometrics/analyze-photo")
      .send({ text: "chicken and rice" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "success",
      calories: 310,
      protein: 24,
      carbs: 28,
      fat: 11,
    });
  });
});