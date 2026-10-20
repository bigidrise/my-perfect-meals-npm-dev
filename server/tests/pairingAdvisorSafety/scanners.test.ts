import type { ExistingDeterministicChecks } from "../../services/pairingAdvisor/deterministicSafetyBridge";
import { createSyntheticDeterministicBridge } from "../../services/pairingAdvisor/deterministicSafetyBridge";
import { createAuthorityAdapter } from "../../services/pairingAdvisor/authorityAdapter";
import { request, recommendation, reviewed } from "../pairingAdvisorOffline/fixtures";
import { harness, assessmentFor, snapshot } from "../pairingAdvisorIntegration/harness";

// Runtime dependencies are mocked BEFORE loading the real deterministic exports.
jest.mock("../../services/safetyPinService", () => new Proxy({}, {
  get: (_target, key) => key === "__esModule" ? false : () => { throw new Error("Override path forbidden"); },
}));
jest.mock("../../lib/auditLog", () => ({
  logAudit: () => { throw new Error("Audit path forbidden in scanner verification"); },
}));

const protocol = jest.requireActual("../../services/protocolEnvelope") as {
  buildGuestEnvelope: () => Record<string, unknown>;
  scanGeneratedOutput: ExistingDeterministicChecks["scanGeneratedOutput"];
};
const pureSafety = jest.requireActual("../../services/safetyProfileService") as {
  enforceSafetyProfileSync: ExistingDeterministicChecks["enforceSafetyProfileSync"];
};
const evidence = jest.requireActual("../../services/foodCompositionEvidence") as {
  requiresVerifiedIngredientEvidence: ExistingDeterministicChecks["requiresVerifiedIngredientEvidence"];
};
const alcohol = jest.requireActual("../../services/guardrails/beverageMedicalRules") as {
  containsAlcoholContent: ExistingDeterministicChecks["containsAlcoholContent"];
};
const storage = require("./storageStub.cjs") as {
  reset: () => void;
  calls: { direct: unknown[]; client: unknown[]; connects: number; inserts: number; selects: unknown[] };
};
const realProtocolScan = jest.fn(protocol.scanGeneratedOutput);
const realAlcoholDetector = jest.fn(alcohol.containsAlcoholContent);

function completeEnvelope(extra: Record<string, unknown> = {}) {
  // Real constructor provides the entire baseline contract; only synthetic identity/data are supplied.
  return { ...protocol.buildGuestEnvelope(), userId: "synthetic-owner", ...extra };
}
const checks: ExistingDeterministicChecks = {
  ...evidence, ...pureSafety,
  scanGeneratedOutput: realProtocolScan,
  containsAlcoholContent: realAlcoholDetector,
};
const bridge = createSyntheticDeterministicBridge(checks);

function enabled(extra: Record<string, unknown> = {}) {
  const h = harness();
  h.fixture.state.authority = { ...snapshot(), envelope: completeEnvelope(extra) };
  h.fixture.state.assessment = assessmentFor("consumption");
  h.fixture.deps.safety = bridge.safety;
  h.fixture.deps.resolveAuthority = createAuthorityAdapter({
    mode: "synthetic_test_only", loadOwner: h.fixture.loadOwner,
    requiresVerifiedIngredients: bridge.requiresVerifiedIngredients,
  });
  h.fixture.generate.mockImplementation(async () => {
    const response = recommendation();
    response.recommendations[0].name = "Sparkling water";
    response.recommendations[0].listEntryId = null;
    response.recommendations[0].claims = [];
    response.recommendations[0].servingAdvice = "Serve chilled.";
    response.narrative = [];
    return response;
  });
  return h;
}

beforeEach(() => storage.reset());
afterEach(() => {
  expect(storage.calls.direct).toEqual([]);
  expect(storage.calls.client).toEqual([]);
  expect(storage.calls.connects).toBe(0);
  expect(storage.calls.inserts).toBe(0);
  expect(storage.calls.selects).toEqual([]);
});

