const mockCreate = jest.fn();
let mockProfile: any;
const chineseRequest = () => ({
  restaurantName: "Golden Lotus", craving: "ginger chicken", zipCode: "60601",
});
jest.mock("openai", () => ({ __esModule: true,
  default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } })) }));
jest.mock("../db", () => ({ db: {
  select: jest.fn(() => ({ from: () => ({ where: async () => [mockProfile] }) })),
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
import { bindRestaurantServing } from "../../shared/restaurantServing";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PlateItems from "../../client/src/components/away-from-home/PlateItems";
import RestaurantPortions from "../../client/src/components/away-from-home/RestaurantPortions";
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
  mockProfile = { id: "member", dietaryRestrictions: [], allergies: [] };
  (resolveRestaurantsByZip as jest.Mock).mockResolvedValue({ success: false, restaurants: [] });
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

const chineseMeal = () => ({ ...meal, name: "Steamed ginger chicken", cuisine: "Chinese",
  description: "Steamed chicken with ginger and vegetables", ingredients: ["chicken", "ginger", "broccoli"] });
const aiReply = (value = chineseMeal()) => mockCreate.mockResolvedValueOnce({
  choices: [{ message: { content: JSON.stringify({ meals: [value] }) } }],
});
const listing = (cuisine: string) => (resolveRestaurantsByZip as jest.Mock).mockResolvedValue({
  success: true, restaurants: [{ name: "Golden Lotus", cuisine, address: "Synthetic address" }],
});
test.each(["en", "zh"])("saved Chinese reaches the request pipeline independently of %s display language", async language => {
  mockProfile.cuisinePreference = "Chinese"; mockProfile.preferredLanguage = language;
  aiReply();
  const response = await guide(chineseRequest());
  expect(response.code).toBe(200);
  expect(response.body.cuisineContext).toMatchObject({ saved: "chinese", explicit: null, observed: null, displayLanguage: language });
  expect(response.body.restaurantInfo.cuisineRequestContext).toMatchObject({ saved: "chinese", owner: "member" });
  const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
  expect(prompt).toContain("Saved cuisine guidance: chinese");
  expect(prompt).not.toContain("This restaurant is classified as: American");
});
test("Chinese-language interface alone does not set Chinese cuisine", async () => {
  mockProfile.preferredLanguage = "zh";
  aiReply();
  const response = await guide(chineseRequest());
  expect(response.body.cuisineContext).toMatchObject({ saved: null, explicit: null, observed: null });
});
test("explicit Chinese is preserved and unverified meals stay disclosed", async () => {
  listing("Chinese"); aiReply();
  const response = await guide({ ...chineseRequest(), requestedCuisine: "Chinese" });
  expect(response.code).toBe(200);
  expect(response.body.recommendations[0].cuisine).toBe("Chinese");
  expect(response.body.cuisineContext).toMatchObject({ explicit: "chinese", observed: "chinese" });
  expect(response.body.compositionEvidence).toBe("unverified");
  expect(response.body.restaurantInfo.compositionNote).toContain("Unverified");
  expect(JSON.stringify(mockCreate.mock.calls[0][0])).not.toContain("order TODAY");
});
test.each(["American Casual", "Chinese-American"])("explicit Chinese is not overwritten by %s", async classification => {
  listing(classification);
  const response = await guide({ ...chineseRequest(), requestedCuisine: "Chinese" });
  expect(response.code).toBe(422);
  expect(response.body.code).toBe("RESTAURANT_CUISINE_MISMATCH");
  expect(response.body.error).toContain("You requested chinese");
  expect(mockCreate).not.toHaveBeenCalled();
});
test("saved Chinese permits an American restaurant with an explanation, without profile mutation", async () => {
  mockProfile.cuisinePreference = "Chinese";
  listing("American Casual");
  const response = await guide(chineseRequest());
  expect(response.code).toBe(200);
  expect(response.body.cuisineContext.note).toContain("rather than inventing");
  expect(mockProfile.cuisinePreference).toBe("Chinese");
});
test("explicit Mexican overrides saved Chinese for this action", async () => {
  mockProfile.cuisinePreference = "Chinese";
  listing("Mexican");
  aiReply({ ...chineseMeal(), cuisine: "Mexican", name: "Chicken taco" });
  const response = await guide({ ...chineseRequest(), requestedCuisine: "Mexican" });
  expect(response.code).toBe(200);
  expect(response.body.cuisineContext).toMatchObject({ saved: "chinese", explicit: "mexican", observed: "mexican" });
  expect(mockProfile.cuisinePreference).toBe("Chinese");
});
test.each([
  { name: "Hamburger", cuisine: "American" },
  { name: "Cheeseburger", cuisine: "Chinese" },
  { name: "Steamed ginger chicken", cuisine: undefined },
])("contradictory AI dish is removed rather than substituted: %j", async change => {
  aiReply({ ...chineseMeal(), ...change });
  const response = await guide({ ...chineseRequest(), requestedCuisine: "Chinese" });
  expect(response.code).toBe(422);
  expect(response.body.code).toBe("RESTAURANT_CUISINE_UNAVAILABLE");
  expect(response.body.error).toContain("No other cuisine was substituted");
});
test("fresh profile reads recognize cuisine changes in an active session", async () => {
  mockProfile.cuisinePreference = "American"; aiReply();
  const first = await guide(chineseRequest());
  mockProfile.cuisinePreference = "Chinese"; aiReply();
  const second = await guide(chineseRequest());
  expect(first.body.restaurantInfo.cuisineRequestContext.saved).toBe("american");
  expect(second.body.restaurantInfo.cuisineRequestContext.saved).toBe("chinese");
});
test("conflicting listing/menu cuisine evidence stops without generating", async () => {
  listing("Chinese");
  (restaurantEngine.resolve as jest.Mock).mockResolvedValue({
    status: "ok", identity: { cuisineType: "American", displayName: "Synthetic Diner" },
    items: [{ id: "burger" }], source: "internal_canonical",
  });
  const response = await guide({ ...chineseRequest(), requestedCuisine: "Chinese" });
  expect(response.code).toBe(422);
  expect(response.body.code).toBe("RESTAURANT_CUISINE_EVIDENCE_CONFLICT");
  expect(generateMenuItemRecommendations).not.toHaveBeenCalled();
});
test("explicit cuisine reaches verified-menu selection and wrong-cuisine output is rejected", async () => {
  (restaurantEngine.resolve as jest.Mock).mockResolvedValue({
    status: "ok", identity: { cuisineType: "Chinese", displayName: "Golden Lotus" },
    items: [{ id: "ginger-chicken" }], source: "internal_canonical",
  });
  (generateMenuItemRecommendations as jest.Mock).mockResolvedValue([{ ...canonicalMeal(), cuisine: "American" }]);
  const response = await guide({ ...chineseRequest(), requestedCuisine: "Chinese" });
  expect((generateMenuItemRecommendations as jest.Mock).mock.calls[0][0].cuisineContext.explicit).toBe("chinese");
  expect(response.code).toBe(422);
  expect(response.body.code).toBe("RESTAURANT_CUISINE_UNAVAILABLE");
});
test("explicit Chinese never bypasses an unknown-ingredients peanut allergy", async () => {
  envelope.allergies = ["peanut"];
  const response = await guide({ ...chineseRequest(), requestedCuisine: "Chinese" });
  expect(response.code).toBe(503);
  expect(response.body.error).toContain("verified menu ingredients");
  expect(mockCreate).not.toHaveBeenCalled();
});
test("Chinese intent never bypasses diabetes or anti-inflammatory protocol scans", async () => {
  envelope.hasDiabetes = true; envelope.diabeticGlucoseState = "high-risk";
  aiReply({ ...chineseMeal(), name: "Chicken with white potatoes", carbs: 70, starchyCarbs: 62,
    ingredients: ["chicken", "white potatoes"] });
  expect((await guide({ ...chineseRequest(), requestedCuisine: "Chinese" })).code).toBe(422);
  envelope.hasDiabetes = false; envelope.personalAntiInflammatorySupport = true;
  aiReply({ ...chineseMeal(), name: "Chicken with vegetables", ingredients: ["chicken", "canola oil"] });
  expect((await guide({ ...chineseRequest(), requestedCuisine: "Chinese" })).code).toBe(422);
});
test("the new cuisine behavior is inactive in Production", async () => {
  process.env.NODE_ENV = "production";
  listing("American Casual");
  (restaurantEngine.resolve as jest.Mock).mockResolvedValue({ status: "ok",
    identity: { displayName: "Synthetic Diner", cuisineType: "American" },
    items: [{ id: "menu-1" }], source: "internal_canonical" });
  (generateMenuItemRecommendations as jest.Mock).mockResolvedValue([canonicalMeal()]);
  const response = await guide({ ...chineseRequest(), requestedCuisine: "Chinese" });
  expect(response.code).toBe(200);
  expect(response.body.cuisineContext).toBeUndefined();
  expect(response.body.restaurantInfo.cuisineRequestContext).toBeUndefined();
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

test.each(["Lido buffet", "Burger restaurant", "Heathrow Burger Bar", "Sakura Sushi"])(
  "%s preserves same-call serving through Guide and Getaway with no extra calls", async name => {
    const withPortions = { ...meal, buffetItems: [{ food: "Beef", portion: "4 oz cooked" },
      { food: "Vegetable side", portion: "1 cup", note: "Steamed" }],
      portionGuidance: "This suggested plate includes the sides." };
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ meals: [withPortions] }) } }] });
    const response = await guide(selected(name));
    expect(response.code).toBe(200);
    expect(response.body.recommendations[0].serving).toEqual(bindRestaurantServing(withPortions, meal));
    const card = getawayRestaurantCards(response.body)[0];
    expect(card.buffetItems?.[0]).toEqual({ food: "Beef", portion: "4 oz cooked" });
    expect(card.recommendation.portionGuidance).toBe(withPortions.portionGuidance);
    expect(renderToStaticMarkup(React.createElement(PlateItems, { items: card.buffetItems! }))).toContain("4 oz cooked");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockCreate.mock.calls[0][0])).toContain("SAME single suggested plate");
  });

