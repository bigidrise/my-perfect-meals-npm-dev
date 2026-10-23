import { ImageOperation, ImageSpendingLedger, classifyImageError } from "../services/images/imageReliability";
import { APPROVED_IMAGE_MODEL, IMAGE_LIMITS, type ImageModelPolicy } from "../services/images/imageModelRegistry";
import { inspectImageModelLifecycle } from "../services/images/imageModelLifecycle";
import { imageOutcome, isPlaceholderImage, isVerifiedPhotograph, placeholderResult } from "../../shared/imageResult";
import { readFileSync } from "node:fs";
import path from "node:path";

const fallback = "/images/fallback/meal.svg";
const approvedFixture: ImageModelPolicy = { ...APPROVED_IMAGE_MODEL, shutdownDate: null, reservationUSD: 0.10 };
const photo = { data: [{ b64_json: "synthetic-image-bytes" }] };

describe("image reliability foundation (fixtures only, no network)", () => {
  afterEach(() => jest.useRealTimers());

  it("keeps the approved OpenAI model; retirement blocks dispatch without switching", async () => {
    const call = jest.fn();
    const op = new ImageOperation(fallback, APPROVED_IMAGE_MODEL, new ImageSpendingLedger(1), 100, () => new Date("2026-10-23T00:00:00Z"));
    expect(await op.generate("recipe", call)).toBeNull();
    expect(op.result.reason).toBe("model_retired");
    expect(op.result.model).toBe("gpt-image-1");
    expect(call).not.toHaveBeenCalled();
  });

  it("keeps the meal engine on the shared finalized-ingredient pipeline", () => {
    const source = readFileSync(path.resolve("server/services/mealEngineService.ts"), "utf8");
    expect(source).toContain("generateMealImageResult(");
    expect(source).toContain("meal.name, meal.ingredients");
    expect(source).not.toMatch(/\bgenImage\s*\(/);
    expect(source).not.toMatch(/images\.generate/);
  });

  it("does not dispatch when the all-in cost reservation is unapproved", async () => {
    const call = jest.fn();
    const op = new ImageOperation(fallback, { ...approvedFixture, reservationUSD: null });
    await op.generate("recipe", call);
    expect(op.result.reason).toBe("cost_bound_unapproved");
    expect(call).not.toHaveBeenCalled();
  });

  it("preserves pending separately from display while the provider runs", async () => {
    let complete!: (value: typeof photo) => void;
    const op = new ImageOperation(fallback, approvedFixture, new ImageSpendingLedger(1));
    const work = op.generate("recipe", () => new Promise(resolve => { complete = resolve; }));
    await Promise.resolve();
    expect(op.result.generation).toBe("pending");
    expect(op.result.display).toBe("placeholder");
    expect(imageOutcome(op.result)).toBe("pending");
    complete(photo);
    expect(await work).toContain("data:image/png;base64,");
    expect(op.result.generation).toBe("succeeded");
    expect(op.result.verification).toBe("pending");
    expect(isVerifiedPhotograph(op.result)).toBe(false);
  });

  it.each([
    [{ status: 400, error: { message: "The model 'gpt-image-1' does not exist." } }, "model_unavailable"],
    [{ status: 403 }, "provider_access_denied"],
    [{ status: 429 }, "provider_rate_limited"],
    [{ status: 500 }, "provider_failed"],
  ])("classifies provider errors and never starts an implicit retry", async (error, reason) => {
    const call = jest.fn().mockRejectedValue(error);
    const op = new ImageOperation(fallback, approvedFixture, new ImageSpendingLedger(1));
    await op.generate("recipe", call);
    await op.generate("recipe", call);
    expect(op.result.reason).toBe(reason);
    expect(op.result.display).toBe("placeholder");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("keeps only sanitized request evidence, not provider messages or credentials", async () => {
    const op = new ImageOperation(fallback, approvedFixture, new ImageSpendingLedger(1));
    await op.generate("recipe", async () => { throw { message: "credential secret", request_id: "req_fixture123" }; });
    expect(op.result.requestId).toBe("req_fixture123");
    expect(JSON.stringify(op.result)).not.toContain("credential secret");
    expect(classifyImageError({ message: "model retired" })).toBe("model_unavailable");
  });

  it("caps fidelity attempts across one operation", async () => {
    const call = jest.fn().mockResolvedValue(photo);
    const op = new ImageOperation(fallback, approvedFixture, new ImageSpendingLedger(1));
    for (let i = 0; i < 8; i++) await op.generate("recipe", call);
    expect(call).toHaveBeenCalledTimes(IMAGE_LIMITS.maxAttempts);
    expect(op.result.reason).toBe("attempt_limit");
  });

  it("reserves before calling and rejects operations beyond the shared budget", async () => {
    const ledger = new ImageSpendingLedger(.1);
    const call = jest.fn().mockResolvedValue(photo);
    await new ImageOperation(fallback, approvedFixture, ledger).generate("first", call);
    const second = new ImageOperation(fallback, approvedFixture, ledger);
    await second.generate("second", call);
    expect(second.result.reason).toBe("budget_exhausted");
    expect(call).toHaveBeenCalledTimes(1);
    expect(ledger.reservedUSD).toBeCloseTo(.1);
  });

  it("enforces the per-operation ceiling even if the shared ledger has room", async () => {
    const op = new ImageOperation(fallback, { ...approvedFixture, reservationUSD: .3 }, new ImageSpendingLedger(10));
    const call = jest.fn().mockResolvedValue(photo);
    await op.generate("one", call);
    await op.generate("two", call);
    expect(op.result.reason).toBe("budget_exhausted");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it.each([NaN, Infinity, -1, 0])("rejects invalid reservations: %s", amount => {
    expect(new ImageSpendingLedger(1).reserve(amount)).toBe(false);
  });

  it("timeout requests abort, retains the reservation, and never claims cancellation", async () => {
    jest.useFakeTimers();
    let complete!: (value: typeof photo) => void;
    let signal!: AbortSignal;
    const ledger = new ImageSpendingLedger(1);
    const call = jest.fn((_prompt: string, s: AbortSignal) => {
      signal = s;
      return new Promise<typeof photo>(resolve => { complete = resolve; });
    });
    const op = new ImageOperation(fallback, approvedFixture, ledger, 10);
    const work = op.generate("recipe", call);
    await jest.advanceTimersByTimeAsync(11);
    expect(await work).toBeNull();
    expect(signal.aborted).toBe(true);
    expect(op.result.cancellation).toBe("requested_unconfirmed");
    expect(op.result.generation).toBe("pending");
    const timedOut = { ...op.result };
    complete(photo);
    await Promise.resolve();
    await op.generate("no duplicate", call);
    expect(call).toHaveBeenCalledTimes(1);
    expect(op.result).toEqual(timedOut);
    expect(ledger.reservedUSD).toBeCloseTo(.1);
  });

  it("does not refund on rejection without authoritative billing evidence", async () => {
    const ledger = new ImageSpendingLedger(.1);
    const op = new ImageOperation(fallback, approvedFixture, ledger);
    await op.generate("recipe", async () => { throw new Error("rejected"); });
    expect(ledger.reservedUSD).toBeCloseTo(.1);
  });

  it.each([{}, { data: [] }, { data: [{ url: fallback }] }, { data: [{ url: `https://example.invalid${fallback}` }] }])("does not accept empty or placeholder provider output", async response => {
    const op = new ImageOperation(fallback, approvedFixture, new ImageSpendingLedger(1));
    expect(await op.generate("recipe", async () => response)).toBeNull();
    expect(op.result.reason).toBe("invalid_provider_response");
  });

  it("never calls a placeholder a photograph even if a caller forges other states", () => {
    expect(isPlaceholderImage(`https://example.invalid${fallback}?v=1`)).toBe(true);
    const result = { ...placeholderResult(fallback, "test"), generation: "succeeded" as const, verification: "passed" as const, display: "photograph" as const };
    expect(isVerifiedPhotograph(result)).toBe(false);
    expect(imageOutcome(result)).toBe("placeholder");
  });

  it.each([
    [undefined, "unknown"], [null, "unknown"], ["2026-12-01", "scheduled"], ["2026-10-23", "retired"],
  ])("reads official metadata without activating monitoring: %s", async (date, state) => {
    const retrieve = jest.fn().mockResolvedValue({ id: "gpt-image-1", shutdown_date: date });
    const result = await inspectImageModelLifecycle({ models: { retrieve } }, new Date("2026-10-23T12:00:00Z"));
    expect(result.state).toBe(state);
    expect(retrieve).toHaveBeenCalledWith("gpt-image-1");
  });

  it("rejects malformed or wrong-model lifecycle evidence", async () => {
    await expect(inspectImageModelLifecycle({ models: { retrieve: async () => ({ id: "wrong" }) } })).rejects.toThrow("identity");
    await expect(inspectImageModelLifecycle({ models: { retrieve: async () => ({ id: "gpt-image-1", shutdown_date: "2026-02-30" }) } })).rejects.toThrow("shutdown_date");
  });
});
