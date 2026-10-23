import { APPROVED_IMAGE_MODEL as selectedModel, IMAGE_LIMITS, IMAGE_REQUEST_FORMAT, developmentImageActivationAllowed } from "../services/images/imageModelRegistry";
import { ImageOperation, ImageSpendingLedger } from "../services/images/imageReliability";
import { imageUsage } from "../services/images/imageUsage";
import { activeOpenAIModels, MODEL_MONITOR_PLAN, prepareDailyModelReview, permanentModelAlert } from "../services/images/modelRetirementMonitor";
import { IMAGE_CLIENT_TIMEOUT_MS, photographFromResponse, legacyPhotographUrl, placeholderResult } from "../../shared/imageResult";
import { readFileSync } from "node:fs";

const usage = { input_tokens: 470, input_tokens_details: { text_tokens: 470, image_tokens: 0 }, output_tokens: 196, total_tokens: 666 };
const photo = { _request_id: "req_fixture", usage, data: [{ b64_json: "fixture" }] };
const fallback = "/images/fallback/meal.svg";
// Explicit fixture policy only; real activation remains disabled.
const APPROVED_IMAGE_MODEL = { ...selectedModel, requiresDevelopmentActivation: false };

describe("Flare Development preparation — no provider or persistence IO", () => {
  afterEach(() => jest.useRealTimers());
  it("pins one dated model and exact format; client outlives overall deadline", () => {
    expect(APPROVED_IMAGE_MODEL.model).toBe("gpt-image-2.5-flare-2026-09-08");
    expect(APPROVED_IMAGE_MODEL.reservationUSD).toBe(.25);
    expect(IMAGE_REQUEST_FORMAT).toEqual({ output_format: "png", background: "opaque", moderation: "auto" });
    expect(IMAGE_CLIENT_TIMEOUT_MS).toBeGreaterThan(IMAGE_LIMITS.operationMs);
    expect(IMAGE_LIMITS.timeoutMs).toBe(150000);
    expect(IMAGE_LIMITS.verificationMs).toBe(20000);
  });
  it("requires separate explicit Development activation; Production and tests cannot enable it", async () => {
    const call = jest.fn();
    const op = new ImageOperation(fallback, selectedModel, new ImageSpendingLedger(5));
    expect(await op.generate("not approved for activation", call)).toBeNull();
    expect(op.result.reason).toBe("activation_pending");
    expect(call).not.toHaveBeenCalled();
    expect(developmentImageActivationAllowed({ NODE_ENV: "development" })).toBe(false);
    expect(developmentImageActivationAllowed({ NODE_ENV: "production", IMAGE_DEVELOPMENT_ACTIVATION: "approved-flare" })).toBe(false);
    expect(developmentImageActivationAllowed({ NODE_ENV: "development", IMAGE_DEVELOPMENT_ACTIVATION: "approved-flare" })).toBe(true);
  });
  it("records actual usage and safe request evidence without treating the reservation as cost", async () => {
    const op = new ImageOperation(fallback, APPROVED_IMAGE_MODEL, new ImageSpendingLedger(5));
    await op.generate("unchanged recipe", async () => photo);
    expect(op.result.evidence?.[0]).toMatchObject({ stage: "generation", requestId: "req_fixture", estimatedCostUSD: .00823 });
    expect(op.result.spending).toEqual({ reservedUSD: .25, estimatedKnownCostUSD: .00823, accountingUncertain: false });
  });
  it.each([undefined, {}, { ...usage, total_tokens: 1 }, { ...usage, output_tokens: -1 }])("unknown/inconsistent usage stops subsequent dispatch", async raw => {
    const op = new ImageOperation(fallback, APPROVED_IMAGE_MODEL, new ImageSpendingLedger(5));
    const call = jest.fn().mockResolvedValue({ ...photo, usage: raw });
    expect(await op.generate("recipe", call)).toBeNull();
    expect(await op.generate("no duplicate", call)).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
    expect(op.result.spending?.accountingUncertain).toBe(true);
  });
  it("stops on reported reservation overrun and retains the known estimate", async () => {
    const op = new ImageOperation(fallback, APPROVED_IMAGE_MODEL, new ImageSpendingLedger(5));
    await op.generate("recipe", async () => ({ ...photo, usage: { ...usage, output_tokens: 20000, total_tokens: 20470 } }));
    expect(op.stopped).toBe(true);
    expect(op.result.spending?.estimatedKnownCostUSD).toBeGreaterThan(.25);
  });
  it("bounds verification and ignores late results, retaining reservation and uncertainty", async () => {
    jest.useFakeTimers();
    const op = new ImageOperation(fallback, APPROVED_IMAGE_MODEL, new ImageSpendingLedger(5));
    await op.generate("recipe", async () => photo);
    let late!: (n: number) => void;
    const work = op.bounded("verification", () => new Promise<number>(r => { late = r; }), IMAGE_LIMITS.verificationMs);
    const rejected = expect(work).rejects.toThrow("deadline");
    await jest.advanceTimersByTimeAsync(20001); await rejected;
    const state = JSON.stringify(op.result); late(1); await Promise.resolve();
    expect(JSON.stringify(op.result)).toBe(state);
    expect(op.result.cancellation).toBe("requested_unconfirmed");
    expect(op.result.spending?.reservedUSD).toBe(.25);
  });
  it("reserves at most two reviewed fidelity attempts, without failover", async () => {
    const op = new ImageOperation(fallback, APPROVED_IMAGE_MODEL, new ImageSpendingLedger(5));
    const call = jest.fn().mockResolvedValue(photo);
    for (let i = 0; i < 5; i++) await op.generate("recipe", call);
    expect(call).toHaveBeenCalledTimes(2);
    expect(op.result.spending?.reservedUSD).toBe(.5);
    expect(op.result.model).toBe(APPROVED_IMAGE_MODEL.model);
  });
  it("validates verifier arithmetic", () => {
    expect(imageUsage("verification", { prompt_tokens: 629, completion_tokens: 1, total_tokens: 630 }).estimatedCostUSD).toBe(.0015825);
    expect(() => imageUsage("verification", { prompt_tokens: 1, completion_tokens: 1, total_tokens: 1 })).toThrow();
  });
  it("protects older clients from receiving placeholders as photograph URLs", () => {
    const result = placeholderResult(fallback, "unavailable");
    expect(legacyPhotographUrl(result)).toBeNull();
    expect(photographFromResponse({ imageUrl: fallback })).toBeNull();
    expect(photographFromResponse({ imageUrl: "/public-objects/old-photo.png" })).toBe("/public-objects/old-photo.png");
    expect(photographFromResponse({ imageUrl: "/public-objects/photo.png", imageResult: result })).toBeNull();
  });
  it("keeps unavailable verification unverified even with an apparently good URL", () => {
    const result = { ...placeholderResult("/public-objects/photo.png", "verification_unavailable"), generation: "succeeded" as const, verification: "unavailable" as const };
    expect(legacyPhotographUrl(result)).toBeNull();
  });
});

