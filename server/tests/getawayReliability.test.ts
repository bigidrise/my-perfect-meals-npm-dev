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
  process.env = { NODE_ENV: "production", GOOGLE_PLACES_API_KEY: "synthetic-no-network" };
  ({ discoverVenue, clearDiscoveryCache } = require("../services/locationContext/venueDiscovery"));
});
afterAll(() => { process.env = originalEnvironment; });
beforeEach(() => {
  process.env.NODE_ENV = "production";
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

test.each([
  ["JFK", "jfk-airport"], ["LAX", "lax-airport"], ["DFW", "dfw-airport"],
])("Production airport discovery preserves %s and its catalog terminals", async (query, venueId) => {
  const result = await discoverVenue(query);
  expect(result).toMatchObject({ source: "catalog", found: true, venueId, type: "airport" });
  expect(result.zones.length).toBeGreaterThan(0);
  expect(get).not.toHaveBeenCalled();
});

test("Production can discover Ontario outside Quick Start without inventing terminals", async () => {
  places([place("Ontario International Airport", "ontario-fixture", ["airport"], "Ontario, CA, USA")]);
  const result = await discoverVenue("Ontario International Airport");
  expect(result).toMatchObject({
    source: "google", found: true, name: "Ontario International Airport",
    placeId: "ontario-fixture", type: "airport", zones: [],
  });
  expect(result.venueId).toBeUndefined();
  expect(get).toHaveBeenCalledTimes(2);
});

test("Heathrow uses existing external discovery without fabricated terminals or DFW", async () => {
  places([place("Heathrow Airport")]);
  const result = await discoverVenue("I'm at Heathrow Airport. Where can I eat?");
  expect(result).toMatchObject({ source: "google", found: true, name: "Heathrow Airport", zones: [] });
  expect(result.venueId).toBeUndefined();
  expect(get).toHaveBeenCalledTimes(2);
});

test.each([
  "I'm at Heathrow Airport in London, and I'm hungry. I don't know what restaurants are available or what I should eat. Can you help me find something that fits my nutrition goals?",
  "Heathrow Airport, London, United Kingdom",
  "Heathrow Airport, London, U.K.",
])("Heathrow lookup separates conversational help and equivalent country spelling: %s", async query => {
  places([place("Heathrow Airport")]);
  const result = await discoverVenue(query);
  expect(result).toMatchObject({ found: true, source: "google", name: "Heathrow Airport", zones: [] });
  expect(result.venueId).toBeUndefined();
  expect(get).toHaveBeenCalledTimes(2);
  const searchQuery = get.mock.calls[0][1].params.query;
  expect(searchQuery).not.toMatch(/hungry|nutrition goals|what restaurants/i);
});

test("London qualifier can be proven by existing details rather than guessed from Hounslow", async () => {
  get.mockResolvedValueOnce({ data: { status: "OK", results: [
    place("Heathrow Airport", "heathrow", ["airport"], "Hounslow TW6 1QG, UK"),
  ] } });
  get.mockResolvedValueOnce({ data: { status: "OK", result: {
    types: ["airport"],
    address_components: [
      { long_name: "Greater London", short_name: "Greater London" },
      { long_name: "United Kingdom", short_name: "GB" },
    ],
  } } });
  expect(await discoverVenue("Heathrow Airport, London, United Kingdom"))
    .toMatchObject({ found: true, placeId: "heathrow", zones: [] });
  expect(get).toHaveBeenCalledTimes(2);
  expect(get.mock.calls[1][1].params.fields).toBe("types,name,address_components");
});

test.each(["Paris, France", "Hounslow, UK"])(
  "a named Heathrow result cannot erase an unproven London qualifier: %s", async address => {
    places([place("Heathrow Airport", "heathrow", ["airport"], address)]);
    expect(await discoverVenue("Heathrow Airport, London, United Kingdom"))
      .toMatchObject({ found: false, zones: [] });
  });

test.each(["United States", "USA", "U.S.", "US"])("country constraint %s is retained, not filtered as the pronoun us", async country => {
  places([place("Sunrise Airport", "sunrise", ["airport"], "London, Canada")]);
  expect((await discoverVenue(`Sunrise Airport, London, ${country}`)).found).toBe(false);
});

test("country normalization does not turn conversational help us into a geographic constraint", async () => {
  expect(await discoverVenue("Can you help us at DFW Airport?"))
    .toMatchObject({ source: "catalog", venueId: "dfw-airport" });
  expect(get).not.toHaveBeenCalled();
});

test("full conversational wrapper does not block an exact curated venue", async () => {
  const result = await discoverVenue("I'm at DFW Airport, and I'm hungry. What can I eat that fits my nutrition goals?");
  expect(result).toMatchObject({ source: "catalog", venueId: "dfw-airport" });
  expect(get).not.toHaveBeenCalled();
});

test("same-name places missing a verified city stay ambiguous, not first-result defaults", async () => {
  places([place("Sunrise Airport", "one", ["airport"], "York, UK"),
    place("Sunrise Airport", "two", ["airport"], "Bath, UK")]);
  expect((await discoverVenue("Sunrise Airport, London, UK")).found).toBe(false);
  expect(get).toHaveBeenCalledTimes(1);
});

test("provider denial is retryable and is not cached as a missing venue", async () => {
  get.mockResolvedValueOnce({ data: { status: "REQUEST_DENIED", error_message: "PRIVATE_PROVIDER_DETAIL" } });
  expect(await discoverVenue("Heathrow Airport")).toMatchObject({
    found: false, uncertainty: expect.stringContaining("temporarily unavailable"),
  });
  places([place("Heathrow Airport")]);
  expect((await discoverVenue("Heathrow Airport")).found).toBe(true);
  expect(get).toHaveBeenCalledTimes(3);
});

test("discovery diagnostics keep static provider reasons and correlation, not queries or raw errors", async () => {
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    get.mockResolvedValueOnce({ data: { status: "REQUEST_DENIED", error_message: "PRIVATE_PROVIDER_DETAIL" } });
    await discoverVenue("PRIVATE_MEMBER_QUERY", "11111111-1111-4111-8111-111111111111");
    get.mockRejectedValueOnce(new Error("PRIVATE_SECRET_IN_PROVIDER_URL"));
    await discoverVenue("PRIVATE_MEMBER_QUERY");
    const logs = [...info.mock.calls, ...warn.mock.calls].flat().join("\n");
    expect(logs).toContain("provider_status=REQUEST_DENIED");
    expect(logs).toContain("outcome=provider_unavailable");
    expect(logs).toContain("request_id=11111111-1111-4111-8111-111111111111");
    expect(logs).not.toContain("PRIVATE_");
  } finally { info.mockRestore(); warn.mockRestore(); }
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

test("Production never substitutes DFW for Heathrow or invents airport terminals", async () => {
  process.env.NODE_ENV = "production";
  places([place("Heathrow Airport")]);
  expect(await discoverVenue("Heathrow Airport")).toMatchObject({
    source: "google", name: "Heathrow Airport", zones: [],
  });
  places([place("Unknown Sunrise Airport")]);
  expect(await discoverVenue("Unknown Sunrise")).toMatchObject({ source: "google", zones: [] });
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
