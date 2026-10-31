jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn() } }));
import axios from "axios";
import { VENUE_CATALOG } from "../data/venueCatalog";
import { findVenueByIdentity, findVenueByText, getVenuesPublicPayload } from "../services/locationContext/engine";
import { GETAWAY_EVIDENCE_INSTRUCTIONS, qualifyGetawayAdvice } from "../../shared/getawayEvidence";

const originalEnvironment = process.env;
let discoverVenue: typeof import("../services/locationContext/venueDiscovery").discoverVenue;
let clearDiscoveryCache: () => void;
const get = axios.get as jest.Mock;
beforeAll(() => {
  // Only a child-test fixture; no real provider credentials or requests.
  process.env = { NODE_ENV: "development", GOOGLE_PLACES_API_KEY: "synthetic-no-network" };
  ({ discoverVenue, clearDiscoveryCache } = require("../services/locationContext/venueDiscovery"));
});
afterAll(() => { process.env = originalEnvironment; });
beforeEach(() => {
  process.env.NODE_ENV = "development";
  get.mockReset();
  clearDiscoveryCache();
});

test("the old generic airport keyword explains Heathrow becoming the first catalog airport", () => {
  expect(findVenueByText("I'm at Heathrow Airport. Where can I eat?")?.venue.id).toBe("dfw-airport");
  expect(findVenueByIdentity("I'm at Heathrow Airport. Where can I eat?")).toBeNull();
});

test.each(VENUE_CATALOG.filter(venue => venue.active).flatMap(venue =>
  [venue.name, ...venue.aliases].map(query => [query, venue.id])))(
  "curated identity %s retains its exact venue %s", (query, id) => {
    expect(findVenueByIdentity(query)?.venue.id).toBe(id);
  });

test.each([
  ["I'm at DFW Airport. Where can I eat?", "dfw-airport"],
  ["Where can I eat at LAX Airport terminal 2?", "lax-airport"],
  ["I'm at Carnival Cruise. What should I eat?", "carnival-cruise"],
  ["Chicago O’Hare Airport", "ord-airport"],
])("conversational venue search %s resolves only its named identity", (query, id) => {
  expect(findVenueByIdentity(query)?.venue.id).toBe(id);
});

test.each([
  "airport", "a resort", "terminal B", "cruise ship", "Disney World",
  "DFW or LAX", "Heathrow Airport", "Unknown Sunrise Resort",
  "Laxative Resort", "I left DFW and I'm at Heathrow Airport",
  "Hilton hotel near DFW Airport", "Marriott Cancun all-inclusive resort",
])("unknown, generic, conflicting or substring search %s cannot pick an unrelated catalog venue", query => {
  expect(findVenueByIdentity(query)).toBeNull();
});

function places(results: any[]) {
  get.mockImplementation(async (url: string) => url.includes("textsearch")
    ? { data: { status: "OK", results } }
    : { data: { status: "OK", result: { types: results[0]?.types || [] } } });
}
const place = (name: string, id = name, types = ["airport"], address = "London, UK") =>
  ({ name, place_id: id, types, formatted_address: address });

test("Heathrow uses existing external discovery without fabricated terminals or DFW", async () => {
  places([place("Heathrow Airport")]);
  const result = await discoverVenue("I'm at Heathrow Airport. Where can I eat?");
  expect(result).toMatchObject({ source: "google", found: true, name: "Heathrow Airport", zones: [] });
  expect(result.venueId).toBeUndefined();
  expect(get).toHaveBeenCalledTimes(2);
});

test.each(["Unknown Sunrise Airport", "Unknown Sunrise Resort", "The Farmhouse Kitchen and Grill"])(
  "an unrelated provider result cannot silently satisfy %s", async query => {
    places([place("Dallas/Fort Worth International Airport", "dfw")]);
    expect(await discoverVenue(query)).toMatchObject({ source: "none", found: false, zones: [],
      uncertainty: expect.stringContaining("Add its city") });
    expect(get).toHaveBeenCalledTimes(1);
  });

