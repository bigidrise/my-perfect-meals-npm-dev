import {
  athleticHydrationCoachingInputSchema,
  findProhibitedTrainerHydrationContent,
} from "@shared/hydration/professional";
import { combineConsistencyComponents } from "../services/complianceEngine";

const safeGuidance = athleticHydrationCoachingInputSchema.parse({
  trainingContext: "endurance",
  emphasis: ["before_training", "during_training", "recovery"],
  reminderStrategy: "Use normal training transitions as reminder cues.",
  beverageStrategy: "Choose a familiar beverage that the athlete tolerates well.",
  athleteCreatorIntent: "Create a cold citrus recovery beverage idea.",
  notes: "Review after the next training block.",
  startsOn: "2026-08-29",
  reviewOn: "2026-09-12",
});

describe("professional Hydration role boundaries", () => {
  it("accepts bounded nonclinical Athletic Hydration coaching", () => {
    expect(findProhibitedTrainerHydrationContent(safeGuidance)).toBeNull();
  });

  it.each([
    ["Use a water cut before weigh-in", "WATER_MANIPULATION"],
    ["Use sauna sessions to make weight", "WEIGHT_CUT_METHOD"],
    ["Prescribe sodium at 500 mg every hour", "ELECTROLYTE_PRESCRIPTION"],
    ["Drink 20 oz per hour", "FLUID_DOSING"],
    ["Practice deliberate dehydration", "DEHYDRATION_STRATEGY"],
  ])("rejects trainer coaching text: %s", (notes, expectedCode) => {
    expect(findProhibitedTrainerHydrationContent({ ...safeGuidance, notes })).toBe(expectedCode);
  });
});

describe("Consistency Score V1 composition", () => {
  it("does not invent a Hydration component for TRACK_ONLY users", () => {
    expect(combineConsistencyComponents({
      mealConsistency: 80,
      macroAdherence: 60,
      hydrationAdherence: null,
    })).toBe(70);
  });

  it("includes Hydration only when a measurable adherence value exists", () => {
    expect(combineConsistencyComponents({
      mealConsistency: 80,
      macroAdherence: 60,
      hydrationAdherence: 100,
    })).toBe(76);
  });
});