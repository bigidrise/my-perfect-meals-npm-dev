import express from "express";
import request from "supertest";
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";

let mockEnvelope: UserProtocolEnvelope;
const mockResolve = jest.fn();
const mockChat = jest.fn();
const mockCreate = jest.fn();
const mockImages = jest.fn();
const mockSafety = jest.fn();
const mockProfile = jest.fn();

jest.mock("../vite", () => ({ log: jest.fn() }));
jest.mock("../services/safetyProfileService", () => ({
  enforceSafetyProfile: (...args: any[]) => mockSafety(...args),
}));
jest.mock("../services/pairings/profileContext", () => ({
  loadPairingsProfile: (...args: any[]) => mockProfile(...args),
}));
jest.mock("../services/pairings/pairingsImageService", () => ({
  generatePairingImages: (...args: any[]) => mockImages(...args),
}));
jest.mock("../utils/openaiSafe", () => ({ chatJson: (...args: any[]) => mockChat(...args) }));
jest.mock("openai", () => ({
  __esModule: true,
  default: class { chat = { completions: { create: (...args: any[]) => mockCreate(...args) } }; },
}));
jest.mock("../services/protocolEnvelope", () => {
  const actual = jest.requireActual("../services/protocolEnvelope");
  return {
    ...actual,
    loadGenerationProtocolEnvelope: (...args: any[]) => mockResolve(...args),
    loadUserProtocolEnvelope: (...args: any[]) => mockResolve(...args),
  };
});

import { buildGuestEnvelope } from "../services/protocolEnvelope";
import {
  developmentPairingFoundationEnabled, resolveDevelopmentPairingContext, validateDevelopmentWineList,
  validateDevelopmentPairings, validateDevelopmentChefPairings, PairingFoundationError,
} from "../services/pairings/developmentPairingFoundation";
import { parseWineListEntries, findWineListEntry } from "../services/pairings/wineListIdentity";
import pairingsRouter from "../routes/ai-pairings";
import wineRouter from "../routes/ai-wine-list-helper";
import chefRouter from "../routes/chef-pairings";

const wine = (name = "Chianti Classico 2019", overrides: Record<string, unknown> = {}) => ({
  category: "wine", name, explanation: "Acidity balances the richness of the meal.",
  alternatives: [], servingTips: "Serve slightly cool.",
  flavorProfile: ["cherry", "earth", "herbs"], body: "medium", acidity: "high", sweetness: "dry",
  ...overrides,
});
const water = (overrides = {}) => ({
  category: "non-alcoholic", name: "Sparkling water", explanation: "Bubbles refresh the palate.",
  alternatives: [], servingTips: "Serve chilled.", ...overrides,
});
const chef = (overrides = {}) => ({
  name: "Chianti", type: "Red", description: "A structured red.", pairingReason: "Acidity balances richness.",
  healthNotes: [], ...overrides,
});
const context = (generatorName: "wine_list_helper" | "pairings_ai" | "chef_pairings" = "wine_list_helper") => ({
  envelope: mockEnvelope, generatorName, constraints: "",
});

const originalMode = process.env.NODE_ENV;
const originalDeployment = process.env.REPLIT_DEPLOYMENT;
beforeEach(() => {
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  mockEnvelope = buildGuestEnvelope();
  mockEnvelope.userId = "authenticated-actor";
  mockResolve.mockReset().mockImplementation(async () => mockEnvelope);
  mockSafety.mockReset().mockResolvedValue({ result: "SAFE" });
  mockProfile.mockReset().mockResolvedValue({
    userId: "authenticated-actor", allergies: [], dietaryRestrictions: [], avoidedFoods: [],
    dislikedFoods: [], healthConditions: [], alcoholContraindications: [],
  });
  mockChat.mockReset().mockResolvedValue({ bestChoice: { name: "Chianti Classico 2019", explanation: "Good balance." }, pairings: [wine()] });
  mockCreate.mockReset().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ wine: [chef()], beer: [], spirits: [] }) } }],
  });
  mockImages.mockReset().mockResolvedValue(new Map());
});
afterEach(() => {
  process.env.NODE_ENV = originalMode;
  if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
  else process.env.REPLIT_DEPLOYMENT = originalDeployment;
});

