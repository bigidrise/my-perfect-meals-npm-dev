/**
 * Regression coverage for the canonical medical-condition projection. The
 * medicalConditions column is selected independently from healthConditions;
 * only GLP-1 medication keys are promoted into the guidance-layer conditions.
 */
const selectedUser = {
  id: "protocol-user",
  dietaryRestrictions: [],
  allergies: [],
  healthConditions: ["hypertension"],
  medicalConditions: ["glp1", "diabetes-type2"],
  dislikedFoods: [],
  avoidedFoods: [],
  likedFoods: [],
  preferredSweeteners: [],
  avoidSweeteners: [],
  sweetenerPreferences: [],
  cuisinePreference: null,
  cuisineIntensity: null,
  specialtyConditions: [],
  specialtyCondition: null,
  activeHouseholdProfileId: null,
  selectedMealBuilder: null,
  oncologySupportContext: null,
  thyroidMedication: null,
  performanceOverlay: null,
  performanceControlMode: null,
  carbCycleState: null,
  performanceContext: null,
  weeklyTrainingSchedule: null,
  performanceProtocolConfig: null,
  timezone: "UTC",
  measurementSystem: "imperial",
};

jest.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [selectedUser],
        }),
      }),
    }),
  },
}));

jest.mock("../services/diabeticContextService", () => ({
  getDiabeticContext: jest.fn(async () => ({ latestGlucose: null })),
  getGlucoseBasedMealGuidance: jest.fn(() => null),
}));

import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";

describe("protocol envelope medicalConditions projection", () => {
  it("promotes GLP-1 medication keys but keeps non-GLP-1 routing flags out", async () => {
    const envelope = await loadUserProtocolEnvelope("protocol-user");

    expect(envelope).not.toBeNull();
    const guidanceText = JSON.stringify(envelope?.conditionGuidanceBlocks);
    expect(guidanceText).toMatch(/GLP-1 MEDICATION PROTOCOL/i);
    expect(guidanceText).not.toMatch(/diabetes-type2/);
  });
});