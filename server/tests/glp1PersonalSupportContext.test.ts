const mockPersonalSupports = jest.fn();
const mockTargets = jest.fn();
const mockDailyState = jest.fn();
const user = {
  selectedMealBuilder: "standard",
  medicalConditions: [] as string[],
  specialtyConditions: [] as string[],
  activeHouseholdProfileId: null as string | null,
  performanceModeEnabled: false,
};
jest.mock("../db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [user] }) }) }) },
}));
jest.mock("../services/healthProtocols/developmentFoodSupports", () => ({
  readDevelopmentPersonalFoodSupports: (...args: unknown[]) => mockPersonalSupports(...args),
}));
jest.mock("../services/glp1/glp1TargetLoader", () => ({
  loadGLP1ResolvedTargets: (...args: unknown[]) => mockTargets(...args),
}));
jest.mock("../services/nutritionStateService", () => ({
  resolveDailyNutritionState: (...args: unknown[]) => mockDailyState(...args),
}));
import { resolveGLP1GlobalContext, buildGLP1RecommendationBlock } from "../services/glp1/resolveGLP1GlobalContext";

describe("personal GLP-1 food activation in Development", () => {
  beforeEach(() => {
    user.selectedMealBuilder = "standard";
    user.medicalConditions = [];
    user.specialtyConditions = [];
    user.activeHouseholdProfileId = null;
    mockPersonalSupports.mockReset().mockResolvedValue(new Set());
    mockTargets.mockReset().mockResolvedValue({
      resolvedMealCalories: 400, targetProteinGrams: 30,
      maximumToleratedFatGrams: 12, treatmentPhase: "maintenance", usedBaseline: false,
    });
    mockDailyState.mockReset().mockResolvedValue(null);
  });

  it.each(["standard", "anti_inflammatory", "performance_competition"])(
    "does not activate GLP-1 for the %s Builder from saved personal overlays while frozen",
    async (builder) => {
      const previousEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      user.selectedMealBuilder = builder;
      // Use the actual frozen reader rather than the mock used to exercise dormant overlay logic below.
      mockPersonalSupports.mockImplementation(() =>
        jest.requireActual("../services/healthProtocols/developmentFoodSupports")
          .readDevelopmentPersonalFoodSupports("subject"));
      try {
        const context = await resolveGLP1GlobalContext("subject", "2026-09-24");
        expect(context.isActive).toBe(false);
        expect(context.activationSources).toEqual([]);
        expect(mockTargets).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = previousEnv;
      }
    },
  );

  it("keeps Builder and medical GLP-1 authority active with personal overlays frozen", async () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    mockPersonalSupports.mockImplementation(() =>
      jest.requireActual("../services/healthProtocols/developmentFoodSupports")
        .readDevelopmentPersonalFoodSupports("subject"));
    try {
      user.selectedMealBuilder = "glp1";
      const builderContext = await resolveGLP1GlobalContext("subject", "2026-09-24");
      expect(builderContext.activationSources).toEqual(["selectedMealBuilder"]);
      expect(builderContext.resolvedTargets).not.toBeNull();
      user.selectedMealBuilder = "standard";
      user.medicalConditions = ["glp1"];
      const clinicalContext = await resolveGLP1GlobalContext("subject", "2026-09-24");
      expect(clinicalContext.activationSources).toEqual(["medicalConditions"]);
      expect(clinicalContext.resolvedTargets).not.toBeNull();
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  });

  it("uses only an active subject-owned personal source without asserting medication or switching builder", async () => {
    mockPersonalSupports.mockResolvedValue(new Set(["glp1"]));
    const context = await resolveGLP1GlobalContext("subject", "2026-09-24");
    expect(context.isActive).toBe(true);
    expect(context.activationSources).toEqual(["personalNutritionSupport"]);
    expect(context.resolvedTargets).not.toBeNull();
    const recommendation = buildGLP1RecommendationBlock(context);
    expect(recommendation).toMatch(/GLP-1 NUTRITION GUIDANCE/);
    expect(recommendation).not.toMatch(/MEDICATION PROTOCOL|GLP-1 patient|medications reduce appetite/);
    expect(mockPersonalSupports).toHaveBeenCalledWith("subject");
    expect(mockTargets).toHaveBeenCalledTimes(1);
    expect(user.selectedMealBuilder).toBe("standard");
    expect(user.medicalConditions).toEqual([]);
  });

  it("does not duplicate target resolution on native GLP-1 Builder", async () => {
    user.selectedMealBuilder = "glp1";
    mockPersonalSupports.mockResolvedValue(new Set(["glp1"]));
    const context = await resolveGLP1GlobalContext("subject", "2026-09-24");
    expect(context.activationSources).toEqual(["selectedMealBuilder", "personalNutritionSupport"]);
    expect(mockTargets).toHaveBeenCalledTimes(1);
  });

  it("turning the personal source off does not remove the legacy clinical source", async () => {
    user.medicalConditions = ["glp1"];
    const context = await resolveGLP1GlobalContext("subject", "2026-09-24");
    expect(context.isActive).toBe(true);
    expect(context.activationSources).toEqual(["medicalConditions"]);
  });

  it("keeps an inactive personal source from activating the meal resolver", async () => {
    const context = await resolveGLP1GlobalContext("subject", "2026-09-24");
    expect(context.isActive).toBe(false);
    expect(mockTargets).not.toHaveBeenCalled();
  });

  it("does not use the account owner's personal choice for an active household profile", async () => {
    user.activeHouseholdProfileId = "child-profile";
    mockPersonalSupports.mockResolvedValue(new Set(["glp1"]));
    const context = await resolveGLP1GlobalContext("account-owner", "2026-09-24");
    expect(context.isActive).toBe(false);
    expect(mockPersonalSupports).not.toHaveBeenCalled();
  });
});