jest.mock("../db", () => ({ db: { select: jest.fn(), insert: jest.fn() } }));
jest.mock("@replit/object-storage", () => ({ Client: jest.fn() }));
jest.mock("sharp", () => ({
  __esModule: true, default: jest.fn(() => ({
    resize: () => ({ jpeg: () => ({ toBuffer: async () => Buffer.from("offline-variant") }) }),
  })),
}));
jest.mock("../services/mealImageAuthority", () => ({ validateMealImageAuthority: jest.fn() }));
jest.mock("../services/mealImageBucket", () => ({
  getActiveMealImageBucket: () => "fixture",
  assertActiveMealImageWriteBucket: (bucket: string) => bucket,
  publicMealImageUrl: (key: string) => `/public-objects/fixture/${key}`,
}));
import { db } from "../db";
import { Client } from "@replit/object-storage";
import { validateMealImageAuthority } from "../services/mealImageAuthority";
import { processImageForMeal } from "../services/mediaAssetService";

const upload = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  upload.mockResolvedValue({ ok: true });
  jest.mocked(Client).mockImplementation(() => ({ uploadFromBytes: upload }) as any);
  jest.mocked(db.insert).mockImplementation(() => ({
    values: (values: any) => ({ returning: async () => [{ id: "canonical-asset", ...values }] }),
  }) as any);
});
test("saving the generated thumbnail reuses its original asset and full-resolution variants", async () => {
  const original = {
    id: "original-asset", status: "ready", validationStatus: "unvalidated",
    thumbnailUrl: "/public-objects/fixture/meal-images/thumb.jpg",
    displayUrl: "/public-objects/fixture/meal-images/display.jpg",
    originalObjectKey: "meal-images/orig.png",
  };
  jest.mocked(db.select).mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => [original] }) }),
  } as any);
  expect(await processImageForMeal(original.thumbnailUrl, "Turkey stew")).toEqual(original);
  expect(db.insert).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
  expect(validateMealImageAuthority).not.toHaveBeenCalled();
});
test("different photos sharing identical base64 headers cannot overwrite one another", async () => {
  const prefix = Buffer.alloc(300, 1);
  const first = `data:image/png;base64,${Buffer.concat([prefix, Buffer.from("first")]).toString("base64")}`;
  const second = `data:image/png;base64,${Buffer.concat([prefix, Buffer.from("second")]).toString("base64")}`;
  expect(first.slice(0, 300)).toBe(second.slice(0, 300));
  const one = await processImageForMeal(first, "Turkey stew");
  const two = await processImageForMeal(second, "Turkey stew");
  expect(one.originalObjectKey).not.toBe(two.originalObjectKey);
  expect(one.thumbnailUrl).not.toBe(two.thumbnailUrl);
  expect(upload.mock.calls[0][0]).toContain("-orig-");
  expect(upload).toHaveBeenCalledTimes(6);
});
test("upload failure records failed processing and never supplies a durable URL", async () => {
  upload.mockResolvedValue({ ok: false, error: { message: "offline fixture failure" } });
  const result = await processImageForMeal("data:image/png;base64,Zml4dHVyZQ==", "Turkey stew");
  expect(result.status).toBe("failed");
  expect(result.thumbnailUrl).toBeNull();
  expect(result.displayUrl).toBeNull();
  expect(db.insert).toHaveBeenCalledTimes(1);
});
