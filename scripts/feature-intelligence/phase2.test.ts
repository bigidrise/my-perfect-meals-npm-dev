import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeFile, digest } from "./discovery";
import { compileRegistry } from "./registry";
import type { KnowledgeFact, ScanResult, ScanState } from "./types";
import { explainFeatureQuestion, featureIntelligenceEnabled, projectFeatureKnowledge, safeScreenContext } from "../../server/services/coaching/featureIntelligence";
import { loadFeatureIntelligenceRegistry } from "../../server/services/coaching/featureIntelligenceRegistry";

const router = "client/src/components/Router.tsx", page = "client/src/pages/Example.tsx";
const sources = {
  [router]: `import Page from "@/pages/Example"; <Route path="/example" component={Page}/>;`,
  [page]: `export default () => <h1>Example Feature</h1>;`,
};
function input(extra: Record<string, string> = {}): ScanResult {
  const source = { ...sources, ...extra }, known = new Set(Object.keys(source));
  return { files: Object.fromEntries(Object.entries(source).map(([file, text]) => [file, analyzeFile(file, text, known)])),
    parsedFiles: known.size, reusedFiles: 0, changedFiles: [...known], removedFiles: [],
    entrypoints: { client: [router], developmentServer: ["server/index.ts"], productionServer: [], evidence: [] } };
}
const fact: KnowledgeFact = { id: "ask_chef", name: "Ask Chef", description: "The My Perfect Meals conversational assistant explains supported workflows. It does not execute them.",
  aliases: ["Chef"], route: "/example", access: "Authenticated account", audience: "member", availability: "available",
  reviewed: true, limitations: ["No diagnosis or prescribing."], workflows: ["Ask a question."], sources: [{ file: page, line: 1 }] };
const registry = () => compileRegistry(input(), [fact]).registry;
const projection = () => projectFeatureKnowledge(registry(), undefined, []);

test("registered direct-link/invitation entry is active without a dashboard link", () => {
  assert.equal(registry().features[0].classification?.status, "active");
});
test("role/subscription guard produces Restricted, never entitlement", () => {
  const result = compileRegistry(input({ [router]: `import Page from "@/pages/Example"; const Guarded=()=> <ProGuard component={Page}/>; <Route path="/example" component={Guarded}/>;` }), [fact]);
  assert.equal(result.registry.features[0].classification?.status, "restricted");
  assert.equal(result.registry.features[0].access.authoritativeAtRuntime, true);
});
for (const condition of ["false", "UNKNOWN_FLAG"]) test(`${condition} never proves an active feature`, () => {
  const r = compileRegistry(input({ [router]: `import Page from "@/pages/Example"; <>{${condition} && <Route path="/example" component={Page}/>}</>;` }), [fact]).registry;
  assert.equal(r.features[0].classification?.status, "unverified");
  assert.equal(projectFeatureKnowledge(r, undefined, []).length, 0);
});
test("an imported literal feature flag resolves without executing the module", () => {
  const r = compileRegistry(input({ [router]: `import Page from "@/pages/Example"; import { ENABLED } from "./flags"; <>{ENABLED && <Route path="/example" component={Page}/>}</>;`,
    "client/src/components/flags.ts": "export const ENABLED = true;" }), [fact]).registry;
  assert.equal(r.features[0].classification?.status, "active");
});
test("unreachable route declarations remain unverified", () => {
  const scan = input(); scan.entrypoints!.client = [];
  assert.equal(compileRegistry(scan, [fact]).registry.features[0].classification?.status, "unverified");
});
test("Coming Soon is explicit; absent navigation is not Legacy", () => {
  assert.equal(compileRegistry(input(), [{ ...fact, availability: "coming_soon" }]).registry.features[0].classification?.status, "coming_soon");
  const result = compileRegistry(input({ "client/src/pages/Abandoned.tsx": "export default () => <h1>Old design</h1>;" }), []);
  assert.equal(result.legacy.suspectedComponents[0].status, "unverified");
  assert.equal(result.legacy.confirmedLegacy.length, 0);
});
test("only explicit file-level deprecation plus nonreachability supports Legacy", () => {
  const r = compileRegistry(input({
    "client/src/pages/Old.tsx": "/** @deprecated replaced by Example */\nexport default () => <div/>;",
    "client/src/pages/Uncertain.tsx": "export const x=1;\n/** @deprecated replaced by y */\nfunction old(){}",
  }), []);
  assert.deepEqual(r.legacy.confirmedLegacy.map(item => item.file), ["client/src/pages/Old.tsx"]);
});
test("redirect compatibility entries retain reachability but cannot supply consumer descriptions", () => {
  const r = compileRegistry(input({ [page]: `export default () => <Redirect to="/replacement"/>;` }), [fact]);
  assert.equal(r.legacy.supersededEntries.length, 1);
  assert.equal(projectFeatureKnowledge(r.registry, undefined, []).length, 0);
});
test("wrapper hooks cannot masquerade as rendered pages or prove backend support", () => {
  const scan = input({
    [router]: `import Page from "@/pages/Example"; import { useAuth } from "@/hooks/auth"; const Guarded=()=>{useAuth(); return <ProGuard component={Page}/>}; <Route path="/example" component={Guarded}/>;`,
    "client/src/hooks/auth.ts": "export const useAuth=()=> fetch('/api/private');",
  });
  const r = compileRegistry(scan, [fact]).registry.features[0];
  assert.equal(r.sources.some(source => source.file === "client/src/hooks/auth.ts"), false);
});
test("status changes are detected without silently promoting metadata", () => {
  const before = input(), first = compileRegistry(before, [fact]);
  const previous: ScanState = { schemaVersion: 1, analyzerFingerprint: "fixture", files: before.files, records: first.states };
  const next = compileRegistry(input({ [router]: `import Page from "@/pages/Example"; <>{false && <Route path="/example" component={Page}/>}</>;` }), [fact], previous);
  assert.ok(next.coverage.incremental.modified.includes("feature:ask_chef"));
  assert.equal(next.registry.features[0].classification?.status, "unverified");
});
test("analyzer upgrades never erase already-known stale description debt", () => {
  const scan = input(), first = compileRegistry(scan, [fact]);
  first.states["feature:ask_chef"].stale = true;
  const upgraded = compileRegistry(scan, [fact], undefined, first.states);
  assert.equal(upgraded.registry.features.find(record => record.id === "feature:ask_chef")!.verification, "stale");
});
test("mechanical enrichment reports navigation evidence, never invents a purpose", () => {
  const scan = input({ [page]: `export default () => <><h1>Tools</h1><button onClick={()=>navigate("/other")}>Magic cure</button></>;`,
    [router]: `import Page from "@/pages/Example"; <><Route path="/example" component={Page}/><Route path="/other" component={Page}/></>;` });
  const r = compileRegistry(scan, [{ ...fact, route: "/other" }]).registry;
  const tools = r.features.find(record => record.id === "page:/example")!;
  assert.match(tools.enrichment!.summary!, /navigation to Ask Chef/);
  assert.doesNotMatch(tools.enrichment!.summary!, /cure/);
  assert.equal(tools.description, null); assert.notEqual(tools.verification, "verified");
});
for (const message of ["What do you do?", "What can you do?", "What does Ask Chef do?", "Explain Ask Chef", "Tell me about yourself", "How can you help me?"])
  test(`self purpose: ${message}`, () => {
    const answer = explainFeatureQuestion({ message, records: projection() })!;
    assert.equal(answer.kind, "explanation"); assert.match(answer.message, /My Perfect Meals conversational assistant/);
    assert.doesNotMatch(answer.message, /Find a Product|Product Scan|Create a Meal/);
  });