function app(authenticated = true) {
  const instance = express();
  instance.use(express.json());
  if (authenticated) instance.use((req: any, _res, next) => { req.authUser = { id: "authenticated-actor" }; next(); });
  instance.use("/pairings", pairingsRouter);
  instance.use("/wine", wineRouter);
  instance.use("/chef", chefRouter);
  return instance;
}
const routes = [
  ["/pairings", { mode: "pairing", category: "wine", input: "Mushroom pasta" }],
  ["/wine", { wineListText: "Chianti Classico 2019" }],
  ["/chef", { foodItem: "Mushroom pasta", userId: "spoofed-user" }],
] as const;

describe("server-only Development isolation", () => {
  it.each([
    ["production", undefined, false], ["test", undefined, false], ["development", "1", false],
    ["development", "0", false], ["development", undefined, true],
  ])("mode=%s deployment=%s enabled=%s", (mode, deployment, expected) => {
    expect(developmentPairingFoundationEnabled({ NODE_ENV: mode, REPLIT_DEPLOYMENT: deployment })).toBe(expected);
  });
  it("does not resolve context or validate through direct foundation calls in Production", async () => {
    process.env.NODE_ENV = "production";
    await expect(resolveDevelopmentPairingContext("authenticated-actor", "pairings_ai")).rejects.toMatchObject({ status: 404 });
    expect(() => validateDevelopmentPairings([water()], context())).toThrow(PairingFoundationError);
    expect(() => validateDevelopmentWineList({}, [], context())).toThrow(PairingFoundationError);
    expect(() => validateDevelopmentChefPairings({}, context())).toThrow(PairingFoundationError);
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockProfile).not.toHaveBeenCalled();
  });
  it.each(routes)("retains the established Production response for %s", async (path, body) => {
    process.env.NODE_ENV = "production";
    // A deliberately off-list best choice demonstrates that the DEV membership
    // path is not silently changing the existing Production path.
    mockChat.mockResolvedValue({ bestChoice: { name: "Off-list legacy choice", explanation: "Legacy." }, pairings: [wine()] });
    const response = await request(app()).post(path).send(body);
    expect(response.status).toBe(200);
    expect(response.body.foundation).toBeUndefined();
    if (path === "/wine") expect(response.body.bestChoice.name).toBe("Off-list legacy choice");
    if (path === "/chef") expect(mockProfile).not.toHaveBeenCalled();
  });
  it("also keeps deployed runtimes on the legacy path even if NODE_ENV is mis-set", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    const response = await request(app()).post("/wine").send({ wineListText: "Different supplied wine" });
    expect(response.status).toBe(200);
    expect(response.body.foundation).toBeUndefined();
  });
});

