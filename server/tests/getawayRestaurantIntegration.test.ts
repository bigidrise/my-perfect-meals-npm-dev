const mockCreate = jest.fn();
jest.mock("openai", () => ({ __esModule: true,
  default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } })) }));
jest.mock("../db", () => ({ db: {
  select: jest.fn(() => ({ from: () => ({ where: async () => [{ id: "member", dietaryRestrictions: [], allergies: [] }] }) })),
  insert: jest.fn(() => ({ values: async () => [] })), execute: jest.fn(),
} }));
jest.mock("../services/restaurantMealGenerator", () => ({ generateRestaurantMeals: jest.fn() }));
jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: jest.fn() }));
jest.mock("../services/restaurantResolver", () => ({ resolveRestaurantsByZip: jest.fn() }));
jest.mock("../services/away-from-home/ProviderRegistry", () => ({ restaurantEngine: { resolve: jest.fn() }, officialJsonProvider: {} }));
jest.mock("../services/away-from-home/generateMenuItemRecommendations", () => ({ generateMenuItemRecommendations: jest.fn() }));
jest.mock("../services/nutritionContext/getActiveNutritionContext", () => ({ getActiveNutritionContext: jest.fn() }));
jest.mock("../services/nutritionStateService", () => ({ resolveDailyNutritionState: jest.fn() }));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: jest.fn(), buildGLP1RecommendationBlock: jest.fn(() => "Canonical GLP-1 guidance"),
}));
jest.mock("../services/humanFoodContext/requestScope", () => ({ createHumanFoodRequestScope: jest.fn() }));
jest.mock("../services/humanFoodContext/buildHumanFoodPromptBlock", () => ({ buildHumanFoodPromptBlock: jest.fn(() => "Saved subject dietary preferences") }));
jest.mock("../services/restaurantGlucoseAdvisory", () => ({ applyRestaurantGlucoseProduceAdvisory: (meals: any[]) => meals }));
jest.mock("../services/coaching/activityEvents", () => ({ emitActivityEvent: jest.fn(async () => undefined) }));
import router from "../routes/restaurants";
import { getActiveNutritionContext } from "../services/nutritionContext/getActiveNutritionContext";
import { resolveGLP1GlobalContext } from "../services/glp1/resolveGLP1GlobalContext";
import { resolveDailyNutritionState } from "../services/nutritionStateService";
import { createHumanFoodRequestScope } from "../services/humanFoodContext/requestScope";
import { restaurantEngine } from "../services/away-from-home/ProviderRegistry";
import { generateMenuItemRecommendations } from "../services/away-from-home/generateMenuItemRecommendations";
import { resolveRestaurantsByZip } from "../services/restaurantResolver";
import { generateRestaurantMeals } from "../services/restaurantMealGenerator";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { buildGuestEnvelope } from "../services/protocolEnvelope";
import { resolveGetawayRestaurantContext } from "../services/getawayRestaurantContext";
import { getawayRestaurantCards } from "../../shared/getawayRestaurantMeals";
import { assembleLocationContext } from "../services/locationContext/engine";

const oldEnvironment = process.env.NODE_ENV;
const meal = { id: "real-1", name: "Burger with vegetable side", description: "Beef patty and vegetables",
  calories: 380, protein: 35, starchyCarbs: 10, fibrousCarbs: 8, carbs: 18, fat: 12,
  ingredients: ["beef", "lettuce", "tomato"], reason: "A cuisine-based meal idea",
  modifications: "Confirm current availability" };
const canonicalMeal = () => ({
  id: "menu-real-1", source: "restaurant_guide", restaurantName: "Burger restaurant",
  nutritionStatus: "official", meal: { name: meal.name, description: meal.description,
    calories: meal.calories, proteinGrams: meal.protein, carbohydrateGrams: meal.carbs,
    fatGrams: meal.fat, ingredients: [] }, recommendation: {}, protocol: {},
});
let envelope = buildGuestEnvelope();
beforeEach(() => {
  process.env.NODE_ENV = "development"; jest.clearAllMocks(); mockCreate.mockReset();
  envelope = { ...buildGuestEnvelope(), userId: "member" };
  (restaurantEngine.resolve as jest.Mock).mockResolvedValue({ status: "unavailable", reason: "no provider" });
  (getActiveNutritionContext as jest.Mock).mockImplementation(async () => ({
    envelope, combinedBlock: "Canonical nutrition and provider instructions", builderBlock: "Active builder",
    diet: [], medical: [],
  }));
  (resolveGLP1GlobalContext as jest.Mock).mockResolvedValue({ isActive: false });
  (resolveDailyNutritionState as jest.Mock).mockResolvedValue({
    consumedRemaining: { calories: 650, protein: 43, carbs: 37, fat: 19 },
    resolution: { status: "READY" },
  });
  (createHumanFoodRequestScope as jest.Mock).mockReturnValue({ resolve: async () => ({ status: "ready" }) });
  mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ meals: [meal] }) } }] });
});
afterAll(() => { process.env.NODE_ENV = oldEnvironment; });
afterEach(() => {
  expect(generateRestaurantMeals).not.toHaveBeenCalled();
  expect(generateMealImageUnified).not.toHaveBeenCalled();
});
async function guide(body: any) {
  const layer = (router as any).stack.find((entry: any) => entry.route?.path === "/guide");
  const response: any = { code: 200, status(n: number) { this.code = n; return this; },
    json(value: any) { this.body = value; return this; } };
  await layer.route.stack.at(-1).handle({ body, authUser: { id: "member" } }, response);
  return response;
}
const selected = (name = "Guy's Burger Joint") => ({
  restaurantName: name, craving: `Help me choose a meal at ${name}`,
  getawayVenue: { destinationName: "Carnival cruise" },
});

