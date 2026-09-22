import { resolveFlavorCompatibility } from "../services/humanFoodContext/flavorCompatibility";
import { normalizeGeneratedFoodIdentityEvidence } from "../services/generatedFoodIdentityEvidence";

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

  it.each(["unsure", "UNKNOWN"])(
    "normalizes non-actionable broad flavor sentinel %s to unavailable",
    (flavorPreference) => {
      expect(resolveFlavorCompatibility({ flavorPreference }).broadFlavor).toEqual({
        value: null,
        source: "unavailable",
        available: false,
      });
    },
  );

  it("keeps actionable saved broad flavor as profile guidance", () => {
    expect(resolveFlavorCompatibility({
      flavorPreference: "comfort",
    }).broadFlavor).toEqual({
      value: "comfort",
      source: "current_profile",
      available: true,
    });
  });

  it("keeps explicit broad flavor as request authority", () => {
    expect(resolveFlavorCompatibility(
      { flavorPreference: "comfort" },
      { broadFlavor: "savory" },
    ).broadFlavor).toEqual({
      value: "savory",
      source: "request",
      available: true,
    });
  });

  it("keeps known no-heat evidence distinct from missing heat evidence", () => {
    expect(normalizeGeneratedFoodIdentityEvidence({ heat: "none" })?.heat).toBe("none");
    expect(normalizeGeneratedFoodIdentityEvidence({ heat: null })?.heat).toBeUndefined();
  });
});