jest.mock("node:fs", () => ({
  ...jest.requireActual("node:fs"),
  mkdirSync: jest.fn(), openSync: jest.fn(() => 42), writeFileSync: jest.fn(),
  fsyncSync: jest.fn(), closeSync: jest.fn(), existsSync: jest.fn(() => true),
}));
const mockVision = jest.fn();
jest.mock("openai", () => ({
  __esModule: true, default: jest.fn(() => ({ chat: { completions: { create: mockVision } } })),
}));

import { readFileSync, openSync, fsyncSync } from "node:fs";
import {
  developmentImageTestConfig, withDevelopmentImageTestSubject, developmentImageTestScope,
  developmentImageTestCacheInput, assertDevelopmentImageTestRecipe,
  assertDevelopmentImageTestUrl, claimDevelopmentImageTestRequest,
  rememberDevelopmentImageTestImage,
  type DevelopmentImageTestReceipts,
} from "../services/images/developmentImageTestScope";
import { ImageOperation, ImageSpendingLedger } from "../services/images/imageReliability";
import { APPROVED_IMAGE_MODEL } from "../services/images/imageModelRegistry";
import { validateImageAgainstRecipe } from "../services/mealImageValidator";

const runId = "a0000000-0000-4000-8000-000000000001";
const userId = "b0000000-0000-4000-8000-000000000001";
const env = {
  NODE_ENV: "development", IMAGE_DEVELOPMENT_ACTIVATION: "approved-flare",
  DEVELOPMENT_IMAGE_TEST_ENABLED: "approved-single-image",
  DEVELOPMENT_IMAGE_TEST_RUN_ID: runId, DEVELOPMENT_IMAGE_TEST_USER_ID: userId,
};
const subject = { id: userId, email: `image-test+${runId}@example.invalid`, isSandbox: true };
const receipts = (): DevelopmentImageTestReceipts => {
  const used = new Set<string>();
  return { claim: (_config, stage) => {
    if (used.has(stage)) throw new Error("receipt_already_reserved");
    used.add(stage);
  } };
};
const scoped = <T>(work: () => T, store = receipts()) =>
  withDevelopmentImageTestSubject(subject, work, { env, receipts: store });

