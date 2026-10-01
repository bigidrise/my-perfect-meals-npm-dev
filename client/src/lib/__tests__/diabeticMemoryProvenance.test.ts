import {
  projectServerDiabeticMemory,
  type DiabeticGenerationSnapshot,
  type DiabeticMemoryStamp,
} from "../diabeticMemory";
import { savedMealToMeal } from "@/utils/savedMealToMeal";
import type { SavedMealRow } from "@/hooks/useSavedMeals";
import { normalizeCreateDishOptions, selectCreateDishById } from "../createDishIdentity";

const serverSnapshot: DiabeticGenerationSnapshot = {
  version: 2,
  generatedBglMgdl: 100,
  glucoseContext: "PRE_MEAL",
  protocolTypeLabel: "Glucose Balance Protocol",
  bglBucket: "in-range",
  recommendedBglRange: "70–140 mg/dL",
  generatedAt: "2026-07-19T11:00:00.000Z",
  source: "diabetic-builder",
  readingRecordedAt: "2026-07-19T10:55:00.000Z",
  readingSource: "LOG",
  glucoseState: "IN_RANGE",
  policyVersion: "diabetic-generation-v2",
};

const legacySnapshot: DiabeticMemoryStamp = {
  version: 1,
  generatedBglMgdl: 80,
  glucoseContext: "FASTED",
  protocolTypeLabel: "Glucose Balance Protocol",
  bglBucket: "in-range",
  recommendedBglRange: "70–140 mg/dL",
  generatedAt: "2026-07-18T08:00:00.000Z",
  source: "diabetic-builder",
};

describe("diabetic meal provenance projection", () => {
  it("uses the 100 mg/dL server snapshot, not the stale browser's 80 mg/dL", () => {
    const responseMeal = { diabeticMemory: serverSnapshot };
    expect(projectServerDiabeticMemory(responseMeal, true)).toEqual({
      diabeticMemory: serverSnapshot,
    });
    expect(projectServerDiabeticMemory(
      {},
      true,
    )).toEqual({});
  });

  it("does not mint or replace stored history when a later reading changes to 115", () => {
    const boardMeal = { diabeticMemory: legacySnapshot };
    const currentReading = 115;
    expect(currentReading).toBe(115);
    expect(projectServerDiabeticMemory(boardMeal, true).diabeticMemory).toBe(
      legacySnapshot,
    );
    expect(boardMeal.diabeticMemory.generatedBglMgdl).toBe(80);
    expect(boardMeal.diabeticMemory.generatedAt).toBe("2026-07-18T08:00:00.000Z");
  });

  it.each([
    ["Create with Chef", true],
    ["Diabetic AI premade", true],
    ["Snack Creator in diabetic mode", true],
  ])("preserves the original server snapshot for %s", (_path, isDiabetic) => {
    expect(
      projectServerDiabeticMemory({ diabeticMemory: serverSnapshot }, isDiabetic)
        .diabeticMemory,
    ).toBe(serverSnapshot);
  });

  it("preserves server v2 provenance even when the request diet was not diabetic", () => {
    expect(projectServerDiabeticMemory(
      { diabeticMemory: serverSnapshot },
      false,
    )).toEqual({ diabeticMemory: serverSnapshot });
    expect(projectServerDiabeticMemory({ diabeticMemory: legacySnapshot }, false)).toEqual({});
    expect(projectServerDiabeticMemory({}, false)).toEqual({});
  });

  it("keeps the server snapshot through Create Dish option normalization and selection", () => {
    const options = normalizeCreateDishOptions(
      [{ id: "server-meal", name: "Generated meal", diabeticMemory: serverSnapshot }],
      "request-1",
    );
    const selected = selectCreateDishById(options, "server-meal");

    expect(selected?.diabeticMemory).toBe(serverSnapshot);
  });

  it("Favorites preserves the saved JSON stamp and its original generation time", () => {
    const savedMeal: SavedMealRow = {
      id: "saved-meal-1",
      userId: "user-1",
      title: "Saved meal",
      sourceType: "diabetic-builder",
      signatureHash: "sig-1",
      mealData: {
        name: "Saved meal",
        diabeticMemory: serverSnapshot,
      },
      createdAt: "2026-07-19T11:05:00.000Z",
      savedFromDiabeticBuilder: true,
      generatedBglMgdl: 115,
      glucoseContext: "POST_MEAL_1H",
    };

    const favorite = savedMealToMeal(savedMeal);

    expect(favorite.diabeticMemory).toBe(serverSnapshot);
    expect(favorite.diabeticMemory?.generatedAt).toBe(serverSnapshot.generatedAt);
    expect(favorite.diabeticMemory?.generatedBglMgdl).toBe(100);
  });

  it("Favorites preserves a server v2 snapshot saved from Craving Creator", () => {
    const savedMeal: SavedMealRow = {
      id: "saved-craving-meal",
      userId: "user-1",
      title: "Saved craving meal",
      sourceType: "craving-creator",
      signatureHash: "sig-craving",
      mealData: { name: "Saved craving meal", diabeticMemory: serverSnapshot },
      createdAt: "2026-07-19T11:05:00.000Z",
      savedFromDiabeticBuilder: false,
    };

    expect(savedMealToMeal(savedMeal).diabeticMemory).toBe(serverSnapshot);
  });

  it("Favorites leaves a legacy v1 timestamp and context unchanged", () => {
    const savedMeal: SavedMealRow = {
      id: "saved-meal-legacy",
      userId: "user-1",
      title: "Legacy saved meal",
      sourceType: "diabetic-builder",
      signatureHash: "sig-legacy",
      mealData: {
        name: "Legacy saved meal",
        diabeticMemory: legacySnapshot,
      },
      createdAt: "2026-07-19T11:05:00.000Z",
      savedFromDiabeticBuilder: true,
    };
    const favorite = savedMealToMeal(savedMeal);

    expect(favorite.diabeticMemory).toBe(legacySnapshot);
    expect(favorite.diabeticMemory?.generatedBglMgdl).toBe(80);
    expect(favorite.diabeticMemory?.generatedAt).toBe(legacySnapshot.generatedAt);
  });

  it("does not infer a new glucose stamp for a general Favorite", () => {
    const savedMeal: SavedMealRow = {
      id: "saved-meal-2",
      userId: "user-1",
      title: "General saved meal",
      sourceType: "meal-builder",
      signatureHash: "sig-2",
      mealData: { name: "General saved meal" },
      createdAt: "2026-07-19T11:05:00.000Z",
      savedFromDiabeticBuilder: false,
      generatedBglMgdl: 115,
      glucoseContext: "POST_MEAL_1H",
    };
    expect(savedMealToMeal(savedMeal).diabeticMemory).toBeUndefined();
  });
});