import express from "express";
import request from "supertest";
import router from "../routes/mealFinder";
import { db } from "../db";
import { findUserByValidAuthToken } from "../services/authTokenService";
import { findMealsNearby } from "../services/mealFinderService";
import { createHumanFoodRequestScope } from "../services/humanFoodContext/requestScope";
import { getActiveNutritionContext } from "../services/nutritionContext/getActiveNutritionContext";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import { resolveGLP1GlobalContext } from "../services/glp1/resolveGLP1GlobalContext";

jest.mock("../db", () => ({ db: { select: jest.fn() } }));
jest.mock("../services/authTokenService", () => ({ findUserByValidAuthToken: jest.fn() }));
jest.mock("../lib/orgContext", () => ({ loadOrgContext: jest.fn().mockResolvedValue(null) }));
jest.mock("../services/effectiveAccess", () => ({
  computeEffectiveAccess: jest.fn().mockResolvedValue({
    planLookupKey: null, entitlements: [], sponsoredByBusinessId: null,
    sponsoredProCareAccess: false, pilotProCareAccess: false, pilotFullAccess: false,
  }),
}));
jest.mock("../services/mealFinderService", () => ({ findMealsNearby: jest.fn() }));
jest.mock("../services/nutritionContext/getActiveNutritionContext", () => ({ getActiveNutritionContext: jest.fn() }));
jest.mock("../services/protocolEnvelope", () => ({ loadUserProtocolEnvelope: jest.fn() }));
jest.mock("../services/nutritionStateService", () => ({ resolveDailyNutritionState: jest.fn().mockResolvedValue(null) }));
jest.mock("../services/restaurantMealGeneratorAI", () => ({ buildRemainingMacrosBlock: jest.fn(() => "remaining macros") }));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: jest.fn(), buildGLP1RecommendationBlock: jest.fn(() => ""),
}));
jest.mock("../services/humanFoodContext/requestScope", () => ({ createHumanFoodRequestScope: jest.fn() }));
jest.mock("../services/humanFoodContext/buildHumanFoodPromptBlock", () => ({ buildHumanFoodPromptBlock: jest.fn(() => "human food guidance") }));
jest.mock("../services/restaurantGlucoseAdvisory", () => ({
  applyRestaurantGlucoseProduceAdvisory: jest.fn((meals: unknown[]) => meals),
}));
jest.mock("../services/foodCompositionEvidence", () => ({ requiresVerifiedIngredientEvidence: jest.fn(() => false) }));
jest.mock("../services/safetyPinService", () => ({
  claimAdvisoryOverrideToken: jest.fn(), commitAdvisoryOverrideToken: jest.fn(), rollbackAdvisoryOverrideToken: jest.fn(),
}));

const actor = {
  id: "finder-fixture-a", email: "finder@example.invalid", username: "Finder",
  role: "client", professionalRole: null, authSecurityVersion: 7,
  plan: "free", entitlements: [], planLookupKey: null,
  dietaryRestrictions: ["vegetarian"], cuisinePreference: "Mexican",
};
const envelope = { userId: actor.id, dietaryIdentity: ["vegetarian"], allergies: [], avoidances: [] };
let session: any;
const originalMode = process.env.NODE_ENV;
const app = express();
app.use(express.json());
// Simulate only session deserialization. The real requireAuth middleware must
// resolve identity, verify its security version and enforce idle expiration.
app.use((req, _res, next) => { (req as any).session = session; next(); });
app.use("/api", router);
const search = () => request(app).post("/api/meal-finder")
  .send({ mealQuery: "vegetable tacos", zipCode: "60601", userId: "finder-fixture-b" });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NODE_ENV = "development";
  session = { userId: actor.id, authSecurityVersion: 7, lastActiveAt: Date.now(), destroy: jest.fn() };
  (db.select as jest.Mock).mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => [{ ...actor }] }) }),
  });
  (findUserByValidAuthToken as jest.Mock).mockResolvedValue(null);
  (findMealsNearby as jest.Mock).mockResolvedValue([
    { restaurantName: "Offline Fixture Cafe", mealName: "Vegetable tacos" },
  ]);
  (createHumanFoodRequestScope as jest.Mock).mockReturnValue({
    resolve: async () => ({ status: "resolved", actorUserId: actor.id, subjectUserId: actor.id }),
  });
  (getActiveNutritionContext as jest.Mock).mockResolvedValue({ combinedBlock: "protocol", builderBlock: "builder", diet: ["vegetarian"], medical: [] });
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue(envelope);
  (resolveGLP1GlobalContext as jest.Mock).mockResolvedValue({ isActive: false });
});
afterAll(() => { process.env.NODE_ENV = originalMode; });

