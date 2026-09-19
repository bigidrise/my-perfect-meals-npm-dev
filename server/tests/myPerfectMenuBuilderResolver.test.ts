import { builderContextFor, MY_PERFECT_MENU_BUILDERS } from "@shared/builderNamespaces";
import {
  resolveMyPerfectMenuBuilder,
  MyPerfectMenuBuilderError,
} from "../services/myPerfectMenu/builderResolver";

describe("My Perfect Menu builder authority", () => {
  test("maps every supported builder to its final board route", () => {
    expect(MY_PERFECT_MENU_BUILDERS.general_nutrition).toMatchObject({
      route: "/general-nutrition-builder/build",
      namespace: "generalNutrition",
      builderMode: "lifestyle",
    });
    expect(MY_PERFECT_MENU_BUILDERS.diabetic.route).toBe("/diabetic-menu-builder");
    expect(MY_PERFECT_MENU_BUILDERS.diabetic).toMatchObject({
      namespace: "diabetic",
      dietType: "diabetic",
      builderMode: "targeted",
    });
    expect(MY_PERFECT_MENU_BUILDERS.glp1.route).toBe("/glp1-meal-builder");
    expect(MY_PERFECT_MENU_BUILDERS.glp1).toMatchObject({
      namespace: "glp1",
      dietType: "glp1",
      builderMode: "targeted",
    });
    expect(MY_PERFECT_MENU_BUILDERS.anti_inflammatory.route).toBe("/anti-inflammatory-menu-builder");
    expect(MY_PERFECT_MENU_BUILDERS.anti_inflammatory).toMatchObject({
      namespace: "antiInflammatory",
      dietType: "anti-inflammatory",
      builderMode: "targeted",
    });
    expect(MY_PERFECT_MENU_BUILDERS.performance_competition).toMatchObject({
      route: "/performance-competition-builder",
      namespace: "performanceCompetition",
      dietType: "performance",
      builderMode: "hybrid",
    });
  });

  test("uses assignment unless an authorized explicit override is supplied", () => {
    const assigned = resolveMyPerfectMenuBuilder({}, { activeBoard: "diabetic" });
    expect(assigned.key).toBe("diabetic");
    const explicit = resolveMyPerfectMenuBuilder(
      { requestedBuilderKey: "glp1" },
      { activeBoard: "diabetic", builderSwitchUnlimited: true },
    );
    expect(explicit.key).toBe("glp1");
    expect(explicit.source).toBe("explicit");
    expect(explicit.route).not.toBe("/weekly-meal-board");
  });

  test("rejects invalid and unauthorized explicit values", () => {
    expect(() => resolveMyPerfectMenuBuilder(
      { requestedBuilderKey: "not-a-builder" },
      { activeBoard: "diabetic" },
    )).toThrow(MyPerfectMenuBuilderError);
    expect(() => resolveMyPerfectMenuBuilder(
      { requestedBuilderKey: "glp1" },
      { activeBoard: "diabetic" },
    )).toThrow(MyPerfectMenuBuilderError);
  });

  test("unassigned accounts safely default to general nutrition", () => {
    const result = resolveMyPerfectMenuBuilder({}, {});
    expect(result).toEqual(builderContextFor("general_nutrition", "default"));
  });

  test("authorizes the assigned Performance builder through the existing policy", () => {
    const result = resolveMyPerfectMenuBuilder({}, { activeBoard: "performance_competition" });
    expect(result.key).toBe("performance_competition");
    expect(result.namespace).toBe("performanceCompetition");
    expect(result.route).toBe("/performance-competition-builder");
    expect(result.displayName).toBe("Performance Nutrition Builder");
  });

  test("normalizes legacy beach_body assignments to Performance authority", () => {
    const result = resolveMyPerfectMenuBuilder({}, { activeBoard: "beach_body" });
    expect(result.key).toBe("performance_competition");
    expect(result.namespace).toBe("performanceCompetition");
  });

  test("exposes one canonical display name on every effective context", () => {
    expect(resolveMyPerfectMenuBuilder({}, {}).displayName).toBe("General Nutrition Builder");
    expect(resolveMyPerfectMenuBuilder({}, { activeBoard: "diabetic" }).displayName).toBe("Diabetic Builder");
  });
});