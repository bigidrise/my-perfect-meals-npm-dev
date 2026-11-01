jest.mock("../services/organizationWorkspaceService", () => ({ discoverAuthorizedWorkspaces: jest.fn() }));
jest.mock("../services/professionalIdentityReadiness", () => ({ getProfessionalIdentityReadiness: jest.fn() }));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { buildSafetyResponse, runSafetyGate } from "../services/coaching/safety";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { getDevelopmentPlatformKnowledge } from "../services/coaching/platformKnowledge";
import { buildPlatformFeatureCatalog } from "../services/coaching/platformFeatureCatalog";
import { loadChefKnowledgeAccess } from "../services/coaching/platformKnowledgeAccess";
import { discoverAuthorizedWorkspaces } from "../services/organizationWorkspaceService";
import { getProfessionalIdentityReadiness } from "../services/professionalIdentityReadiness";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";
import fs from "node:fs";
import path from "node:path";

const oldEnvironment = process.env.NODE_ENV;
beforeEach(() => {
  process.env.NODE_ENV = "production";
  jest.clearAllMocks();
  (discoverAuthorizedWorkspaces as jest.Mock).mockResolvedValue([]);
});
afterAll(() => { process.env.NODE_ENV = oldEnvironment; });
const examples = [
  "I want ice cream.", "I want to make it.", "Actually, I want to go to an ice cream shop.",
  "Find me somewhere nearby.", "I'm going to Braum's.", "I'm buying it at Walmart.",
  "I want something to drink.", "I want a milkshake.", "I want a beer.",
  "I want to make a cocktail.", "I'm going out for drinks.", "I don't know what to cook.",
  "I want sushi.", "How do I use Sushi Creator?", "I want something from the grocery store.",
  "I want to go out to dinner.", "How do I use Craving Creator?", "Where do I find the Academy?",
  "What does My Perfect Menu do?", "How do I use Find a Product?", "How does my organization invite clients?",
];
async function turn(extra: Record<string, unknown> = {}, userMessage = "I want ice cream.",
  history: Array<{ role: string; content: string }> = []) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    message: "Are you thinking about making it or buying it?",
    conciergeDecision: null, navigationIntent: "none", conversationMessage: null,
    recommendationMessage: null, handoffMessage: null, creatorRequest: null,
    redFlag: false, redFlagReason: null, contactCare: null, careDisposition: "none", ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage, history, rollingContext: "Earlier preferences are context, not consent.",
    context: {}, tools: getCornerCapabilities(["all"]).map(cap => ({ ...cap, scope: "adult", featureTarget: cap.id })),
  });
  return { result, wire: JSON.parse(create.mock.calls[0][0].messages[1].content), create };
}

test.each(examples)("ordinary request is not a keyword safety event: %s", async message => {
  expect((await runSafetyGate(message)).triggered).toBe(false);
  const { result, create } = await turn({
    careDisposition: "routine_caveat", contactCare: "You can discuss concerns with your clinician.",
  }, message);
  expect(result.meta.redFlag).toBe(false);
  expect(result.presentation?.kind).toBe("concierge");
  expect(result.todayPlan.items).toEqual([]);
  expect(JSON.stringify(result)).not.toMatch(/I noticed something|Your safety comes first|discuss concerns/);
  expect(create).toHaveBeenCalledTimes(1);
});

test.each([
  { careDisposition: "referral", redFlag: false },
  { careDisposition: "emergency", redFlag: true },
  { careDisposition: "routine_caveat", redFlag: true },
  { careDisposition: undefined, redFlag: false },
])("genuine or inconsistent care output remains fail-closed: %j", async classification => {
  const text = "Please seek the indicated medical assessment now.";
  const { result } = await turn({ ...classification, contactCare: text, message: text });
  expect(result.meta.redFlag).toBe(true);
  expect(result.presentation).toBeUndefined();
  expect(result.todayPlan.items).toEqual([{ horizon: "today", kind: "contact_care", text }]);
  expect(result.whatIFound + result.whatItCouldMean + result.todayPlan.why).toBe("");
});