test("a valid browser session reaches discovery with server-owned account and nutrition context", async () => {
  const response = await search();
  expect(response.status).toBe(200);
  expect(response.body.count).toBe(1);
  expect(createHumanFoodRequestScope).toHaveBeenCalledWith(expect.objectContaining({
    actorUserId: actor.id, subjectUserId: actor.id,
  }));
  expect(getActiveNutritionContext).toHaveBeenCalledWith(actor.id);
  expect(loadUserProtocolEnvelope).toHaveBeenCalledWith(actor.id);
  expect(findMealsNearby).toHaveBeenCalledWith(expect.objectContaining({
    user: expect.objectContaining({ id: actor.id }),
    protocolEnvelope: envelope, dietaryRestrictions: ["vegetarian"], cuisinePreference: "Mexican",
  }));
  expect(findUserByValidAuthToken).not.toHaveBeenCalled();
});

test("a different-account token cannot replace a valid cookie session", async () => {
  (findUserByValidAuthToken as jest.Mock).mockResolvedValue({ ...actor, id: "finder-fixture-b" });
  const response = await request(app).post("/api/meal-finder").set("x-auth-token", "stale-other-account")
    .send({ mealQuery: "vegetable tacos", zipCode: "60601" });
  expect(response.status).toBe(200);
  expect(findUserByValidAuthToken).not.toHaveBeenCalled();
  expect(findMealsNearby).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: actor.id }) }));
});

test.each([{}, { pendingMfaUserId: actor.id }])("anonymous or incomplete login is rejected before any discovery: %j", async (value) => {
  session = value;
  expect((await search()).status).toBe(401);
  expect(findMealsNearby).not.toHaveBeenCalled();
  expect(createHumanFoodRequestScope).not.toHaveBeenCalled();
});

test("expired browser sessions are destroyed and cannot search", async () => {
  session.lastActiveAt = Date.now() - 61 * 60 * 1000;
  const response = await search();
  expect(response.status).toBe(401);
  expect(response.body.code).toBe("SESSION_IDLE_TIMEOUT");
  expect(session.destroy).toHaveBeenCalled();
  expect(findMealsNearby).not.toHaveBeenCalled();
});

test("revoked security state cannot be bypassed by a token", async () => {
  session.authSecurityVersion = 6;
  const response = await request(app).post("/api/meal-finder").set("x-auth-token", "other-token")
    .send({ mealQuery: "tacos", zipCode: "60601" });
  expect(response.status).toBe(401);
  expect(response.body.code).toBe("AUTH_REAUTHENTICATION_REQUIRED");
  expect(findUserByValidAuthToken).not.toHaveBeenCalled();
  expect(findMealsNearby).not.toHaveBeenCalled();
});

test("a missing session account cannot fall through to another account's token", async () => {
  (db.select as jest.Mock).mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
  expect((await search()).status).toBe(401);
  expect(findMealsNearby).not.toHaveBeenCalled();
});

test("native tokens still use the standard authentication handoff", async () => {
  session = {};
  (findUserByValidAuthToken as jest.Mock).mockResolvedValue(actor);
  const response = await request(app).post("/api/meal-finder").set("x-auth-token", "fixture-native-token")
    .send({ mealQuery: "tacos", zipCode: "60601" });
  expect(response.status).toBe(200);
  expect(findUserByValidAuthToken).toHaveBeenCalledTimes(1);
});

test("invalid tokens cannot reach discovery", async () => {
  session = {};
  const response = await request(app).post("/api/meal-finder").set("x-auth-token", "expired-fixture-token")
    .send({ mealQuery: "tacos", zipCode: "60601" });
  expect(response.status).toBe(401);
  expect(findMealsNearby).not.toHaveBeenCalled();
});

test("unavailable clinical context fails closed after successful authentication", async () => {
  (resolveGLP1GlobalContext as jest.Mock).mockRejectedValue(new Error("offline fixture"));
  expect((await search()).status).toBe(503);
  expect(findMealsNearby).not.toHaveBeenCalled();
});

test("zero verified nearby options is distinct from an authentication failure", async () => {
  (findMealsNearby as jest.Mock).mockResolvedValue([]);
  const response = await search();
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ count: 0, message: expect.stringContaining("No verified nearby restaurants") });
});

test("the Development-only correction does not change the Production route's existing behavior", async () => {
  process.env.NODE_ENV = "production";
  session = {};
  expect((await search()).status).toBe(200);
});
