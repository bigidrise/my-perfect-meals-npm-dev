import {
  safeMacroValue,
  resolveAICarbsStrict,
} from "../services/guardrails/macroTruthContract";

describe("Macro Truth Contract integrity", () => {
  test.each([
    null, undefined, "", " ", true, false,
    [], {}, [12], Infinity, -Infinity, NaN,
    -1, "-1", "0x10", "invalid",
  ])("rejects invalid macro value %p", (value) => {
    expect(safeMacroValue(value)).toBeNull();
  });

  test.each([
    [0, 0],
    ["0", 0],
    [12.5, 12.5],
    ["12.5", 12.5],
    [0.125, 0.125],
    ["0.125", 0.125],
  ])("preserves valid macro value %p", (value, expected) => {
    expect(safeMacroValue(value)).toBe(expected);
  });

  it("preserves explicit zero carbohydrates", () => {
    expect(resolveAICarbsStrict({ carbs: 0 })).toBe(0);
  });

  it("accepts the explicit carbohydrate alias", () => {
    expect(resolveAICarbsStrict({ carbs_g: 12.5 })).toBe(12.5);
  });

  it("sums two valid carbohydrate components", () => {
    expect(resolveAICarbsStrict({
      starchyCarbs: 12.5, fibrousCarbs: 3.25,
    })).toBe(15.75);
  });

  it("accepts a genuine zero carbohydrate component", () => {
    expect(resolveAICarbsStrict({
      starchyCarbs: 0, fibrousCarbs: 4,
    })).toBe(4);
  });

  test.each([
    {},
    { starchyCarbs: 12 },
    { fibrousCarbs: 4 },
    { starchyCarbs: 12, fibrousCarbs: null },
    { starchyCarbs: null, fibrousCarbs: 4 },
    { starchyCarbs: 12, fibrousCarbs: "invalid" },
    { starchyCarbs: -1, fibrousCarbs: 4 },
    { starchyCarbs: true, fibrousCarbs: 4 },
    { starchyCarbs: Infinity, fibrousCarbs: 4 },
    { starchyCarbs: Number.MAX_VALUE, fibrousCarbs: Number.MAX_VALUE },
  ])("rejects incomplete or invalid carbohydrate evidence %p", (meal) => {
    expect(resolveAICarbsStrict(meal)).toBeNull();
  });
});
