import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { buildGuestEnvelope } from "../services/protocolEnvelope";
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";

const mockCreate = jest.fn();

jest.mock("openai", () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.__testAuthUser === null) return res.status(401).json({ error: "Authentication required" });
    req.authUser = req.__testAuthUser;
    next();
  },
}));

jest.mock("../middleware/requireActiveAccess", () => ({
  requireActiveAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../services/protocolEnvelope", () => {
  const actual = jest.requireActual("../services/protocolEnvelope");
  return {
    ...actual,
    loadUserProtocolEnvelope: jest.fn(),
  };
});

const mockLoadEnvelope = loadUserProtocolEnvelope as jest.MockedFunction<
  typeof loadUserProtocolEnvelope
>;

function makeEnvelope(): UserProtocolEnvelope {
  return {
    ...buildGuestEnvelope(),
    userId: "authenticated-subject",
    dietaryIdentity: ["vegan"],
    allergies: ["peanuts"],
  };
}

async function buildApp(authUser: Record<string, unknown> | null) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).__testAuthUser = authUser;
    next();
  });
  const router = (await import("../routes/chef")).default;
  app.use("/api", router);
  return app;
}

describe("POST /api/chef/ask protocol enforcement", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    mockCreate.mockReset();
    mockLoadEnvelope.mockReset();
    mockLoadEnvelope.mockResolvedValue(makeEnvelope());
  });

  it("adds the authenticated subject's active protocol to the actual model prompt", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Try lentils with rice for lunch." } }],
    });
    const app = await buildApp({ id: "authenticated-subject", preferredLanguage: "auto" });

    const response = await request(app)
      .post("/api/chef/ask")
      .send({ question: "What are some lunch options?", userId: "some-other-user" });

    expect(response.status).toBe(200);
    expect(mockLoadEnvelope).toHaveBeenCalledWith("authenticated-subject");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const systemPrompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).toContain("This user follows: vegan.");
    expect(systemPrompt).toContain("peanuts");
  });

  it("fails closed when the model recommends food prohibited by the resolved protocol", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Try chicken breast with vegetables." } }],
    });
    const app = await buildApp({ id: "authenticated-subject", preferredLanguage: "auto" });

    const response = await request(app)
      .post("/api/chef/ask")
      .send({ question: "What should I eat for lunch?" });

    expect(response.status).toBe(422);
    expect(response.body).not.toHaveProperty("answer");
  });

  it("preserves ordinary non-food Q&A under an active food protocol", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "A simmer is gentle bubbling; a rolling boil is vigorous bubbling." } }],
    });
    const app = await buildApp({ id: "authenticated-subject", preferredLanguage: "auto" });

    const response = await request(app)
      .post("/api/chef/ask")
      .send({ question: "What is the difference between a simmer and a rolling boil?" });

    expect(response.status).toBe(200);
    expect(response.body.answer).toContain("A simmer is gentle bubbling");
  });
});