test("selected cruise burger concept reuses the actual Guide pipeline with one call and no false ZIP match", async () => {
  const response = await guide(selected());
  expect(response.code).toBe(200);
  expect(response.body.selectedVenue).toMatchObject({
    cuisine: "Burger", venueEvidence: "member-provided", destinationEvidence: "member-provided",
  });
  expect(response.body.compositionEvidence).toBe("unverified");
  expect(getawayRestaurantCards(response.body)).toHaveLength(1);
  expect(resolveRestaurantsByZip).not.toHaveBeenCalled();
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate.mock.calls[0][0].messages.map((m: any) => m.content).join(" ")).toContain("Protein: 43g");
});
test("Lido buffet uses buffet combinations, not the cuisine of an entire ship", async () => {
  const context = resolveGetawayRestaurantContext({ destinationName: "Carnival" }, "Lido buffet");
  expect(context.cuisine).toBe("Buffet-style dining");
  expect(context.venueEvidence).toBe("member-provided");
  const response = await guide(selected("Lido buffet"));
  expect(response.code).toBe(200);
  expect(mockCreate.mock.calls[0][0].messages.map((m: any) => m.content).join(" ")).toContain("buffet-style combinations");
  expect(mockCreate).toHaveBeenCalledTimes(1);
});
test.each(["Heathrow Airport", "An identified resort", "A theme park", "A stadium"])(
  "%s is destination context, not proof that the restaurant or current dishes exist", destinationName => {
    const context = resolveGetawayRestaurantContext({ destinationName }, "Sakura Sushi");
    expect(context.cuisineKnown).toBe(true);
    expect(context.destinationEvidence).toBe("member-provided");
    expect(context.venueEvidence).toBe("member-provided");
  });
test("Heathrow cannot silently acquire the DFW catalog identity", () => {
  expect(() => resolveGetawayRestaurantContext({ destinationName: "Heathrow", venueId: "dfw-airport" }, "Burger restaurant")).toThrow();
});
test("valid catalog destination/area selection stays intact", () => {
  const catalog = assembleLocationContext("carnival-cruise")!;
  expect(catalog).toBeTruthy();
  const result = resolveGetawayRestaurantContext({ destinationName: catalog.venue.name,
    venueId: catalog.venue.id, zoneId: catalog.venue.zones[0].id }, "Guy's Burger Joint");
  expect(result.destinationEvidence).toBe("catalog");
  expect(result.zoneId).toBe(catalog.venue.zones[0].id);
});
test("an unknown dining category is an explicit correction request, not fabricated cuisine or another AI call", async () => {
  const response = await guide(selected("Mystery Venue"));
  expect(response.code).toBe(422);
  expect(mockCreate).not.toHaveBeenCalled();
});
test.each(["unavailable", "ok"])("a guest fallback never replaces member clinical context: provider %s", async status => {
  envelope.userId = "guest";
  (restaurantEngine.resolve as jest.Mock).mockResolvedValue(status === "ok"
    ? { status: "ok", identity: { displayName: "Burger restaurant" }, items: [], source: "internal_canonical" }
    : { status: "unavailable", reason: "no provider" });
  expect((await guide(selected())).code).toBe(503);
  expect(mockCreate).not.toHaveBeenCalled();
  expect(generateMenuItemRecommendations).not.toHaveBeenCalled();
});
test.each(["allergy", "alpha-gal", "pregnancy"])("selected %s profile requires complete ingredient evidence", async kind => {
  if (kind === "allergy") envelope.allergies = ["peanuts"];
  if (kind === "alpha-gal") envelope.alphaGalContext = { active: true } as any;
  if (kind === "pregnancy") envelope.pregnancySupportContext = { active: true, stage: "trimester-2" } as any;
  const response = await guide(selected());
  expect(response.code).toBe(503);
  expect(mockCreate).not.toHaveBeenCalled();
});
test("provider-controlled structured dietary rules remain authoritative for Getaway", async () => {
  envelope.dietaryIdentity = ["vegan"];
  envelope.providerInterventions = [{ conditionKey: "custom", notes: "Vegan dietary rule" }] as any;
  const response = await guide(selected());
  expect(response.code).toBe(503);
  expect(getawayRestaurantCards(response.body)).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});