describe("shared authoritative context and preserved ingredient-evidence gate", () => {
  it.each(routes)("uses only the authenticated actor for %s", async (path, body) => {
    const response = await request(app()).post(path).send({ ...body, userId: "spoofed-user" });
    expect(response.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledWith("authenticated-actor");
    expect(mockProfile).toHaveBeenCalledWith("authenticated-actor");
    expect(response.body.foundation.version).toBe(1);
  });
  it.each(routes)("fails closed when context resolution fails for %s", async (path, body) => {
    mockResolve.mockRejectedValue(new Error("Database unavailable"));
    const response = await request(app()).post(path).send(body);
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("PROTOCOL_CONTEXT_UNRESOLVED");
    expect(response.body.safety).toBeUndefined();
    expect(mockChat).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it.each([null, { userId: "another-subject" }])("never uses missing or wrong-subject authority: %j", async envelope => {
    mockResolve.mockResolvedValue(envelope);
    await expect(resolveDevelopmentPairingContext("authenticated-actor", "pairings_ai")).rejects.toMatchObject({
      status: 503, code: "PROTOCOL_CONTEXT_UNRESOLVED",
    });
    expect(mockProfile).not.toHaveBeenCalled();
  });
  it.each(["allergy", "alpha-gal", "pregnancy"] as const)("preserves %s verification requirements on all three routes", async restriction => {
    if (restriction === "allergy") mockEnvelope.allergies = ["milk"];
    if (restriction === "alpha-gal") mockEnvelope.alphaGalContext = { active: true } as any;
    if (restriction === "pregnancy") mockEnvelope.pregnancySupportContext = { active: true, stage: "trimester-2" } as any;
    for (const [path, body] of routes) {
      const response = await request(app()).post(path).send({ ...body, safetyMode: "CUSTOM_AUTHENTICATED", overrideToken: "token-does-not-establish-ingredients" });
      expect(response.status).toBe(503);
      expect(response.body.code).toBe("PAIRING_INGREDIENTS_UNVERIFIED");
    }
    expect(mockChat).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockImages).not.toHaveBeenCalled();
  });
  it("preserves explicit one-request culture preferences without changing saved context", async () => {
    const resolved = await resolveDevelopmentPairingContext("authenticated-actor", "pairings_ai", "Italian");
    expect(resolved.envelope.cuisinePreference).toBe("Italian");
    expect(mockEnvelope.cuisinePreference).not.toBe("Italian");
  });
});

describe("deterministic supplied-list identity", () => {
  it("preserves producers, commas and vintages, stripping only explicit prices/bullets", () => {
    const entries = parseWineListEntries("1. Producer A, Chianti 2019 — €45\nProducer B, Chianti 2020 $55");
    expect(entries.map(entry => entry.name)).toEqual(["Producer A, Chianti 2019", "Producer B, Chianti 2020"]);
    expect(findWineListEntry(entries, "Chianti")).toBeNull();
    expect(findWineListEntry(entries, "Producer A, Chianti 2020")).toBeNull();
    expect(findWineListEntry(entries, "producer a, CHIANTI 2019")?.id).toBe("wine-1");
  });
  it("does not guess duplicate identities or comma-separated wine boundaries", () => {
    expect(findWineListEntry(parseWineListEntries("Chianti\nChianti"), "Chianti")).toBeNull();
    expect(findWineListEntry(parseWineListEntries("Barolo, Chianti"), "Chianti")).toBeNull();
  });
  it("does not turn a section heading into a selectable wine", () => {
    const entries = parseWineListEntries("Wine List\nRed Wines:\nChianti Classico 2019");
    expect(entries.map(entry => entry.name)).toEqual(["Chianti Classico 2019"]);
  });
  it("requires a validated on-list card before Best Choice can survive", () => {
    const result = validateDevelopmentWineList({
      pairings: [wine()], bestChoice: { name: "Invented Cabernet", explanation: "Not available." },
    }, parseWineListEntries("Chianti Classico 2019"), context());
    expect(result.bestChoice).toBeNull();
    expect(result.foundation.outcome).toBe("clarification_needed");
  });
  it("cannot retain a Best Choice whose card was invalid", () => {
    const result = validateDevelopmentWineList({
      pairings: [wine(), wine("Barolo 2020", { body: undefined })],
      bestChoice: { name: "Barolo 2020", explanation: "Invalid card." },
    }, parseWineListEntries("Chianti Classico 2019\nBarolo 2020"), context());
    expect(result.bestChoice).toBeNull();
    expect(result.pairings).toHaveLength(1);
  });
  it("rejects off-list alternatives and missing required flavor fields", () => {
    const entries = parseWineListEntries("Chianti Classico 2019");
    expect(() => validateDevelopmentWineList({ pairings: [wine(undefined, { alternatives: ["Merlot"] })] }, entries, context())).toThrow(PairingFoundationError);
    expect(() => validateDevelopmentWineList({ pairings: [wine(undefined, { acidity: undefined })] }, entries, context())).toThrow(PairingFoundationError);
  });
  it("retains full canonical identity and validates the successful result contract", () => {
    const result = validateDevelopmentWineList({
      pairings: [wine("chianti classico 2019")],
      bestChoice: { name: "CHIANTI CLASSICO 2019", explanation: "Good balance." },
    }, parseWineListEntries("Chianti Classico 2019 — €45"), context());
    expect(result.bestChoice?.name).toBe("Chianti Classico 2019");
    expect(result.pairings[0].name).toBe("Chianti Classico 2019");
  });
});

describe("real protocol scanner consumer contracts", () => {
  beforeEach(() => { mockEnvelope.dietaryIdentity = ["halal"]; });
  it.each([
    { alternatives: ["Whiskey"] }, { servingTips: "Add rum before serving." },
    { explanation: "Mix with bourbon for balance." }, { flavorProfile: ["beer"] },
  ])("rejects prohibited actionable content in every field: %j", unsafe => {
    expect(() => validateDevelopmentPairings([water(unsafe)], context("pairings_ai"))).toThrow(PairingFoundationError);
  });
  it("preserves a clean candidate while filtering unsafe candidates", () => {
    const result = validateDevelopmentPairings([water(), water({ servingTips: "Add whiskey." })], context("pairings_ai"));
    expect(result.pairings).toHaveLength(1);
    expect(result.foundation.rejectedCount).toBe(1);
  });
  it("scans Chef pairing reasons and nested health advice, not just drink names", () => {
    expect(() => validateDevelopmentChefPairings({
      wine: [], beer: [], spirits: [chef({ name: "Grape juice", type: "Juice", healthNotes: ["Add whiskey."] })],
    }, context("chef_pairings"))).toThrow(PairingFoundationError);
  });
  it("scans Best Choice explanations independently", () => {
    mockEnvelope.dietaryIdentity = ["vegan"];
    const result = validateDevelopmentWineList({
      pairings: [wine()], bestChoice: { name: "Chianti Classico 2019", explanation: "Serve with beef and butter." },
    }, parseWineListEntries("Chianti Classico 2019"), context());
    expect(result.bestChoice).toBeNull();
  });
  it("requires complete discovery fields and nonblank actionable text", () => {
    mockEnvelope.dietaryIdentity = [];
    expect(() => validateDevelopmentPairings([wine(undefined, { flavorProfile: ["cherry"] })], context("pairings_ai"), "wine")).toThrow(PairingFoundationError);
    expect(() => validateDevelopmentPairings([wine(undefined, { servingTips: "   " })], context("pairings_ai"))).toThrow(PairingFoundationError);
    expect(validateDevelopmentPairings([wine()], context("pairings_ai"), "wine").pairings).toHaveLength(1);
  });
});

describe("Development route compatibility adapters", () => {
  it("returns safe wine cards and null Best Choice rather than inventing a replacement", async () => {
    mockChat.mockResolvedValue({ pairings: [wine()], bestChoice: { name: "Not on list", explanation: "Invented." } });
    const response = await request(app()).post("/wine").send({ wineListText: "Chianti Classico 2019" });
    expect(response.status).toBe(200);
    expect(response.body.bestChoice).toBeNull();
    expect(response.body.pairings[0].name).toBe("Chianti Classico 2019");
    expect(response.body.safety.message).toMatch(/not been verified/);
  });
  it("preserves Chef groups but never promotes model-generated medical clearance badges", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      wine: [chef({ medicalCompatibility: { diabeticFriendly: true, lowCalorie: true, reason: "AI guessed." } })],
      beer: [], spirits: [],
    }) } }] });
    const response = await request(app()).post("/chef").send({ foodItem: "Pasta" });
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.pairings)).toEqual(["wine", "beer", "spirits"]);
    expect(response.body.pairings.wine[0].medicalCompatibility.diabeticFriendly).toBe(false);
    expect(response.body.pairings.wine[0].healthNotes).toContain("Nutrition and alcohol values are estimates, not verified product data.");
  });
  it("rejects all-invalid results without generating images", async () => {
    mockChat.mockResolvedValue({ pairings: [wine("Off-list wine")], bestChoice: { name: "Off-list wine", explanation: "No." } });
    const response = await request(app()).post("/wine").send({ wineListText: "Chianti Classico 2019" });
    expect(response.status).toBe(422);
    expect(response.body.code).toBe("NO_ELIGIBLE_PAIRINGS");
    expect(mockImages).not.toHaveBeenCalled();
  });
  it("keeps input safety failures ahead of generation and image work", async () => {
    mockSafety.mockResolvedValue({ result: "BLOCKED", message: "Existing safety rule." });
    for (const [path, body] of routes) {
      const response = await request(app()).post(path).send(body);
      expect(response.status).toBe(400);
    }
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockChat).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it.each(routes)("cannot resolve a spoofed body identity without authentication for %s", async (path, body) => {
    const response = await request(app(false)).post(path).send({ ...body, userId: "spoofed-user" });
    expect(response.status).toBe(path === "/chef" ? 500 : 401); // Existing Chef error adapter is unchanged.
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockChat).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