describe("1. Real ingredient gates preserve educational separation", () => {
  test.each([
    { allergies: ["peanut"] },
    { alphaGalContext: { active: true, dairyTolerance: "no", gelatinRestriction: "yes" } },
    { pregnancySupportContext: { active: true, stage: "trimester-2" } },
  ])("actual evidence requirement blocks consumption: %j", async profile => {
    const h = enabled(profile);
    const result = await h.send();
    expect(result.body.reason).toBe("INGREDIENT_EVIDENCE_REQUIRED");
    expect(h.fixture.generate).not.toHaveBeenCalled();
  });
  test("education may mention a restricted food without personal clearance or consumption scanning", async () => {
    const h = enabled({ allergies: ["milk"], dietaryIdentity: ["vegan"] });
    h.fixture.state.assessment = assessmentFor("education");
    const response = {
      version: 1, requestId: "ignored", conversationId: "ignored", contextRevision: 0, outcome: "education",
      education: {
        paragraphs: ["Cabernet and steak are a common example of tannin and protein interaction, not personal consumption advice."],
        followUps: ["Would you like an explanation of acidity?"],
      },
    };
    h.fixture.generate.mockResolvedValue(response);
    const result = await h.send();
    expect(result.body.outcome).toBe("education");
    expect(result.body).not.toHaveProperty("recommendations");
    expect(h.fixture.review).toHaveBeenCalledTimes(1);
  });
});

describe("2. Real deterministic checks and missing authority", () => {
  test("complete synthetic unrestricted owner passes real input and output checks", async () => {
    const result = await enabled().send({ body: request("Suggest a beverage for my meal.") });
    expect(result.body.outcome).toBe("recommendation");
  });
  test("pure input check rejects an explicit vegan conflict without asynchronous profile loading", async () => {
    const h = enabled({ dietaryIdentity: ["vegan"] });
    expect((await h.send({ body: request("Choose a drink made with beef stock.") })).body.outcome).toBe("restricted");
    expect(h.fixture.generate).not.toHaveBeenCalled();
  });
  test.each([
    undefined, null, {}, { userId: "guest" },
    { ...completeEnvelope(), allergies: undefined },
    { ...completeEnvelope(), glp1DailyTolerance: undefined },
    { ...completeEnvelope(), pregnancySupportContext: undefined },
    { ...completeEnvelope(), dailyNutritionState: undefined },
    { ...completeEnvelope(), glp1DailyTolerance: "not-resolved" },
  ])(
    "missing/incomplete context cannot become SAFE: %#", async context => {
      expect(await bridge.safety.checkInput(request(), context)).toBe("unavailable");
      expect(() => bridge.requiresVerifiedIngredients(context)).toThrow();
    },
  );
  test("the real clinical scanner catches a mammalian derivative in an alpha-gal fixture", () => {
    const result = protocol.scanGeneratedOutput({
      name: "Broth", description: "Contains gelatin", ingredients: [{ name: "gelatin" }],
      instructions: ["Stir."],
    }, completeEnvelope({ alphaGalContext: { active: true, dairyTolerance: "no", gelatinRestriction: "yes" } }),
    { generatorName: "pairings_ai" });
    expect(result.passed).toBe(false);
  });
});

