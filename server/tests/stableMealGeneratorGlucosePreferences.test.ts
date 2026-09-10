import {
  filterCatalogByGlucosePreferences,
} from "../services/stableGlucoseFilter";
import type { GlucoseStateResolution } from "../services/glucoseStateResolver";

const meals = [
  {
    name: "Chicken and Broccoli",
    mealType: "dinner" as const,
    ingredients: [
      { name: "chicken breast", grams: 150 },
      { name: "broccoli", grams: 100 },
    ],
    tags: [],
  },
  {
    name: "Chicken and Banana",
    mealType: "dinner" as const,
    ingredients: [
      { name: "chicken breast", grams: 150 },
      { name: "banana", grams: 100 },
    ],
    tags: [],
  },
];

function resolution(
  state: "LOW" | "IN_RANGE" | "HIGH",
  activePreferences: string[],
  configured = true,
): GlucoseStateResolution {
  return {
    state,
    activePreferences,
    preferencesConfigured: configured,
    valueMgdl: state === "LOW" ? 60 : state === "HIGH" ? 180 : 100,
    context: "PRE_MEAL",
    source: "LOG",
    ageMinutes: 1,
    criticalLow: false,
    criticalHigh: false,
  };
}

describe("stable generator canonical glucose allowlists", () => {
  test.each(["HIGH", "IN_RANGE"] as const)(
    "%s rejects unselected produce instead of falling back",
    (state) => {
      const filtered = filterCatalogByGlucosePreferences(
        meals,
        resolution(state, ["broccoli", "spinach", "blueberries"]),
      );
      expect(filtered.map((meal) => meal.name)).toEqual(["Chicken and Broccoli"]);
    },
  );

  test("configured empty remains empty and never restores legacy/default foods", () => {
    expect(
      filterCatalogByGlucosePreferences(meals, resolution("HIGH", [])),
    ).toEqual([]);
  });

  test("LOW rejects unselected produce when an allowed treatment is selected", () => {
    const filtered = filterCatalogByGlucosePreferences(
      meals,
      resolution("LOW", ["orange"]),
    );
    expect(filtered).toEqual([]);
  });

  test("LOW permits only the narrow treatment override when needed", () => {
    const filtered = filterCatalogByGlucosePreferences(
      meals,
      resolution("LOW", ["broccoli"]),
    );
    expect(filtered.map((meal) => meal.name)).toEqual([
      "Chicken and Broccoli",
      "Chicken and Banana",
    ]);
  });

  test("unconfigured settings are not treated as a strict allowlist", () => {
    expect(
      filterCatalogByGlucosePreferences(
        meals,
        resolution("HIGH", ["legacy preferred carb"], false),
      ),
    ).toEqual(meals);
  });
});