import express from "express";
import request from "supertest";
import { createManualPediatricImageHandler, MANUAL_IMAGE_COOLDOWN_MS } from "../services/pediatric/manualImageRecovery";
import { buildPediatricImageContext } from "../../shared/pediatricMealImage";

const mealId = "10000000-0000-4000-8000-000000000001";
const childProfileId = "20000000-0000-4000-8000-000000000001";
const requestId = "30000000-0000-4000-8000-000000000001";
const photo = "/public-objects/test/parfait.png";
const fallback = "/images/fallback/meal.svg";
const meta = {
  status: "fallback" as const, sourceType: "meal" as const,
  attemptedWithPediatricContext: true as const, fallbackUrl: fallback,
  pediatricContext: buildPediatricImageContext({ stageKey: "preschool" }),
};

function fixture() {
  let now = 1000000;
  let saved: any = { id: mealId, imageUrl: null, recipe: {
    recipeName: "Fruit and Yogurt Parfait", ingredients: [{ name: "yogurt" }],
    instructions: ["Layer fruit and yogurt."], estimatedCarbsPerServing: "20",
    _imageGeneration: meta,
  } };
  const deps = {
    enabled: jest.fn(() => true),
    now: () => now,
    load: jest.fn(async () => JSON.parse(JSON.stringify(saved))),
    claim: jest.fn(async (_user, row, pending) => {
      if (JSON.stringify(saved.recipe) !== JSON.stringify(row.recipe)) return false;
      saved.recipe._imageGeneration = pending;
      return true;
    }),
    save: jest.fn(async (_user, _row, url, result) => {
      saved.imageUrl = url;
      saved.recipe._imageGeneration = result;
    }),
    generate: jest.fn(async () => ({ imageUrl: photo, imageGeneration: { ...meta, status: "generated" as const } })),
    persist: jest.fn(async () => photo),
  };
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.authUser = { id: "parent" }; next(); });
  app.post("/meals/:mealId/retry", createManualPediatricImageHandler(deps));
  const send = (id = requestId, child = childProfileId) =>
    request(app).post(`/meals/${mealId}/retry`).send({ requestId: id, childProfileId: child });
  return { deps, send, saved: () => saved, advance: () => { now += MANUAL_IMAGE_COOLDOWN_MS + 1; } };
}

describe("explicit saved pediatric image recovery (mocked providers/database)", () => {
  it("saves a photo and changes only image fields, reusing success on duplicate/new requests", async () => {
    const f = fixture();
    const recipeBefore = structuredClone(f.saved().recipe);
    const result = await f.send();
    expect(result.status).toBe(200);
    expect(result.body.imagePersisted).toBe(true);
    expect(f.saved().imageUrl).toBe(photo);
    const { _imageGeneration, ...food } = f.saved().recipe;
    const { _imageGeneration: _, ...before } = recipeBefore;
    expect(food).toEqual(before);
    expect(_imageGeneration.fallbackUrl).toBeUndefined();
    await f.send();
    await f.send("30000000-0000-4000-8000-000000000002");
    expect(f.deps.generate).toHaveBeenCalledTimes(1);
  });

  it("persists provider failure without looping; a later explicit click can recover", async () => {
    const f = fixture();
    f.deps.generate.mockResolvedValueOnce({
      imageUrl: fallback, imageGeneration: { ...meta, failureCode: "provider_error" },
    } as any);
    expect((await f.send()).body.imagePersisted).toBe(false);
    expect(f.deps.persist).not.toHaveBeenCalled();
    expect(f.saved().recipe._imageGeneration.failureCode).toBe("provider_error");
    expect((await f.send()).status).toBe(200); // idempotent failure receipt
    expect((await f.send("30000000-0000-4000-8000-000000000002")).status).toBe(429);
    expect(f.deps.generate).toHaveBeenCalledTimes(1);
    f.advance();
    expect((await f.send("30000000-0000-4000-8000-000000000002")).body.imagePersisted).toBe(true);
  });

  it("rejects concurrent requests after the atomic claim, without a duplicate provider call", async () => {
    const f = fixture();
    let finish!: (value: any) => void;
    f.deps.generate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const first = f.send().then(r => r);
    while (!finish) await new Promise(resolve => setTimeout(resolve, 2));
    expect((await f.send("30000000-0000-4000-8000-000000000002")).status).toBe(429);
    finish({ imageUrl: photo, imageGeneration: { ...meta, status: "generated" } });
    expect((await first).status).toBe(200);
    expect(f.deps.generate).toHaveBeenCalledTimes(1);
  });

  it("does no image work for a lost compare-and-set claim", async () => {
    const f = fixture();
    f.deps.claim.mockResolvedValue(false);
    expect((await f.send()).status).toBe(409);
    expect(f.deps.generate).not.toHaveBeenCalled();
  });

  it("does no image work for another parent's/child's meal or changed child profile", async () => {
    const f = fixture();
    f.deps.load.mockResolvedValue(null);
    expect((await f.send()).status).toBe(404);
    expect(f.deps.load).toHaveBeenCalledWith("parent", mealId, childProfileId);
    expect(f.deps.generate).not.toHaveBeenCalled();
  });

  it("stays unavailable outside Development", async () => {
    const f = fixture();
    f.deps.enabled.mockReturnValue(false);
    expect((await f.send()).status).toBe(404);
    expect(f.deps.load).not.toHaveBeenCalled();
  });

  it("does not label a photo as saved when storage fails", async () => {
    const f = fixture();
    f.deps.persist.mockResolvedValue(null as any);
    const result = await f.send();
    expect(result.body.imagePersisted).toBe(false);
    expect(f.saved().imageUrl).toBeNull();
    expect(f.saved().recipe._imageGeneration).toMatchObject({ status: "unavailable", failureCode: "storage_unavailable" });
  });

  it("retains a pending receipt if saving fails, so a lost result cannot create a second charge", async () => {
    const f = fixture();
    f.deps.save.mockRejectedValue(new Error("mock database unavailable"));
    expect((await f.send()).status).toBe(503);
    expect((await f.send()).status).toBe(429);
    expect(f.deps.generate).toHaveBeenCalledTimes(1);
  });

  it("requires operation identity and usable saved context before doing paid work", async () => {
    const f = fixture();
    expect((await f.send("invalid")).status).toBe(400);
    delete f.saved().recipe._imageGeneration;
    expect((await f.send()).status).toBe(409);
    expect(f.deps.generate).not.toHaveBeenCalled();
  });
});