test("unsafe supplemental portion content cannot bypass protocol validation", async () => {
  envelope.dietaryIdentity = ["vegan"];
  const vegan = { ...meal, name: "Lentil plate", description: "Lentils and vegetables",
    ingredients: ["lentils", "vegetables"],
    buffetItems: [{ food: "Beef", portion: "4 oz cooked" }] };
  mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ meals: [vegan] }) } }] });
  const response = await guide(selected());
  expect(response.code).toBe(503);
  expect(getawayRestaurantCards(response.body)).toEqual([]);
});

test("realistic tacos generate food-by-food quantities through Guide, Getaway and the actual plate renderer", async () => {
  const tacos = { ...meal, name: "Grilled Chicken Tacos", description: "Chicken tacos with onion, cilantro and lime",
    ingredients: ["chicken", "corn tortillas", "onion", "cilantro", "lime"],
    buffetItems: [
      { food: "Grilled chicken", portion: "4 oz cooked" }, { food: "Corn tortillas", portion: "3 small" },
      { food: "Diced onions", portion: "2 tablespoons" }, { food: "Cilantro", portion: "1 tablespoon" },
      { food: "Lime", portion: "1 wedge" },
    ], portionGuidance: "These suggested quantities and nutrition describe all three tacos." };
  mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ meals: [tacos] }) } }] });
  const response = await guide(selected("Lido buffet"));
  expect(response.code).toBe(200);
  const card = getawayRestaurantCards(response.body)[0];
  expect(card.buffetItems).toEqual(tacos.buffetItems);
  const html = renderToStaticMarkup(React.createElement(PlateItems, { items: card.buffetItems! }));
  for (const item of tacos.buffetItems) expect(html).toContain(item.portion);
  expect(html).not.toContain("One restaurant serving");
  expect(card.meal.serving?.nutrition).toEqual({ calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat });
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("a realistic model omission is explicitly limited, not a successful Your plate or a repair call", async () => {
  const response = await guide(selected("Lido buffet")); // default model fixture has macros but no portions
  const result = response.body.recommendations[0];
  expect(result.serving.status).toBe("model_omitted");
  expect(result.buffetItems).toEqual([]);
  const html = renderToStaticMarkup(React.createElement(RestaurantPortions, { serving: result.serving, meal: result }));
  expect(html).toContain("limited recommendation");
  expect(html).not.toContain("Your plate");
  expect(html).not.toContain("One restaurant serving");
  expect(mockCreate).toHaveBeenCalledTimes(1);
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
  for (const name of [undefined, "", "   ", 42]) {
    expect(getawayRestaurantCards({ ...payload, recommendations: [{ ...meal, name }] })).toEqual([]);
  }
  for (const key of ["calories", "protein", "carbs", "fat"]) {
    for (const value of [undefined, NaN, Infinity, -1]) {
      expect(getawayRestaurantCards({ ...payload, recommendations: [{ ...meal, [key]: value }] })).toEqual([]);
    }
  }
});
