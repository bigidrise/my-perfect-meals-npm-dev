jest.mock("../db", () => ({ db: { execute: jest.fn() } }));
jest.mock("../utils/getAuthUserId", () => ({ getAuthUserId: () => "fixture-parent" }));
jest.mock("../services/pediatric/authoritativeChildAccess", () => ({ loadOwnedActiveChildProfile: jest.fn() }));
jest.mock("../services/mealImageAuthority", () => ({ validateMealImageAuthority: jest.fn() }));
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "../db";
import { loadOwnedActiveChildProfile } from "../services/pediatric/authoritativeChildAccess";
import { validateMealImageAuthority } from "../services/mealImageAuthority";
import { recoverOriginalPediatricImage } from "../services/pediatric/readOnlyImageRecovery";
const photo = "/public-objects/fixture/meal-images/original.jpg";
function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}
const req = { body: { childProfileId: "child" }, params: { mealId: "saved" } } as any;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadOwnedActiveChildProfile).mockResolvedValue({ id: "child" } as any);
  jest.mocked(db.execute).mockResolvedValue({ rows: [{ id: "saved", image_url: photo, recipe_data: {} }] } as any);
  jest.mocked(validateMealImageAuthority).mockResolvedValue({
    status: "available", canonicalUrl: photo, bucketId: "fixture", objectName: "meal-images/original.jpg",
  });
});
test("the compatibility recovery route only SELECTs and returns the same owned image", async () => {
  const res = response();
  await recoverOriginalPediatricImage(req, res as any);
  expect(res.json).toHaveBeenCalledWith({ imageUrl: photo, imagePersisted: true });
  expect(db.execute).toHaveBeenCalledTimes(1);
  const statement = new PgDialect().sqlToQuery(jest.mocked(db.execute).mock.calls[0][0] as any);
  expect(statement.sql.trim()).toMatch(/^SELECT /);
  expect(statement.params).toEqual(["saved", "fixture-parent", "child"]);
});
test("storage denial preserves the recipe and reports unavailability", async () => {
  jest.mocked(validateMealImageAuthority).mockResolvedValue({ status: "unavailable", reason: "storage_unavailable" });
  const res = response();
  await recoverOriginalPediatricImage(req, res as any);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(db.execute).toHaveBeenCalledTimes(1);
});
test("another parent's child cannot be used for image recovery", async () => {
  jest.mocked(loadOwnedActiveChildProfile).mockResolvedValue(null);
  const res = response();
  await recoverOriginalPediatricImage(req, res as any);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(db.execute).not.toHaveBeenCalled();
  expect(validateMealImageAuthority).not.toHaveBeenCalled();
});