test("classified referral without a separate care string cannot silently become conversation", async () => {
  const { result } = await turn({ careDisposition: "referral", message: "Please contact your care team." });
  expect(result.meta.redFlag).toBe(true);
  expect(result.todayPlan.items[0].kind).toBe("contact_care");
});
test("explicit no-care classification ignores live-observed inactive-field placeholders", async () => {
  const { result } = await turn({ careDisposition: "none", redFlag: false,
    contactCare: ":)", redFlagReason: ":)" });
  expect(result.meta.redFlag).toBe(false);
  expect(result.presentation?.kind).toBe("concierge");
  expect(JSON.stringify(result)).not.toContain(":)");
});
test("symbol-only action continuation cannot be presented as helpful conversation", async () => {
  const { result } = await turn({
    message: "Would you like to use Dessert Creator?", conversationMessage: ":)",
    navigationIntent: "recommendation",
    conciergeDecision: { mode: "food_assistance", destinationId: "dessert_creator",
      goal: { activity: "prepare", occasion: "unknown", restaurant: "unknown",
        dishChosen: false, specialty: "none", explicitFeatureId: null } },
  });
  expect(result.presentation?.message).not.toBe(":)");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.meta.concierge?.rendering).toBe("retry");
});
test("safety builder owns one complete care instruction", () => {
  const result = buildSafetyResponse({ triggered: true, class: "emergency", suggestedResponse: "Call emergency services now." });
  expect(result.whatIFound).toBe("");
  expect(result.whatItCouldMean).toBe("");
  expect(result.todayPlan.items[0].text).toBe("Call emergency services now.");
  expect(result.meta.redFlag).toBe(true);
});
test("changed goals, declines, an unrelated question and returning context reach the same model call", async () => {
  const history = [
    { role: "user", content: "I want to make ice cream." },
    { role: "user", content: "Actually I want to buy it." },
    { role: "assistant", content: "Would you like help finding a product?" },
    { role: "user", content: "No, not yet. What does protein do?" },
    { role: "assistant", content: "Protein supports tissue maintenance." },
  ];
  const { wire, result } = await turn({}, "Back to ice cream: I'm buying it at Walmart.", history);
  expect(wire.history).toEqual(history);
  expect(wire.latestMemberMessage).toContain("Walmart");
  expect(wire.pendingRecommendation).toBeNull();
  expect(result.presentation?.destinationId).toBeUndefined();
});
test("catalog documents every approved destination without expanding navigation", () => {
  const catalog = buildPlatformFeatureCatalog();
  for (const [id, destination] of Object.entries(COACH_DESTINATIONS)) {
    const fact = catalog.find(row => row.id === id)!;
    expect(fact.route).toBe(destination.route);
    for (const field of ["name", "purpose", "outputs", "access", "verification"] as const) expect(fact[field]).toBeTruthy();
    expect(fact.gettingStarted.length).toBeGreaterThan(0);
  }
  for (const fact of catalog) for (const source of fact.evidence) {
    expect(fs.existsSync(path.join(process.cwd(), source))).toBe(true);
  }
});
test("knowledge includes Academy and honest specialty-shop limits; internal evidence stays private", () => {
  const knowledge = getDevelopmentPlatformKnowledge()!;
  expect(knowledge.featureCatalog.some(fact => fact.id === "academy")).toBe(true);
  expect(JSON.stringify(knowledge.featureCatalog)).not.toMatch(/client\/src|server\/services/);
  expect(knowledge.featureCatalog.some(fact => fact.audience !== "member")).toBe(false);
  expect(getCornerCapabilities(["all"]).find(cap => cap.id === "find_meals_near_me")!.description).toContain("not verified coverage");
});
test("only server-provided permissions project organization and professional instructions", () => {
  const catalog = getDevelopmentPlatformKnowledge({ organizationAdmin: true, professional: true })!.featureCatalog;
  expect(catalog.some(fact => fact.id === "organization_invitations")).toBe(true);
  expect(catalog.some(fact => fact.id === "professional_studios")).toBe(true);
});
test("role text alone grants neither organization nor professional knowledge", async () => {
  (getProfessionalIdentityReadiness as jest.Mock).mockResolvedValue({ accountPrerequisitesReady: false });
  expect(await loadChefKnowledgeAccess("member", "physician")).toEqual({ organizationAdmin: false, professional: false });
});
test("exact authorized membership and professional readiness enable scoped facts, never client access", async () => {
  (discoverAuthorizedWorkspaces as jest.Mock).mockResolvedValue([{ role: "owner", locations: [{}] }]);
  (getProfessionalIdentityReadiness as jest.Mock).mockResolvedValue({ accountPrerequisitesReady: true });
  expect(await loadChefKnowledgeAccess("owner", "physician")).toEqual({ organizationAdmin: true, professional: true });
});
test("authority-service failures remove private instructions instead of inferring permission", async () => {
  (discoverAuthorizedWorkspaces as jest.Mock).mockRejectedValue(new Error("unavailable"));
  (getProfessionalIdentityReadiness as jest.Mock).mockRejectedValue(new Error("unavailable"));
  expect(await loadChefKnowledgeAccess("member", "physician")).toEqual({ organizationAdmin: false, professional: false });
});