describe("prepared daily model monitoring — injected metadata only", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const client = (days: number) => ({ models: { retrieve: jest.fn(async (id: string) =>
    ({ id, shutdown_date: new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10) })) } });
  it.each([90, 60, 30, 14, 7, 1])("prepares the %i-day owner alert for every active model", async days => {
    const review = await prepareDailyModelReview(client(days), { now });
    expect(review.alerts).toHaveLength(activeOpenAIModels().length);
    expect(review.alerts.every(x => x.thresholdDays === days)).toBe(true);
    expect(review.enabled).toBe(false);
    expect(review.automaticSwitching).toBe(false);
  });
  it("is disabled, excludes Sunburst, includes configured active model IDs, and deduplicates", async () => {
    expect(MODEL_MONITOR_PLAN.enabled).toBe(false);
    expect(activeOpenAIModels()).not.toContain("gpt-image-2.5-sunburst-2026-09-08");
    const review = await prepareDailyModelReview(client(7), { now, configuredModels: ["configured-model"] });
    expect(review.reviews.some(x => x.model === "configured-model")).toBe(true);
    const again = await prepareDailyModelReview(client(7), { now, configuredModels: ["configured-model"], deliveredKeys: review.alerts.map(x => x.key) });
    expect(again.alerts).toEqual([]);
  });
  it("prepares immediate retirement and permanent-unavailable alerts without switching", async () => {
    expect((await prepareDailyModelReview(client(0), { now })).alerts.every(x => x.reason === "retired")).toBe(true);
    const error = { code: "model_not_found", message: "private provider detail" };
    const review = await prepareDailyModelReview({ models: { retrieve: async () => { throw error; } } }, { now });
    expect(review.alerts.every(x => x.reason === "model_unavailable")).toBe(true);
    expect(JSON.stringify(review)).not.toContain("private provider detail");
    expect(permanentModelAlert("fixture", { status: 429 })).toBeNull();
  });
  it("does not invent shutdown dates, suppress unknown metadata or claim catalog availability proves generation", async () => {
    const review = await prepareDailyModelReview({ models: { retrieve: async id => ({ id }) } }, { now });
    expect(review.alerts).toEqual([]);
    expect(review.reviews.every(x => x.state === "unknown")).toBe(true);
  });
  it("has no startup/scheduler/notifier or automatic-switch imports", () => {
    const source = readFileSync("server/services/images/modelRetirementMonitor.ts", "utf8");
    expect(source).not.toMatch(/setInterval|setTimeout|sendEmail|nodemailer|resend|models\.generate/);
  });
});