describe("3. Every recommendation field reaches real scans", () => {
  test.each(["card", "alternative", "explanation", "serving", "narrative", "followUp"])(
    "real dietary scan rejects prohibited content in %s and withholds all related prose", async field => {
      const h = enabled({ dietaryIdentity: ["vegan"] });
      const response = recommendation();
      response.recommendations[0].name = "Sparkling water";
      response.recommendations[0].listEntryId = null;
      response.recommendations[0].claims = [];
      response.narrative = [];
      if (field === "card") response.recommendations[0].name = "Beef stock";
      if (field === "alternative") {
        response.recommendations.push({
          ...response.recommendations[0], id: "unsafe-alternative", name: "Beef stock",
        });
        response.recommendations[0].alternativeIds = ["unsafe-alternative"];
        response.narrative = [{ text: "Choose that alternative.", recommendationIds: ["unsafe-alternative"] }];
      }
      if (field === "explanation") response.recommendations[0].explanation = "Contains beef stock.";
      if (field === "serving") response.recommendations[0].servingAdvice = "Add beef stock.";
      if (field === "narrative") response.narrative = [{ text: "Serve beef stock instead.", recommendationIds: ["choice-1"] }];
      if (field === "followUp") response.followUps = [{ text: "Would you like beef stock?", recommendationIds: ["choice-1"] }];
      h.fixture.generate.mockResolvedValue(response);
      const result = await h.send();
      expect(result.body.reason).toBe("VALIDATION_FAILED");
      expect(result.body).not.toHaveProperty("recommendations");
      expect(result.body).not.toHaveProperty("narrative");
      expect(h.fixture.review).not.toHaveBeenCalled();
      expect(realProtocolScan).toHaveBeenCalled();
      expect(realProtocolScan.mock.results.some(result => result.type === "return" && result.value.passed === false)).toBe(true);
    },
  );
  test.each(["whiskey", "vodka", "rum", "beer", "wine"])("actual detector true means alcohol FOUND: %s", term => {
    expect(alcohol.containsAlcoholContent({ ingredients: [{ name: term }] })).toBe(true);
  });
  test("the adapter maps true alcohol detection to rejection, not approval", async () => {
    const h = enabled({ dietaryIdentity: ["halal"] });
    const response = recommendation();
    response.recommendations[0].name = "Sparkling water";
    response.recommendations[0].listEntryId = null;
    response.recommendations[0].claims = [];
    response.followUps = [{ text: "Would you like whiskey instead?", recommendationIds: ["choice-1"] }];
    h.fixture.generate.mockResolvedValue(response);
    expect((await h.send()).body.reason).toBe("VALIDATION_FAILED");
    expect(realAlcoholDetector).toHaveBeenCalled();
    expect(realAlcoholDetector.mock.results.some(result => result.type === "return" && result.value === true)).toBe(true);
  });
  test("a safe-variant phrase cannot mask a separate unsafe alcohol field", async () => {
    const h = enabled({ dietaryIdentity: ["halal"] });
    const response = recommendation();
    response.recommendations[0].name = "Non-alcoholic sparkling water";
    response.recommendations[0].listEntryId = null;
    response.recommendations[0].claims = [];
    response.recommendations[0].servingAdvice = "Add whiskey.";
    h.fixture.generate.mockResolvedValue(response);
    expect((await h.send()).body.reason).toBe("VALIDATION_FAILED");
  });
  test("real detector is not a blanket alcohol prohibition for unrestricted profiles", async () => {
    const detector = jest.fn(alcohol.containsAlcoholContent);
    const local = createSyntheticDeterministicBridge({ ...checks, containsAlcoholContent: detector });
    const response = recommendation();
    response.recommendations[0].listEntryId = null;
    response.recommendations[0].claims = [];
    await local.safety.scanFinal(response, completeEnvelope());
    expect(detector).not.toHaveBeenCalled();
  });
});

describe("4. Fresh owner context still governs every turn", () => {
  test("a new authoritative ingredient restriction stops the next turn before generation", async () => {
    const h = enabled();
    expect((await h.send()).body.outcome).toBe("recommendation");
    h.fixture.state.authority = { ...snapshot(), envelope: completeEnvelope({ allergies: ["peanut"] }) };
    expect((await h.send({ body: request("Something less acidic?") })).body.reason).toBe("INGREDIENT_EVIDENCE_REQUIRED");
    expect(h.fixture.loadOwner).toHaveBeenCalledTimes(2);
    expect(h.fixture.generate).toHaveBeenCalledTimes(1);
  });
});

describe("5. Real scans do not manufacture evidence", () => {
  test("passing real scanners does not authorize an invented product-suitability claim", async () => {
    const h = enabled();
    const response = recommendation();
    response.recommendations[0].name = "Sparkling water";
    response.recommendations[0].listEntryId = null;
    response.recommendations[0].claims = [{ kind: "product_suitability", evidenceId: "model-assertion" }];
    h.fixture.generate.mockResolvedValue(response);
    expect((await h.send()).body.reason).toBe("VALIDATION_FAILED");
  });
  test("a semantic review is still required; real term scans do not establish intent accuracy", async () => {
    const h = enabled();
    h.fixture.review.mockImplementation(async response => reviewed(response, { verdict: "uncertain" }));
    expect((await h.send()).body.reason).toBe("VALIDATION_FAILED");
  });
});