describe("dormant Development image-test scope (no external IO)", () => {
  afterEach(() => jest.clearAllMocks());
  it("is absent by default and does not change normal cache identity", () => {
    expect(developmentImageTestConfig({})).toBeNull();
    expect(developmentImageTestCacheInput("normal-key")).toBe("normal-key");
    expect(developmentImageTestScope()).toBeUndefined();
  });
  it.each([
    { ...env, NODE_ENV: "production" }, { ...env, NODE_ENV: "test" },
    { ...env, REPLIT_DEPLOYMENT: "true" }, { ...env, REPLIT_DEPLOYMENT: "1" },
    { ...env, IMAGE_DEVELOPMENT_ACTIVATION: "" },
    { ...env, DEVELOPMENT_IMAGE_TEST_USER_ID: "real-user" },
    { ...env, DEVELOPMENT_IMAGE_TEST_RUN_ID: "../escape" },
    { ...env, DEVELOPMENT_IMAGE_TEST_ENABLED: "" },
  ])("rejects unsafe/partial configuration", bad => {
    expect(() => developmentImageTestConfig(bad)).toThrow("configuration_rejected");
  });
  it("requires the exact reserved synthetic email for the configured authenticated ID", () => {
    expect(() => withDevelopmentImageTestSubject({ ...subject, email: "person@example.com" }, () => {}, { env })).toThrow("synthetic_identity_required");
    expect(withDevelopmentImageTestSubject({ id: "other-user", email: null }, () => developmentImageTestScope(), { env })).toBeUndefined();
  });
  it("isolates run cache identities, normal identities, and concurrent contexts", async () => {
    const normal = developmentImageTestCacheInput("recipe");
    const first = await scoped(async () => { await Promise.resolve(); return developmentImageTestCacheInput("recipe"); });
    const secondRun = "a0000000-0000-4000-8000-000000000002";
    const second = withDevelopmentImageTestSubject({ ...subject, email: `image-test+${secondRun}@example.invalid` }, () => developmentImageTestCacheInput("recipe"), {
      env: { ...env, DEVELOPMENT_IMAGE_TEST_RUN_ID: "a0000000-0000-4000-8000-000000000002" }, receipts: receipts(),
    });
    expect(new Set([normal, first, second]).size).toBe(3);
    expect(developmentImageTestScope()).toBeUndefined();
  });
  it("authorizes only the named snack and its isolated object prefix", () => scoped(() => {
    assertDevelopmentImageTestRecipe("Berry Coconut Chia Parfait", "snack");
    expect(() => assertDevelopmentImageTestRecipe("Different snack", "snack")).toThrow("recipe_not_authorized");
    expect(() => assertDevelopmentImageTestRecipe("Berry Coconut Chia Parfait", "meal")).toThrow();
    const prefix = developmentImageTestScope()!.storagePrefix;
    assertDevelopmentImageTestUrl(`/public-objects/bucket/${prefix}thumb.jpg`);
    for (const url of ["/public-objects/bucket/meal-images/old.jpg", "/images/fallback/meal.svg",
      `/public-objects/bucket/${prefix}../escape`, `/public-objects/bucket/${prefix}%2e%2e/escape`]) {
      expect(() => assertDevelopmentImageTestUrl(url)).toThrow("storage_scope_violation");
    }
  }));
  it("requires the same generated image for the single verification", () => scoped(() => {
    claimDevelopmentImageTestRequest("generation");
    expect(() => claimDevelopmentImageTestRequest("verification", "different")).toThrow("image_mismatch");
    rememberDevelopmentImageTestImage("generated-image");
    claimDevelopmentImageTestRequest("verification", "generated-image");
    expect(() => claimDevelopmentImageTestRequest("verification", "generated-image")).toThrow();
  }));
  it("uses an exclusive, fsynced pre-dispatch receipt, and fails closed on a replay", () => {
    withDevelopmentImageTestSubject(subject, () => claimDevelopmentImageTestRequest("generation"), { env });
    expect(openSync).toHaveBeenCalledWith(expect.stringContaining(`${runId}/generation.json`), "wx", 0o600);
    expect(fsyncSync).toHaveBeenCalledWith(42);
    jest.mocked(openSync).mockImplementationOnce(() => { throw new Error("EEXIST"); });
    expect(() => withDevelopmentImageTestSubject(subject, () => claimDevelopmentImageTestRequest("generation"), { env })).toThrow("receipt_unavailable");
  });
  it("limits the operation itself to one mocked generation, including a second operation", async () => {
    const store = receipts();
    const provider = jest.fn().mockResolvedValue({ data: [{ b64_json: "fixture" }],
      usage: { input_tokens: 1, input_tokens_details: { text_tokens: 1, image_tokens: 0 }, output_tokens: 1, total_tokens: 2 } });
    const make = () => new ImageOperation("/images/fallback/meal.svg",
      { ...APPROVED_IMAGE_MODEL, requiresDevelopmentActivation: false }, new ImageSpendingLedger(5));
    await scoped(async () => {
      const operation = make();
      await operation.generate("recipe", provider);
      await operation.generate("forbidden retry", provider);
      await make().generate("forbidden second request", provider);
    }, store);
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("wires every existing image route through authenticated server-owned scope", () => {
    const auth = readFileSync("server/middleware/requireAuth.ts", "utf8");
    expect(auth.match(/return withDevelopmentImageTestSubject\(\(req as AuthenticatedRequest\)\.authUser, \(\) => next\(\)\)/g)).toHaveLength(2);
    expect(auth).not.toContain("req.body.developmentImage");
  });
  it("dispatches only the one associated mocked vision request, including repeat verification", async () => {
    const original = process.env;
    process.env = { ...original, OPENAI_API_KEY: "synthetic-no-network" };
    mockVision.mockResolvedValue({ choices: [{ message: { content: "PASS" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
    try {
      await scoped(async () => {
        claimDevelopmentImageTestRequest("generation");
        rememberDevelopmentImageTestImage("data:image/png;base64,fixture");
        expect((await validateImageAgainstRecipe("data:image/png;base64,fixture", "Berry Coconut Chia Parfait", ["chia"])).verdict).toBe("PASS");
        expect((await validateImageAgainstRecipe("data:image/png;base64,fixture", "Berry Coconut Chia Parfait", ["chia"])).verdict).toBe("SKIPPED");
      });
      expect(mockVision).toHaveBeenCalledTimes(1);
      expect(mockVision.mock.calls[0][1]).toMatchObject({ maxRetries: 0 });
    } finally { process.env = original; }
  });
});
