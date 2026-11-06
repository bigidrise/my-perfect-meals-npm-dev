const mockQuery = jest.fn();
jest.mock("../db", () => ({ pool: { query: (...args: unknown[]) => mockQuery(...args) } }));
import { readDevelopmentPersonalFoodSupports, readAntiInflammatorySupportPreference } from "../services/healthProtocols/developmentFoodSupports";
import { optionalAntiInflammatoryViolations } from "../services/healthProtocols/antiInflammatorySupportValidation";
import { ANTI_INFLAMMATORY_SUPPORT_OPT_IN, PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED } from "../../shared/personalFoodSupportFreeze";
import { validateAntiInflammatoryMeal } from "../services/guardrails/validators/antiInflammatoryValidator";
import { detectActiveBeverageConditions, validateBeverageOutput } from "../services/guardrails/beverageMedicalRules";
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";

const food = (ingredient: string) => ({ name: "Requested dish", ingredients: [{ name: ingredient }], instructions: ["Bake until cooked."] });
const clean = { name: "Chicken and broccoli", ingredients: [{ name: "chicken breast" }, { name: "broccoli" }, { name: "olive oil" }], instructions: ["Bake."] };
const oldEnv = process.env.NODE_ENV;
const oldDeployment = process.env.REPLIT_DEPLOYMENT;
beforeEach(() => {
  process.env.NODE_ENV = "development"; delete process.env.REPLIT_DEPLOYMENT;
  mockQuery.mockReset().mockResolvedValue({ rows: [] });
});
afterAll(() => {
  process.env.NODE_ENV = oldEnv;
  if (oldDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
  else process.env.REPLIT_DEPLOYMENT = oldDeployment;
});

test("only fresh explicit Anti-Inflammatory opt-ins become food authority; optional GLP-1 stays paused", async () => {
  expect(PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED).toBe(false);
  mockQuery.mockResolvedValue({ rows: [
    { protocol_key: "anti_inflammatory", evidence_ref: "personal_support" },
    { protocol_key: "glp1", evidence_ref: "personal_support" },
    { protocol_key: "anti_inflammatory", evidence_ref: "personal_support", explicit_opt_in: true },
  ] });
  expect([...await readDevelopmentPersonalFoodSupports("synthetic-subject")]).toEqual(["anti_inflammatory"]);
  expect(mockQuery.mock.calls[0][1]).toEqual(["synthetic-subject", ANTI_INFLAMMATORY_SUPPORT_OPT_IN, false]);
  expect(mockQuery.mock.calls[0][0]).toContain("status='active'");
  expect(mockQuery.mock.calls[0][0]).toContain("source_kind='user'");
});

test.each(["production", "test"])("no source reads or activation in %s", async mode => {
  process.env.NODE_ENV = mode;
  expect([...await readDevelopmentPersonalFoodSupports("synthetic")]).toEqual([]);
  expect(mockQuery).not.toHaveBeenCalled();
});
test("a published deployment stays off even with NODE_ENV=development", async () => {
  process.env.REPLIT_DEPLOYMENT = "1";
  expect([...await readDevelopmentPersonalFoodSupports("synthetic")]).toEqual([]);
  expect(mockQuery).not.toHaveBeenCalled();
});
test("read of a saved legacy preference does not migrate or activate it", async () => {
  mockQuery.mockResolvedValue({ rows: [{ legacy_preference: "true", enabled: false }] });
  expect(await readAntiInflammatorySupportPreference("synthetic")).toEqual({ enabled: false, legacyPreferenceSaved: true });
  expect(mockQuery.mock.calls.every(([sql]) => /^\s*SELECT/.test(sql))).toBe(true);
});
test("deactivation is read fresh without leaking the previous subject's state", async () => {
  mockQuery.mockResolvedValueOnce({ rows: [{ protocol_key: "anti_inflammatory", evidence_ref: "personal_support", explicit_opt_in: true }] })
    .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
  expect((await readDevelopmentPersonalFoodSupports("account-a")).has("anti_inflammatory")).toBe(true);
  expect((await readDevelopmentPersonalFoodSupports("account-a")).has("anti_inflammatory")).toBe(false);
  expect((await readDevelopmentPersonalFoodSupports("account-b")).has("anti_inflammatory")).toBe(false);
});
test("source failure is not silently treated as a successful off state", async () => {
  mockQuery.mockRejectedValue(new Error("storage unavailable"));
  await expect(readDevelopmentPersonalFoodSupports("synthetic")).rejects.toThrow("storage unavailable");
});
test.each(["general_nutrition", "diabetic", "glp1"])(
  "%s indicator response and generation authority stay aligned on and off", async () => {
    let enabled = true;
    mockQuery.mockImplementation(async (sql: string) => ({
      rows: sql.includes("FROM users") ? [{ legacy_preference: "true" }] : enabled
        ? [{ protocol_key: "anti_inflammatory", evidence_ref: "personal_support", explicit_opt_in: true }] : [],
    }));
    for (const state of [true, false]) {
      enabled = state;
      expect((await readAntiInflammatorySupportPreference("synthetic")).enabled).toBe(state);
      expect((await readDevelopmentPersonalFoodSupports("synthetic")).has("anti_inflammatory")).toBe(state);
    }
    expect(mockQuery.mock.calls.every(([sql]) => /^\s*SELECT/.test(sql))).toBe(true);
  },
);
test.each(["canola oil", "bacon", "white sugar", "white flour", "hydrogenated oil"])(
  "final ingredient checks reuse the established rule for %s", ingredient => {
    expect(optionalAntiInflammatoryViolations(food(ingredient), true))
      .toEqual(validateAntiInflammatoryMeal({ ...food(ingredient), name: "" }).violations);
    expect(optionalAntiInflammatoryViolations(food(ingredient), true).length).toBeGreaterThan(0);
    expect(optionalAntiInflammatoryViolations(food(ingredient), false)).toEqual([]);
  },
);
test("safe replacements pass; instructions are inspected; missing ingredients are not certified", () => {
  expect(optionalAntiInflammatoryViolations(clean, true)).toEqual([]);
  expect(optionalAntiInflammatoryViolations({ ...clean, instructions: ["Deep-fry in canola oil."] }, true).length).toBeGreaterThan(0);
  expect(optionalAntiInflammatoryViolations({ name: "Healthy menu item" }, true).length).toBeGreaterThan(0);
  expect(optionalAntiInflammatoryViolations({ name: "Healthy menu item" }, false)).toEqual([]);
});
test.each(["general_nutrition", "diabetic", "glp1"] as const)(
  "%s beverage keeps its primary program and adds the optional ingredient rules", builder => {
    const envelope = { medicalHardLimits: [], medicalOptimization: [], personalAntiInflammatorySupport: true } as unknown as UserProtocolEnvelope;
    const active = detectActiveBeverageConditions(envelope, builder);
    expect(active).toContain("anti-inflammatory");
    if (builder !== "general_nutrition") expect(active).toContain(builder);
    expect(builder).not.toBe("anti_inflammatory");
    expect(detectActiveBeverageConditions({ ...envelope, personalAntiInflammatorySupport: false }, builder))
      .not.toContain("anti-inflammatory");
  },
);
test("standalone beverage activation remains available independently", () => {
  const envelope = { medicalHardLimits: [], medicalOptimization: [] } as unknown as UserProtocolEnvelope;
  expect(detectActiveBeverageConditions(envelope, "anti_inflammatory")).toEqual(["anti-inflammatory"]);
});