test("diabetes rules remain post-generation gates on a selected venue", async () => {
  envelope.hasDiabetes = true; envelope.diabeticGlucoseState = "high-risk";
  mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    meals: [{ ...meal, name: "Burger with fries", ingredients: ["beef", "white potatoes"], starchyCarbs: 60 }],
  }) } }] });
  expect((await guide(selected())).code).toBe(503);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});
test("GLP-1 canonical fat ceiling filters Getaway meals and unresolved targets stop before generation", async () => {
  (resolveGLP1GlobalContext as jest.Mock).mockResolvedValue({ isActive: true,
    activationSources: [], resolvedTargets: { maximumToleratedFatGrams: 8 } });
  expect((await guide(selected())).code).toBe(503);
  mockCreate.mockClear();
  (resolveGLP1GlobalContext as jest.Mock).mockResolvedValue({ isActive: true, resolvedTargets: null });
  expect((await guide(selected())).code).toBe(503);
  expect(mockCreate).not.toHaveBeenCalled();
});
test("a real menu provider is reused before cuisine fallback with no second generator", async () => {
  (restaurantEngine.resolve as jest.Mock).mockResolvedValue({ status: "ok",
    identity: { displayName: "Burger restaurant" }, items: [{ id: "menu-1" }], source: "internal_canonical" });
  (generateMenuItemRecommendations as jest.Mock).mockResolvedValue([canonicalMeal()]);
  const response = await guide(selected());
  expect(response.code).toBe(200);
  expect(response.body.menuSource).toBe("internal_canonical");
  expect(response.body.compositionEvidence).toBe("menu-item-only");
  expect(getawayRestaurantCards(response.body)).toHaveLength(1);
  expect(getawayRestaurantCards(response.body)[0].nutritionStatus).toBe("official");
  expect(generateMenuItemRecommendations).toHaveBeenCalledTimes(1);
  expect((generateMenuItemRecommendations as jest.Mock).mock.calls[0][0].protocolBlock).toContain("Protein: 43g");
  expect(mockCreate).not.toHaveBeenCalled();
});
test("verified-menu nested macros still pass the same diabetes and GLP-1 boundaries", async () => {
  (restaurantEngine.resolve as jest.Mock).mockResolvedValue({ status: "ok",
    identity: { displayName: "Burger restaurant" }, items: [{ id: "menu-1" }], source: "internal_canonical" });
  (generateMenuItemRecommendations as jest.Mock).mockResolvedValue([canonicalMeal()]);
  (resolveGLP1GlobalContext as jest.Mock).mockResolvedValue({ isActive: true, activationSources: [],
    resolvedTargets: { maximumToleratedFatGrams: 8 } });
  const highFat = await guide(selected());
  expect(highFat.body.recommendations).toEqual([]);
  (resolveGLP1GlobalContext as jest.Mock).mockResolvedValue({ isActive: false });
  envelope.hasDiabetes = true; envelope.diabeticGlucoseState = "high-risk";
  const unsafe = canonicalMeal();
  unsafe.meal.name = "Burger and fries"; unsafe.meal.carbohydrateGrams = 70;
  unsafe.meal.ingredients = ["white potatoes"] as any;
  (generateMenuItemRecommendations as jest.Mock).mockResolvedValue([unsafe]);
  const highStarch = await guide(selected());
  expect(highStarch.body.recommendations).toEqual([]);
  expect(mockCreate).not.toHaveBeenCalled();
});
test("general dining advice and unsupported nutrition do not acquire meal actions", () => {
  expect(getawayRestaurantCards({ bestChoices: [meal] })).toEqual([]);
  const payload = { recommendations: [meal], compositionEvidence: "unverified",
    selectedVenue: { destinationName: "Cruise" }, restaurantName: "Burger restaurant", cuisine: "Burger" };
  const result = getawayRestaurantCards(payload)[0];
  expect(result.nutritionStatus).toBe("estimated");
  expect(result.protocol).toEqual({});
  expect(getawayRestaurantCards({ ...payload, recommendations: [{ ...meal, fat: undefined }] })).toEqual([]);
});