test("ambiguous named restaurants need refinement rather than choosing the first result", async () => {
  places([
    place("The Farmhouse Kitchen and Grill", "one", ["restaurant"], "York, UK"),
    place("The Farmhouse Kitchen and Grill", "two", ["restaurant"], "Bath, UK"),
  ]);
  expect((await discoverVenue("The Farmhouse Kitchen and Grill")).found).toBe(false);
  const refined = await discoverVenue("The Farmhouse Kitchen and Grill Bath");
  expect(refined).toMatchObject({ found: true, placeId: "two", zones: [] });
});

test("a Google cruise terminal is not proof of an onboard cruise ship", async () => {
  places([place("Ocean Cruise Terminal", "port", ["cruise_terminal"])]);
  expect(await discoverVenue("Ocean Cruise Terminal")).toMatchObject({ found: true, type: "other", zones: [] });
});

test("generic queries do not ask a provider to choose a random location", async () => {
  expect((await discoverVenue("an airport")).found).toBe(false);
  expect(get).not.toHaveBeenCalled();
});

test("provider errors and zero results remain correctable uncertainty", async () => {
  get.mockRejectedValueOnce(new Error("synthetic provider failure"));
  expect((await discoverVenue("Unknown Sunrise Resort")).found).toBe(false);
  get.mockResolvedValueOnce({ data: { status: "ZERO_RESULTS", results: [] } });
  expect((await discoverVenue("Unknown Moon Resort")).found).toBe(false);
});

test("existing quick-start curated IDs retain their catalog areas", () => {
  const ids = ["disney-magic-kingdom", "disneyland-ca", "universal-studios-orlando",
    "lax-airport", "dfw-airport", "royal-caribbean-cruise", "six-flags-over-texas"];
  for (const id of ids) expect(getVenuesPublicPayload().find(venue => venue.id === id)?.zones.length).toBeGreaterThan(0);
});

test("Production retains the old matching and generic-zone behavior", async () => {
  process.env.NODE_ENV = "production";
  expect(await discoverVenue("Heathrow Airport")).toMatchObject({ source: "catalog", venueId: "dfw-airport" });
  places([place("Unknown Sunrise Airport")]);
  expect((await discoverVenue("Unknown Sunrise")).zones.length).toBeGreaterThan(0);
});

test.each(["Marriott Cancun", "The Farmhouse Kitchen and Grill", "Carnival Cruise Ship"])(
  "%s receives illustrative status, not self-certified menu or nutrition evidence", venue => {
    const result = qualifyGetawayAdvice({
      venue, verified: true, menuSource: "AI says verified", calories: 440,
      evidence: { menuStatus: "verified" },
      bestChoices: [{ name: "Grilled fish", where: "A plausible restaurant", why: "40g protein and 440 calories",
        verified: true, ingredients: ["guessed fish"], estimatedFatGrams: 12, macros: { protein: 40 } }],
      whyTheyFit: ["Protein: 40g"], coachNote: "Ask venue staff",
    });
    expect(result.evidence).toMatchObject({ menuStatus: "unverified", nutritionStatus: "unverified" });
    expect(result.evidence.notice).toContain("allergies or clinical requirements");
    expect(result.bestChoices[0]).toEqual({ name: "Grilled fish", where: "A plausible restaurant",
      why: "[nutrition unverified] and [nutrition unverified]", evidenceStatus: "illustrative" });
    expect(result).not.toHaveProperty("verified");
    expect(result).not.toHaveProperty("menuSource");
    expect(JSON.stringify(result)).not.toMatch(/440|40g|"estimatedFatGrams":|"ingredients":|"macros":/);
  });

test("the grounding prompt makes place identity distinct from menu proof without new model calls", () => {
  expect(GETAWAY_EVIDENCE_INSTRUCTIONS).toContain("identify locations only");
  expect(GETAWAY_EVIDENCE_INSTRUCTIONS).toContain("Do not invent calories");
  expect(GETAWAY_EVIDENCE_INSTRUCTIONS).toContain("do not claim allergy safety");
});
