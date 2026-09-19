import {
  glp1HubReturnTarget,
  canSaveGlp1MealPreflight,
  shouldRequireGlp1MealPreflight,
} from "../../client/src/lib/glp1MenuFlow";

describe("GLP-1 My Perfect Menu workflow contract", () => {
  it("continues directly when today's canonical tolerance check-in exists", () => {
    expect(shouldRequireGlp1MealPreflight(
      { active: true, shouldEscalate: false },
      true,
      false,
    )).toBe(false);
  });

  it("requests inline meal-relevant tolerance when today's check-in is missing", () => {
    expect(shouldRequireGlp1MealPreflight(
      { active: true, shouldEscalate: false },
      false,
      false,
    )).toBe(true);
  });

  it("does not apply owner GLP-1 preflight to a household subject", () => {
    expect(shouldRequireGlp1MealPreflight(
      { active: true, shouldEscalate: false },
      false,
      true,
    )).toBe(false);
  });

  it("does not gate non-GLP-1 builders and leaves escalation authoritative", () => {
    expect(shouldRequireGlp1MealPreflight(
      { active: false, shouldEscalate: false },
      false,
      false,
    )).toBe(false);
    expect(shouldRequireGlp1MealPreflight(
      { active: true, shouldEscalate: true },
      false,
      false,
    )).toBe(false);
  });

  it("preserves the selected category and explicit GLP-1 Builder on Hub return", () => {
    expect(glp1HubReturnTarget("dinner")).toBe(
      "/foods-i-enjoy?builder=glp1&glp1SettingsChanged=1&category=dinner",
    );
  });

  it("cannot save defaults before the canonical check-in loads and hydrates", () => {
    expect(canSaveGlp1MealPreflight({
      hasLoaded: false,
      isLoading: false,
      hydratedKey: null,
      currentKey: "new",
    })).toBe(false);
    expect(canSaveGlp1MealPreflight({
      hasLoaded: true,
      isLoading: false,
      hydratedKey: null,
      currentKey: "checkin-1",
    })).toBe(false);
    expect(canSaveGlp1MealPreflight({
      hasLoaded: true,
      isLoading: false,
      hydratedKey: "checkin-1",
      currentKey: "checkin-1",
    })).toBe(true);
  });
});