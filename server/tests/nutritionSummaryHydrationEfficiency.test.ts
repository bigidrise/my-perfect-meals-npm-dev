// Fully offline fixtures; never initialize the shared database or providers.
jest.mock("../db", () => ({ db: {} }));
jest.mock("../services/nutritionContext/getActiveNutritionContext", () => ({
  getActiveNutritionContext: jest.fn(async () => ({ envelope: {}, builder: null })),
}));
jest.mock("../services/hydration/hydrationContextService", () => ({
  buildHydrationConsideredForYou: jest.fn(() => [{ code: "synthetic-display-item" }]),
}));
jest.mock("../services/hydration/hydrationClinicianDirectiveService", () => ({
  getHydrationClinicianDirectiveResolution: jest.fn(async () => ({ directive: null, conflict: false })),
}));
jest.mock("../services/hydration/liquidNutritionProtocolService", () => ({
  getCurrentLiquidNutritionProtocol: jest.fn(() => { throw new Error("Unexpected live protocol read"); }),
}));
import { resolveHydrationCenterState } from "../services/hydration/hydrationCenterService";
import { getActiveNutritionContext } from "../services/nutritionContext/getActiveNutritionContext";
import { getHydrationClinicianDirectiveResolution } from "../services/hydration/hydrationClinicianDirectiveService";

const input = {
  subjectUserId: "synthetic-self",
  localDate: "2026-11-11",
  timezone: "America/Chicago",
  now: new Date("2026-11-11T18:00:00Z"),
  preloadedRows: [],
  preloadedLiquidProtocol: null,
  access: {
    authenticatedUserId: "synthetic-self", subjectUserId: "synthetic-self",
    mode: "self", authorizationStatus: "allowed",
  },
} as const;

beforeEach(() => jest.clearAllMocks());

test("summary omission skips unused context without changing numeric policy, intake or protocols", async () => {
  const full = await resolveHydrationCenterState({ ...input, preloadedRows: [] });
  expect(getActiveNutritionContext).toHaveBeenCalledTimes(1);
  const summary = await resolveHydrationCenterState({
    ...input, preloadedRows: [], includeConsideredForYou: false,
  });
  expect(getActiveNutritionContext).toHaveBeenCalledTimes(1);
  expect(summary).toEqual({ ...full, consideredForYou: [] });
  expect(getHydrationClinicianDirectiveResolution).toHaveBeenCalledTimes(2);
});

test("other hydration consumers continue resolving full context by default", async () => {
  const state = await resolveHydrationCenterState({ ...input, preloadedRows: [] });
  expect(state.consideredForYou).toHaveLength(1);
  expect(getActiveNutritionContext).toHaveBeenCalledWith("synthetic-self");
});

test("explicit context observers still receive their result even in summary mode", async () => {
  const observer = jest.fn();
  await resolveHydrationCenterState({
    ...input, preloadedRows: [], includeConsideredForYou: false, onNutritionContextResolved: observer,
  });
  expect(getActiveNutritionContext).toHaveBeenCalledTimes(1);
  expect(observer).toHaveBeenCalledWith({ envelope: {}, builder: null });
});

test("omitting explanations does not suppress clinician-resolution failures", async () => {
  (getHydrationClinicianDirectiveResolution as jest.Mock).mockRejectedValueOnce(new Error("directive unavailable"));
  await expect(resolveHydrationCenterState({
    ...input, preloadedRows: [], includeConsideredForYou: false,
  })).rejects.toThrow("directive unavailable");
});
