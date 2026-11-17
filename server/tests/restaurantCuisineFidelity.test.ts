import {
  normalizeRestaurantCuisine, restaurantCuisineNote, restaurantCuisinePrompt,
  restaurantMealHonorsCuisine, restaurantResultContextMatches, type RestaurantCuisineContext,
} from "../../shared/restaurantCuisine";
import { classifyRestaurantArchetype } from "../services/restaurantCuisineArchetype";

const originalEnvironment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = originalEnvironment; });
const context = (change: Partial<RestaurantCuisineContext> = {}): RestaurantCuisineContext => ({
  saved: "chinese", explicit: "chinese", observed: "chinese", displayLanguage: "en", note: null, ...change,
});

test.each(["Chinese", "chinese", " CHINESE "])("normalizes %s without confusing it with language", input => {
  expect(normalizeRestaurantCuisine(input)).toBe("chinese");
});
test("Chinese, Chinese-American and American remain distinct", () => {
  expect(new Set(["Chinese", "Chinese-American", "American"].map(normalizeRestaurantCuisine)).size).toBe(3);
  expect(normalizeRestaurantCuisine("unknown")).toBeNull();
});
test.each(["Golden Lotus", "北京饭店", "Albatross", "King's Table", "Dragonfly", "Panda Art Cafe"])(
  "ambiguous/non-Latin %s never acquires an American default", name => {
    const result = classifyRestaurantArchetype(name, ["restaurant"]);
    expect(result.archetype.id).not.toBe("american_casual");
  },
);
test.each(["Chinese Kitchen", "China King", "中餐馆"])("recognizes Chinese evidence in %s", name => {
  expect(classifyRestaurantArchetype(name).archetype.id).toBe("chinese");
});
test("provider Chinese and known Chinese-American chain classification stay separate", () => {
  expect(classifyRestaurantArchetype("Golden Lotus", ["chinese_restaurant"]).archetype.id).toBe("chinese");
  expect(classifyRestaurantArchetype("Panda Express").archetype.id).toBe("chinese_american");
  expect(classifyRestaurantArchetype("Chinese-American Kitchen").archetype.id).toBe("chinese_american");
});
test("saved Chinese is guidance, never a hard block against another restaurant", () => {
  const guidance = context({ explicit: null, observed: "american" });
  expect(restaurantCuisineNote(guidance)).toContain("rather than inventing");
  expect(restaurantMealHonorsCuisine({ name: "Hamburger" }, guidance)).toBe(true);
});
test("explicit Mexican overrides saved Chinese, not the persisted profile", () => {
  const selected = context({ explicit: "mexican", observed: "mexican" });
  expect(restaurantCuisinePrompt(selected)).toContain("Saved cuisine guidance: chinese");
  expect(restaurantMealHonorsCuisine({ name: "Burrito", cuisine: "Mexican" }, selected)).toBe(true);
  expect(selected.saved).toBe("chinese");
});
test.each([
  { name: "Hamburger", cuisine: "American" },
  { name: "Cheeseburger", cuisine: "Chinese" },
  { name: "Steamed ginger chicken" },
  { name: "Steamed ginger chicken", cuisine: "Chinese-American" },
])("adversarial or undeclared cuisine cannot satisfy explicit Chinese: %j", meal => {
  expect(restaurantMealHonorsCuisine(meal, context())).toBe(false);
});
test("structured Chinese cuisine accepts a compatible Chinese dish", () => {
  expect(restaurantMealHonorsCuisine({ name: "清蒸鱼", cuisine: "Chinese" }, context())).toBe(true);
  expect(restaurantMealHonorsCuisine({ name: "Rou jia mo (Chinese hamburger)", cuisine: "Chinese" }, context())).toBe(true);
});
test("explicit Chinese mismatch gets an actionable explanation", () => {
  expect(restaurantCuisineNote(context({ observed: "american" }))).toMatch(/cannot confirm.*Choose another/);
});
const snapshot = { owner: "synthetic-member", saved: "chinese", explicit: null };
test.each([
  undefined,
  { ...snapshot, saved: "american" },
  { ...snapshot, explicit: "chinese-american" },
  { ...snapshot, owner: "other-synthetic-member" },
])("legacy, changed or other-account result context is historical: %j", previous => {
  expect(restaurantResultContextMatches(previous, snapshot)).toBe(false);
});
test("same saved context survives casing changes but language is not cuisine", () => {
  expect(restaurantResultContextMatches({ ...snapshot, saved: "Chinese" }, snapshot)).toBe(true);
  expect(restaurantCuisinePrompt(context({ explicit: null, saved: null, displayLanguage: "zh" })))
    .toContain("Saved cuisine guidance: not set");
});
test("Production retains its prior classification until separately approved promotion", () => {
  process.env.NODE_ENV = "production";
  expect(classifyRestaurantArchetype("Golden Lotus").archetype.id).toBe("american_casual");
  expect(classifyRestaurantArchetype("Golden Lotus", ["chinese_restaurant"]).archetype.id).toBe("chinese_american");
});
