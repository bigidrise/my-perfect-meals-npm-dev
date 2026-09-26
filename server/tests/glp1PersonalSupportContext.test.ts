const mockQuery = jest.fn();
const mockTargets = jest.fn();
const mockDailyState = jest.fn();
const user = {
  id: "subject",
  selectedMealBuilder: "standard",
  medicalConditions: [] as string[],
  specialtyConditions: [] as string[],
  activeHouseholdProfileId: null as string | null,
  performanceModeEnabled: false,
};
jest.mock("../db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [user] }) }) }) },
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));
jest.mock("../services/glp1/glp1TargetLoader", () => ({
  loadGLP1ResolvedTargets: (...args: unknown[]) => mockTargets(...args),
}));
jest.mock("../services/nutritionStateService", () => ({
  resolveDailyNutritionState: (...args: unknown[]) => mockDailyState(...args),
}));
import { resolveGLP1GlobalContext } from "../services/glp1/resolveGLP1GlobalContext";

describe("current GLP-1 food authority in Development", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    user.selectedMealBuilder = "standard";
    user.medicalConditions = [];
    user.specialtyConditions = [];
    user.activeHouseholdProfileId = null;
    mockQuery.mockReset().mockResolvedValue({ rows: [] });
    mockTargets.mockReset().mockResolvedValue({
      resolvedMealCalories: 400, targetProteinGrams: 30,
      maximumToleratedFatGrams: 12, treatmentPhase: "maintenance", usedBaseline: false,
    });
    mockDailyState.mockReset().mockResolvedValue(null);
  });
  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  });

  it.each(["standard", "anti_inflammatory", "performance_competition"])(
    "does not activate GLP-1 for the %s Builder from saved personal overlays while frozen",
    async (builder) => {
      user.selectedMealBuilder = builder;
      user.medicalConditions = ["glp1"];
      const context = await resolveGLP1GlobalContext("subject", "2026-09-24");
      expect(context.isActive).toBe(false);
      expect(context.activationSources).toEqual([]);
      expect(mockTargets).not.toHaveBeenCalled();
    },
  );

  it("leaving the GLP-1 Builder removes its authority without deleting legacy history", async () => {
    user.selectedMealBuilder = "glp1";
    user.medicalConditions = ["glp1"];
    const builderContext = await resolveGLP1GlobalContext("subject", "2026-09-24");
    expect(builderContext.activationSources).toEqual(["selectedMealBuilder"]);
    user.selectedMealBuilder = "anti_inflammatory";
    const next = await resolveGLP1GlobalContext("subject", "2026-09-24");
    expect(next.isActive).toBe(false);
    expect(user.medicalConditions).toEqual(["glp1"]);
  });

  it("does not activate from a paused personal overlay", async () => {
    const context = await resolveGLP1GlobalContext("subject", "2026-09-24");
    expect(context.isActive).toBe(false);
  });

  it("does not duplicate target resolution on native GLP-1 Builder", async () => {
    user.selectedMealBuilder = "glp1";
    const context = await resolveGLP1GlobalContext("subject", "2026-09-24");
    expect(context.activationSources).toEqual(["selectedMealBuilder"]);
    expect(mockTargets).toHaveBeenCalledTimes(1);
  });

  it.each(["provider", "medication"])("keeps verified current %s authority under another Builder", async (source_kind) => {
    user.selectedMealBuilder = "anti_inflammatory";
    mockQuery.mockResolvedValue({ rows: [{ source_kind }] });
    const context = await resolveGLP1GlobalContext("subject", "2026-09-24");
    expect(context.isActive).toBe(true);
    expect(context.activationSources).toEqual([source_kind === "provider" ? "verifiedProvider" : "verifiedMedication"]);
    expect(mockTargets).toHaveBeenCalled();
  });

  it("keeps an inactive source from activating the meal resolver", async () => {
    const context = await resolveGLP1GlobalContext("subject", "2026-09-24");
    expect(context.isActive).toBe(false);
    expect(mockTargets).not.toHaveBeenCalled();
  });

  it("does not use the account owner's clinical source for an active household profile", async () => {
    user.activeHouseholdProfileId = "child-profile";
    mockQuery.mockResolvedValue({ rows: [{ source_kind: "provider" }] });
    const context = await resolveGLP1GlobalContext("account-owner", "2026-09-24");
    expect(context.isActive).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});