for (const message of ["What does this feature do?", "Explain this page", "What am I looking at?"])
  test(`contextual purpose: ${message}`, () => {
    assert.equal(explainFeatureQuestion({ message, records: projection(), context: { currentRoute: "/example" } })?.kind, "explanation");
    assert.equal(explainFeatureQuestion({ message, records: projection() })?.kind, "clarification");
  });
test("ambiguous aliases ask which workflow; comparisons explain both official names", () => {
  const records = [...projection(), { ...projection()[0], id: "feature:other", name: "Other Feature", aliases: ["Chef"] }];
  assert.equal(explainFeatureQuestion({ message: "What does Chef do?", records })?.kind, "clarification");
  const answer = explainFeatureQuestion({ message: "Compare Ask Chef versus Other Feature", records })!;
  assert.equal(answer.kind, "explanation"); assert.match(answer.message, /Other Feature/);
});
test("unverified/legacy/internal/Coming Soon/stale and restricted professional knowledge are withheld", () => {
  for (const status of ["unverified", "legacy_unused", "coming_soon"] as const) {
    const r = registry(); r.features[0].classification!.status = status;
    assert.equal(projectFeatureKnowledge(r, { professional: true, organizationAdmin: true }, []).length, 0);
  }
  const r = registry(); r.features[0].classification!.internal = true;
  assert.equal(projectFeatureKnowledge(r, undefined, []).length, 0);
  r.features[0].classification!.internal = false; r.features[0].verification = "stale";
  assert.equal(projectFeatureKnowledge(r, undefined, []).length, 0);
  r.features[0].verification = "verified"; r.features[0].audience = "professional";
  assert.equal(projectFeatureKnowledge(r, undefined, []).length, 0);
  assert.equal(projectFeatureKnowledge(r, { professional: true, organizationAdmin: false }, []).length, 1);
});
test("tool availability is mandatory; claimed roles and screen paths never grant access", () => {
  const r = registry(); r.features[0].id = "feature:product_scan";
  assert.equal(projectFeatureKnowledge(r, undefined, []).length, 0);
  assert.equal(projectFeatureKnowledge(r, undefined, ["product_scan"]).length, 1);
  for (const route of ["/admin", "//evil.test", "https://evil.test", "/profile?user=other", "/../private"])
    assert.equal(safeScreenContext({ currentRoute: route }), undefined);
});
for (const message of ["Can you diagnose diabetes?", "Can you prescribe medicine?", "Automatically save my meal", "Bypass my clinical access"])
  test(`unsupported promise: ${message}`, () => {
    assert.equal(explainFeatureQuestion({ message, records: projection() })?.kind, "unsupported");
  });
