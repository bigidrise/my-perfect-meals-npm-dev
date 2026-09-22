import { resolveFlavorCompatibility } from "../services/humanFoodContext/flavorCompatibility";

describe("Human Food Context heat authority", () => {
  it.each(["unsure", "UNSURE", "unknown"])(
    "normalizes non-actionable saved heat sentinel %s to unavailable",
    (heatPreference) => {
      const flavor = resolveFlavorCompatibility({
        heatPreference,
        palateSpiceTolerance: "hot",
      });

      expect(flavor.heat).toEqual({
        value: null,
        source: "unavailable",
        available: false,
      });
    },
  );

  it.each(["none", "mild", "medium", "hot", "very-hot"])(
    "preserves actionable saved heat value %s as profile guidance",
    (heatPreference) => {
      const flavor = resolveFlavorCompatibility({ heatPreference });

      expect(flavor.heat).toEqual({
        value: heatPreference,
        source: "current_profile",
        available: true,
      });
    },
  );

  it("preserves a non-default legacy heat value only when no current answer exists", () => {
    expect(resolveFlavorCompatibility({
      heatPreference: null,
      palateSpiceTolerance: "hot",
    }).heat).toEqual({
      value: "hot",
      source: "legacy_profile",
      available: true,
    });
    expect(resolveFlavorCompatibility({
      heatPreference: null,
      palateSpiceTolerance: "mild",
    }).heat.available).toBe(false);
  });

  it.each(["mild", "hot"])(
    "preserves explicit request heat %s as request authority",
    (heat) => {
      const flavor = resolveFlavorCompatibility(
        { heatPreference: "unsure" },
        { heat },
      );

      expect(flavor.heat).toEqual({
        value: heat,
        source: "request",
        available: true,
      });
    },
  );
});