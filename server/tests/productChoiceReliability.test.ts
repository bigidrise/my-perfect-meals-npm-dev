import { analyzeProductByName } from "../services/ingredientScanService";
import { chatJson } from "../utils/openaiSafe";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import { classifyProductLookupFailure } from "../services/productLookupFailure";
import { UnsupportedProductMedicalClaim } from "../services/productMedicalClaimPolicy";
import type { GroceryChoiceStore } from "../services/groceryChoiceMemory";

jest.mock("../utils/openaiSafe", () => ({ chatJson: jest.fn(), openai: {} }));
jest.mock("../services/protocolEnvelope", () => ({ loadUserProtocolEnvelope: jest.fn() }));
jest.mock("../db", () => { throw new Error("A live database is forbidden in this test"); });

const profile = {
  userId: "synthetic-owner", dietaryIdentity: [], allergies: [], medicalHardLimits: [],
  medicalOptimization: [], conditionGuidanceBlocks: [], preferences: [], avoidances: [],
  providerInterventions: [], procedural: { forbiddenInstructions: [] },
};
const alternative = (category: string) => ({ category, whyBetter: ["Review this option's current label."], targetCriteria: "Check ingredients." });
function response(names = ["Other Oil", "Usual Oil"]) {
  return { overallSummary: "Options for consideration, not package clearance.",
    verdict: "Check the label.", verdictLevel: "caution", alignmentGrade: "B",
    betterAlternatives: names.map(alternative) };
}
function store() {
  const rows = new Map<string, { shownNames: string[]; preferredName: string | null }>();
  const api: GroceryChoiceStore = {
    read: jest.fn(async (owner, key) => rows.get(`${owner}:${key}`) ?? null),
    observe: jest.fn(async (owner, key, _query, names) => {
      const old = rows.get(`${owner}:${key}`);
      rows.set(`${owner}:${key}`, { shownNames: names, preferredName: old?.preferredName ?? null });
    }),
    prefer: jest.fn(async (owner, key, _query, preferredName) => {
      rows.set(`${owner}:${key}`, { shownNames: rows.get(`${owner}:${key}`)?.shownNames ?? [], preferredName });
    }),
  };
  return api;
}
beforeEach(() => {
  jest.clearAllMocks();
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue(profile);
  (chatJson as jest.Mock).mockResolvedValue(response());
});

test("reopening remembers shown options but does not manufacture an explicit preference", async () => {
  const memory = store();
  await analyzeProductByName("olive oil", "owner-a", { memoryStore: memory });
  await analyzeProductByName("olive oil", "owner-a", { memoryStore: memory });
  expect(memory.prefer).not.toHaveBeenCalled();
  expect((chatJson as jest.Mock).mock.calls[1][0].user).toContain('"shownNames":["Other Oil","Usual Oil"]');
  expect((chatJson as jest.Mock).mock.calls[1][0].user).toContain('"preferredName":null');
  expect(loadUserProtocolEnvelope).toHaveBeenCalledTimes(2);
});

test("usual brands survive explicit alternative searches and do not cross accounts", async () => {
  const memory = store();
  await analyzeProductByName("olive oil", "owner-a", { memoryStore: memory });
  const key = (memory.observe as jest.Mock).mock.calls[0][1];
  await memory.prefer("owner-a", key, "olive oil", "Usual Oil");
  const repeat = await analyzeProductByName("olive oil", "owner-a", { memoryStore: memory });
  expect(repeat.betterAlternatives[0].category).toBe("Usual Oil");
  (chatJson as jest.Mock).mockResolvedValueOnce(response(["New Oil"]));
  await analyzeProductByName("olive oil", "owner-a", { memoryStore: memory, findNewOptions: true });
  expect((await memory.read("owner-a", key))?.preferredName).toBe("Usual Oil");
  await analyzeProductByName("olive oil", "owner-b", { memoryStore: memory });
  expect((chatJson as jest.Mock).mock.calls.at(-1)[0].user).not.toContain("REMEMBERED SHOPPING");
});

test("changed current requirements are assessed again; omitted old choices are not restored", async () => {
  const memory = store();
  await analyzeProductByName("olive oil", "owner-a", { memoryStore: memory });
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValueOnce({ ...profile, allergies: ["sesame"] });
  (chatJson as jest.Mock).mockResolvedValueOnce(response(["New Oil"]));
  const changed = await analyzeProductByName("olive oil", "owner-a", { memoryStore: memory });
  expect(changed.betterAlternatives.map(item => item.category)).toEqual(["New Oil"]);
  expect((chatJson as jest.Mock).mock.calls.at(-1)[0].user).toContain("sesame");
});

test.each([
  [new SyntaxError("sensitive response"), "invalid_response"],
  [new UnsupportedProductMedicalClaim(), "unsupported_medical_claim"],
  [new Error("secret provider prompt"), "provider_unavailable"],
] as const)("lookup failure is classified without logging sensitive payloads", async (error, reason) => {
  const log = jest.spyOn(console, "warn").mockImplementation(() => {});
  (chatJson as jest.Mock).mockRejectedValueOnce(error);
  const memory = store();
  const result = await analyzeProductByName("olive oil", "owner-a", { memoryStore: memory });
  expect(result.fallbackUsed).toBe(true);
  expect(result.failureReason).toBe(reason);
  expect(memory.observe).not.toHaveBeenCalled();
  expect(classifyProductLookupFailure(error)).toBe(reason);
  expect(log).toHaveBeenCalledWith("[ProductLookup]", { stage: "by_name", reason });
  expect(JSON.stringify(log.mock.calls)).not.toContain(error.message);
  log.mockRestore();
});

test("unsupported claims still fail the new result instead of being stripped or approved", async () => {
  (chatJson as jest.Mock).mockResolvedValueOnce({ ...response(), verdict: "Avoid soy during testosterone therapy." });
  const result = await analyzeProductByName("olive oil", "owner-a", { memoryStore: store() });
  expect(result.fallbackUsed).toBe(true);
  expect(result.failureReason).toBe("unsupported_medical_claim");
});
