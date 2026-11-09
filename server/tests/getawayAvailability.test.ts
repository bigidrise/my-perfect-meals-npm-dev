jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("../services/away-from-home/ProviderRegistry", () => ({ restaurantEngine: { resolve: jest.fn() } }));
import axios from "axios";
import { restaurantEngine } from "../services/away-from-home/ProviderRegistry";
import { checkGetawayAvailability, getawayPreferences } from "../services/getawayAvailability";
const originalEnv = process.env;
const preferences = { cuisine: "Korean", diets: ["vegan"] };
beforeAll(() => { process.env = { NODE_ENV: "test", GOOGLE_PLACES_API_KEY: "synthetic-offline" }; });
afterAll(() => { process.env = originalEnv; });
beforeEach(() => {
  (axios.get as jest.Mock).mockReset();
  (restaurantEngine.resolve as jest.Mock).mockReset().mockResolvedValue({ status: "unavailable" });
});
const places = [{ name: "Fixture Restaurant", types: ["restaurant"], formatted_address: "DFW Terminal A" }];
test("uses existing saved cuisine and required dietary pattern, without sentinels", () => {
  expect(getawayPreferences({ cuisinePreference: "Korean" }, ["vegan"])).toEqual(preferences);
  expect(getawayPreferences({ cuisinePreference: "unsure" }, [])).toEqual({ cuisine: null, diets: [] });
});
test("searches exact selected location and diet, then checks the existing menu engine", async () => {
  (axios.get as jest.Mock).mockResolvedValue({ data: { status: "OK", results: places } });
  const result = await checkGetawayAvailability("DFW Airport, Terminal A", preferences);
  expect((axios.get as jest.Mock).mock.calls[0][1].params.query).toContain("Korean vegan restaurants inside DFW Airport, Terminal A");
  expect(restaurantEngine.resolve).toHaveBeenCalledWith({ restaurantName: "Fixture Restaurant" });
  expect(result.status).toBe("listings_found");
  expect(result.restaurants[0].menuStatus).toBe("unverified");
});
test("broadens cuisine only, never dietary requirements or terminal", async () => {
  (axios.get as jest.Mock).mockResolvedValueOnce({ data: { status: "ZERO_RESULTS", results: [] } })
    .mockResolvedValueOnce({ data: { status: "OK", results: places } });
  const result = await checkGetawayAvailability("DFW Airport, Terminal A", preferences);
  const query = (axios.get as jest.Mock).mock.calls[1][1].params.query;
  expect(query).not.toContain("Korean");
  expect(query).toContain("vegan restaurants inside DFW Airport, Terminal A");
  expect(result.status).toBe("no_matches_found");
  expect(result.summary).toContain("does not mean no suitable food exists");
});
test("provider denial is not evidence of absent cuisine and leaks no provider details", async () => {
  (axios.get as jest.Mock).mockResolvedValue({ data: { status: "REQUEST_DENIED", error_message: "private-provider-detail" } });
  const result = await checkGetawayAvailability("DFW", preferences);
  expect(result.status).toBe("unavailable");
  expect(JSON.stringify(result)).not.toContain("private-provider-detail");
  expect(axios.get).toHaveBeenCalledTimes(1);
});
test("a vegan flag must be positively documented before listing a published candidate", async () => {
  (axios.get as jest.Mock).mockResolvedValue({ data: { status: "OK", results: places } });
  (restaurantEngine.resolve as jest.Mock).mockResolvedValue({
    status: "ok", menuLastVerifiedAt: new Date().toISOString(),
    items: [{ name: "Chicken", isVegan: false }, { name: "Mystery salad" }, { name: "Lentils", isVegan: true }],
  });
  const result = await checkGetawayAvailability("DFW", preferences);
  expect(result.restaurants[0].menuNote).toContain("Lentils");
  expect(result.restaurants[0].menuNote).not.toMatch(/Chicken|Mystery salad/);
});
test("does not search without a location", async () => {
  expect((await checkGetawayAvailability("", preferences)).status).toBe("location_required");
  expect(axios.get).not.toHaveBeenCalled();
});
