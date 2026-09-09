import {
  classifyGlucoseState,
  resolveGlucoseState,
} from "../services/glucoseStateResolver";

const NOW = new Date("2025-01-01T12:00:00.000Z");
const configured = {
  glycemicPreferencesConfigured: true,
  preferredCarbs: ["Legacy oats"],
  lowRangeCarbs: ["Bananas"],
  midRangeCarbs: ["Berries"],
  highRangeCarbs: [],
  bloodGlucose: 105,
  updatedAt: new Date("2025-01-01T11:00:00.000Z"),
};

describe("glucose state resolver", () => {
  test("uses the context-specific in-range bounds and low threshold", () => {
    expect(classifyGlucoseState(70, "FASTED")).toBe("IN_RANGE");
    expect(classifyGlucoseState(120, "PRE_MEAL")).toBe("IN_RANGE");
    expect(classifyGlucoseState(121, "PRE_MEAL")).toBe("HIGH");
    expect(classifyGlucoseState(140, "RANDOM")).toBe("IN_RANGE");
    expect(classifyGlucoseState(141, "POST_MEAL_1H")).toBe("HIGH");
    expect(classifyGlucoseState(69, "POST_MEAL_2H")).toBe("LOW");
  });

  test("uses a fresh latest log over settings and marks critical values", () => {
    const result = resolveGlucoseState(
      { valueMgdl: 53, context: "RANDOM", recordedAt: new Date("2025-01-01T08:01:00.000Z") },
      configured,
      NOW,
    );
    expect(result).toMatchObject({
      state: "LOW", source: "LOG", criticalLow: true, criticalHigh: false,
      activePreferences: ["Bananas"],
    });
  });

  test("falls back from a stale log to fresh settings", () => {
    const result = resolveGlucoseState(
      { valueMgdl: 450, context: "RANDOM", recordedAt: new Date("2025-01-01T07:59:00.000Z") },
      configured,
      NOW,
    );
    expect(result).toMatchObject({
      state: "IN_RANGE", source: "SETTINGS", valueMgdl: 105, activePreferences: ["Berries"],
    });
  });

  test("reports stale without fresh fallback and preserves configured empty lists", () => {
    const stale = resolveGlucoseState(
      { valueMgdl: 200, context: "RANDOM", recordedAt: new Date("2025-01-01T07:59:00.000Z") },
      { ...configured, updatedAt: new Date("2025-01-01T07:59:00.000Z") },
      NOW,
    );
    expect(stale.state).toBe("STALE");

    const emptyHigh = resolveGlucoseState(
      { valueMgdl: 200, context: "RANDOM", recordedAt: new Date("2025-01-01T11:59:00.000Z") },
      configured,
      NOW,
    );
    expect(emptyHigh.activePreferences).toEqual([]);
  });
});