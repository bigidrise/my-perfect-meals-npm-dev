jest.mock("../db", () => ({ db: { execute: jest.fn(), select: jest.fn() } }));
jest.mock("../services/restaurantMealGenerator", () => ({ generateRestaurantMeals: jest.fn() }));
jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: jest.fn() }));
jest.mock("../services/restaurantResolver", () => ({ resolveRestaurantsByZip: jest.fn() }));
const mockCreate = jest.fn();
jest.mock("openai", () => ({ __esModule: true,
  default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } })) }));
import { generateRestaurantMealsAI } from "../services/restaurantMealGeneratorAI";
import { generateRestaurantMeals } from "../services/restaurantMealGenerator";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { resolveRestaurantsByZip } from "../services/restaurantResolver";
import { findMealsNearby } from "../services/mealFinderService";
import { buildGuestEnvelope } from "../services/protocolEnvelope";

const originalEnvironment = process.env.NODE_ENV;
const memberEnvelope = () => ({ ...buildGuestEnvelope(), userId: "member" });
const meal = { name: "Basil chicken", description: "Chicken with steamed vegetables",
  ingredients: ["chicken", "broccoli", "basil"], calories: 350, protein: 35,
  starchyCarbs: 10, fibrousCarbs: 8, fat: 12, reason: "A cuisine-based option",
  modifications: "Ask about preparation and availability" };
beforeEach(() => { process.env.NODE_ENV = "development"; jest.clearAllMocks(); mockCreate.mockReset(); });
afterAll(() => { process.env.NODE_ENV = originalEnvironment; });
const reply = (meals: any[]) => mockCreate.mockResolvedValueOnce({
  choices: [{ message: { content: JSON.stringify({ meals }) } }],
});
const generate = (extra: any = {}) => generateRestaurantMealsAI({
  restaurantName: "Basil Kitchen", cuisine: "Thai", user: { id: "member" } as any,
  protocolEnvelope: memberEnvelope(), skipImages: true, ...extra,
});
afterEach(() => { expect(generateRestaurantMeals).not.toHaveBeenCalled(); });

test("cuisine-based generation succeeds without a current menu and preserves supplied estimates", async () => {
  reply([meal]);
  expect(await generate()).toEqual([expect.objectContaining({
    name: meal.name, calories: 350, protein: 35, fat: 12, carbs: 18, ingredients: meal.ingredients,
  })]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(generateMealImageUnified).not.toHaveBeenCalled();
});
test.each(["", "{broken", '{"meals":[]}', '{"meals":{}}'])(
  "empty or malformed generation returns no generic fallback: %s", async content => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content } }] });
    expect(await generate()).toEqual([]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
test("provider failure is unavailable, not a second paid attempt", async () => {
  mockCreate.mockRejectedValueOnce(new Error("provider unavailable"));
  expect(await generate()).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});
test.each([
  { calories: undefined }, { calories: -1 }, { protein: undefined }, { fat: undefined },
  { ingredients: [] }, { servings: 4 }, { starchyCarbs: null, fibrousCarbs: null },
])("missing/invalid nutrition or composition cannot become invented defaults: %j", async change => {
  reply([{ ...meal, ...change }]);
  expect(await generate()).toEqual([]);
});
test.each(["allergy", "alpha-gal", "pregnancy"])("ingredient-sensitive %s blocks unknown recipes before AI", async kind => {
  const envelope = memberEnvelope();
  if (kind === "allergy") envelope.allergies = ["peanuts"];
  if (kind === "alpha-gal") envelope.alphaGalContext = { active: true } as any;
  if (kind === "pregnancy") envelope.pregnancySupportContext = { active: true, stage: "trimester-2" } as any;
  expect(await generate({ protocolEnvelope: envelope })).toEqual([]);
  expect(mockCreate).not.toHaveBeenCalled();
});
test("a physician-controlled canonical dietary restriction cannot be overridden by model output", async () => {
  const envelope = memberEnvelope();
  envelope.dietaryIdentity = ["vegan"];
  envelope.providerInterventions = [{ conditionKey: "custom", severity: "high", notes: "Vegan diet", escalationFlag: false }] as any;
  reply([meal]);
  expect(await generate({ protocolEnvelope: envelope })).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});
test("avoided ingredients are checked after generation, not only described in the prompt", async () => {
  reply([meal]);
  expect(await generate({ user: { id: "member", avoidedFoods: ["broccoli"] } })).toEqual([]);
});
test("unsafe diabetic food is rejected with no repair loop or legacy escape", async () => {
  const envelope = memberEnvelope();
  envelope.hasDiabetes = true; envelope.diabeticGlucoseState = "high-risk";
  reply([{ ...meal, name: "Chicken and mashed potatoes", ingredients: ["chicken", "white potatoes"],
    starchyCarbs: 60, fibrousCarbs: 0 }]);
  expect(await generate({ protocolEnvelope: envelope })).toEqual([]);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});
test("eligible diabetic meal still succeeds through existing validator", async () => {
  const envelope = memberEnvelope(); envelope.hasDiabetes = true;
  reply([{ ...meal, starchyCarbs: 0, fibrousCarbs: 8 }]);
  expect(await generate({ protocolEnvelope: envelope })).toHaveLength(1);
});
test("unknown authenticated food context blocks generation", async () => {
  expect(await generate({ protocolEnvelope: undefined })).toEqual([]);
  expect(mockCreate).not.toHaveBeenCalled();
});
test("a guest fallback envelope is not an authenticated safety context", async () => {
  expect(await generate({ protocolEnvelope: buildGuestEnvelope() })).toEqual([]);
  expect(mockCreate).not.toHaveBeenCalled();
});
test("no Places results cannot become invented local businesses or start generation", async () => {
  (resolveRestaurantsByZip as jest.Mock).mockResolvedValue({ success: false, restaurants: [] });
  expect(await findMealsNearby({ mealQuery: "burger", zipCode: "10001",
    protocolEnvelope: memberEnvelope() })).toEqual([]);
  expect(mockCreate).not.toHaveBeenCalled();
});
test("real discovered restaurants retain cuisine/rating ordering and three-by-two limits", async () => {
  (resolveRestaurantsByZip as jest.Mock).mockResolvedValue({
    success: true, coordinates: { lat: 40, lng: -73 },
    restaurants: [1, 2, 3, 4].map(n => ({ name: `Verified restaurant ${n}`, placeId: `place-${n}`,
      cuisine: "Thai", address: `${n} Verified Street`, rating: n, location: { lat: 40, lng: -73 } })),
  });
  for (let i = 0; i < 3; i++) reply([meal, { ...meal, name: "Basil chicken with vegetables" },
    { ...meal, name: "Ginger chicken" }]);
  const results = await findMealsNearby({ mealQuery: "chicken", zipCode: "10001", user: { id: "member" } as any,
    cuisinePreference: "Thai", protocolEnvelope: memberEnvelope() });
  expect(results).toHaveLength(6);
  expect([...new Set(results.map(r => r.restaurantName))])
    .toEqual(["Verified restaurant 4", "Verified restaurant 3", "Verified restaurant 2"]);
  expect(mockCreate).toHaveBeenCalledTimes(3);
  expect(generateMealImageUnified).not.toHaveBeenCalled();
});
