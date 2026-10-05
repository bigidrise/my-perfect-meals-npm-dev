const mockActiveContext = jest.fn();
const mockExecute = jest.fn();
const mockSelect = jest.fn();
const mockState = jest.fn();
jest.mock("../db", () => ({ db: { execute: (...args: any[]) => mockExecute(...args), select: (...args: any[]) => mockSelect(...args) } }));
jest.mock("../services/nutritionContext/getActiveNutritionContext", () => ({ getActiveNutritionContext: (...args: any[]) => mockActiveContext(...args) }));
jest.mock("../services/hydration/hydrationCenterService", () => ({ resolveHydrationCenterState: (...args: any[]) => mockState(...args) }));
jest.mock("../services/hydration/liquidNutritionProtocolService", () => ({ getCurrentLiquidNutritionProtocol: jest.fn(async () => null) }));
import { createHydrationHelp, getHydrationHubState } from "../services/hydration/hydrationHubService";

const generic = { id: "option-1", barrierCode: "taste", optionKey: "flavor-forward", title: "Make it more appealing", description: "Try a fresh, unsweetened flavor direction.", destinationType: "beverage_creator", createdAt: "2026-10-05T12:00:00Z" };
const originalNode = process.env.NODE_ENV;
beforeEach(() => {
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  delete process.env.VITE_IS_PRODUCTION_PROJECT;
  mockExecute.mockReset();
  mockState.mockReset();
  mockActiveContext.mockResolvedValue({ envelope: { oncologySupportContext: { enabled: true, source: "self", symptoms: ["mouth_sensitivity"], emphasis: { highProteinNutrientDensity: true } } } });
});
afterAll(() => { process.env.NODE_ENV = originalNode; });
test("actual help service resolves authoritative context and adapts output, not persisted settings", async () => {
  mockExecute
    .mockResolvedValueOnce({ rows: [{ consented: true }] })
    .mockResolvedValueOnce({ rows: [generic] }).mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ ...generic, id: "option-2" }] }).mockResolvedValueOnce({ rows: [] });
  const options = await createHydrationHelp({ userId: "test-subject", barriers: ["taste"], preferences: { flavor: "citrus" } });
  expect(mockActiveContext).toHaveBeenCalledWith("test-subject");
  expect(options[0].description).toMatch(/Skip citrus/);
  expect(generic.description).not.toMatch(/Skip citrus/);
  // Stored SQL contains the generic option, not a second symptom record.
  expect(JSON.stringify(mockExecute.mock.calls[1][0])).not.toContain("mouth_sensitivity");
  expect(JSON.stringify(mockExecute.mock.calls[1][0])).not.toContain("Current tolerance guidance");
});
test("read/reload reprojects saved generic options; OFF clears guidance and preserves clinical numeric state", async () => {
  const policy = { status: "ACTIVE", clinicianDirectiveId: "fixture-directive" };
  mockSelect.mockReturnValue({ from: () => ({ where: () => ({ orderBy: async () => [] }) }) });
  mockState.mockImplementation(async (input: any) => {
    input.onNutritionContextResolved(await mockActiveContext(input.subjectUserId));
    return { numericPolicy: policy, totalLoggedMl: 0, history: [] };
  });
  const seed = () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ consented: true, preferences: {} }] })
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [generic] }).mockResolvedValueOnce({ rows: [] });
  };
  const input = { subjectUserId: "test-subject", localDate: "2026-10-05", timezone: "America/Chicago", access: { authenticatedUserId: "test-subject", subjectUserId: "test-subject", mode: "self", authorizationStatus: "allowed" } as any };
  seed();
  const first = await getHydrationHubState(input);
  expect(first.interventions[0].description).toMatch(/Skip citrus/);
  expect(first.numericPolicy).toBe(policy);
  mockActiveContext.mockResolvedValue({ envelope: { oncologySupportContext: { enabled: false, source: "self", symptoms: ["mouth_sensitivity"], emphasis: { highProteinNutrientDensity: true } } } });
  seed();
  const off = await getHydrationHubState(input);
  expect(off.interventions[0].description).toBe(generic.description);
  expect(off.numericPolicy).toBe(policy);
});
test("missing consent still blocks before any personalized context or options", async () => {
  mockActiveContext.mockClear();
  mockExecute.mockResolvedValueOnce({ rows: [] });
  await expect(createHydrationHelp({ userId: "test-subject", barriers: ["taste"], preferences: {} })).rejects.toThrow("CONSENT_REQUIRED");
  expect(mockActiveContext).not.toHaveBeenCalled();
});