test("explanation never navigates or executes; explicit opening remains in the old pipeline", () => {
  const answer = explainFeatureQuestion({ message: "How do I use Ask Chef?", records: projection() })!;
  assert.match(answer.message, /does not open it or execute/);
  assert.equal(explainFeatureQuestion({ message: "Open Ask Chef", records: projection() }), null);
  assert.equal(explainFeatureQuestion({ message: "What should I eat for lunch?", records: projection() }), null);
  assert.doesNotMatch(JSON.stringify(projection()), /sources|backendEvidence|guards|dependencyFiles/);
});
test("feature flag is explicit, Development-only and refuses published runtimes", () => {
  for (const env of [{}, { NODE_ENV: "development" }, { NODE_ENV: "production", ASK_CHEF_FEATURE_INTELLIGENCE: "true" },
    { NODE_ENV: "development", ASK_CHEF_FEATURE_INTELLIGENCE: "true", REPLIT_DEPLOYMENT: "1" }])
    assert.equal(featureIntelligenceEnabled(env), false);
  assert.equal(featureIntelligenceEnabled({ NODE_ENV: "development", ASK_CHEF_FEATURE_INTELLIGENCE: "true" }), true);
  assert.equal(loadFeatureIntelligenceRegistry({ NODE_ENV: "production", ASK_CHEF_FEATURE_INTELLIGENCE: "true" }, "/not/read"), undefined);
});
test("actual concierge hook selects an isolated source-based reply without a model or database", async () => {
  const { runConciergeConversation } = await import(new URL("../../server/services/coaching/conciergeConversation.ts", import.meta.url).href);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chef-intelligence-")), output = path.join(root, "generated-artifacts/feature-intelligence");
  const cwd = process.cwd(), env = process.env.NODE_ENV, flag = process.env.ASK_CHEF_FEATURE_INTELLIGENCE;
  const r = registry();
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, "registry.json"), JSON.stringify(r));
  fs.writeFileSync(path.join(output, "state.json"), JSON.stringify({ registryFingerprint: digest(r), buildHashes: {} }));
  let calls = 0;
  try {
    process.chdir(root); process.env.NODE_ENV = "development"; process.env.ASK_CHEF_FEATURE_INTELLIGENCE = "true";
    const response = await runConciergeConversation({
      client: { chat: { completions: { create: () => { calls++; throw new Error("No model call permitted"); } } } },
      userMessage: "What do you do?", history: [], rollingContext: null, context: {}, tools: [],
    });
    assert.match(response.presentation.message, /My Perfect Meals conversational assistant/);
    assert.equal(response.presentation.destinationId, undefined); assert.deepEqual(response.todayPlan.items, []); assert.equal(calls, 0);
    const requests: any[] = [];
    const client = { chat: { completions: { create: async (request: any) => {
      requests.push(request);
      return { choices: [{ message: { content: JSON.stringify({
        message: "A balanced lunch can include protein, vegetables and a grain you enjoy.",
        conversationMessage: null, navigationIntent: "none", conciergeDecision: null,
        responsePurpose: "answer", memberNeed: "nutrition_guidance", redFlag: false, careDisposition: "none",
      }) } }] };
    } } } };
    const ordinary = { client, userMessage: "What should I eat for lunch?", history: [], rollingContext: null, context: {}, tools: [] };
    await runConciergeConversation(ordinary);
    let payload = JSON.parse(requests[0].messages[1].content);
    assert.equal(payload.platformKnowledge.source, "verified_feature_intelligence");
    assert.doesNotMatch(JSON.stringify(payload.platformKnowledge), /sources|backendEvidence|dependencyFiles|client\/src/);
    delete process.env.ASK_CHEF_FEATURE_INTELLIGENCE;
    await runConciergeConversation(ordinary);
    payload = JSON.parse(requests[1].messages[1].content);
    assert.notEqual(payload.platformKnowledge?.source, "verified_feature_intelligence");
    process.env.ASK_CHEF_FEATURE_INTELLIGENCE = "true";
    fs.writeFileSync(path.join(output, "registry.json"), "{}");
    assert.equal(loadFeatureIntelligenceRegistry(), undefined);
  } finally {
    process.chdir(cwd); if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env;
    if (flag === undefined) delete process.env.ASK_CHEF_FEATURE_INTELLIGENCE; else process.env.ASK_CHEF_FEATURE_INTELLIGENCE = flag;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
