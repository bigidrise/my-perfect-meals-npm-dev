import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer, isFileServingAllowed } from "vite";
import { PRIVATE_DEVELOPMENT_FILE_PATTERNS } from "../../config/development-artifact-privacy";
import { analyzeFile, backendIndex, dependencyClosure, digest, resolveRouteComponents, scan } from "./discovery";
import { compileRegistry, integrityErrors } from "./registry";
import { existingKnowledge } from "./knowledge";
import { requireDevelopment } from "./cli";
import type { KnowledgeFact, ScanResult, ScanState } from "./types";

const routeFile = "client/src/components/Router.tsx";
const pageFile = "client/src/pages/Example.tsx";
const cardFile = "client/src/components/ExampleCard.tsx";
const fixture = {
  [routeFile]: `import Page from "@/pages/Example"; const Guarded = () => <ProGuard component={Page}/>;
    export const Router = () => <><Route path="/example" component={Guarded}/><Route path="/admin/private" component={Guarded}/></>;`,
  [pageFile]: `import Card from "@/components/ExampleCard";
    const go = () => { setLocation("/example/details"); apiRequest("POST", "/api/example/save"); };
    export default () => <><h1>Example Feature</h1><button onClick={go}>Save example</button><Card/></>;`,
  [cardFile]: `export default () => <button disabled={loading} onClick={() => setLocation("/example")}>Open Example</button>;`,
  "server/index.ts": `import exampleRouter from "./routes/example"; app.use("/api/example", exampleRouter);`,
  "server/routes/example.ts": `router.post("/save", requireAuth, requireProAccess, async () => {});`,
};
const fact: KnowledgeFact = {
  id: "example", name: "Example Feature", description: "A reviewed example workflow.", aliases: ["Example"],
  route: "/example", access: "Pro; existing authorization required.", audience: "member", availability: "available",
  reviewed: true, limitations: ["Never executes from chat."], workflows: ["Review before saving."],
  sources: [{ file: pageFile, line: 1 }],
};
function analyzed(sources: Record<string, string> = fixture): ScanResult {
  const known = new Set(Object.keys(sources));
  return { files: Object.fromEntries(Object.entries(sources).map(([file, text]) => [file, analyzeFile(file, text, known)])),
    entrypoints: { client: [routeFile], developmentServer: ["server/index.ts"], productionServer: [], evidence: [] },
    changedFiles: Object.keys(sources).sort(), removedFiles: [], parsedFiles: known.size, reusedFiles: 0 };
}
function state(result: ReturnType<typeof compileRegistry>, input = analyzed()): ScanState {
  return { schemaVersion: 1, analyzerFingerprint: "fixture", files: input.files, records: result.states };
}

test("discovers registered routes through a guarded component without granting access", () => {
  const input = analyzed(), resolved = resolveRouteComponents(input.files[routeFile], ["Guarded"]);
  assert.deepEqual(resolved.pages, [pageFile]);
  assert.ok(resolved.guards.includes("ProGuard"));
  const record = compileRegistry(input, [fact]).registry.features.find(item => item.id === "feature:example")!;
  assert.equal(record.verification, "verified");
  assert.equal(record.verificationScope, "source_backed_documentation_only");
  assert.equal(record.access.authoritativeAtRuntime, true);
  assert.ok(record.access.observedGuards.includes("ProGuard"));
});

test("discovers actual click-handler effects and controls in rendered card components", () => {
  const result = compileRegistry(analyzed(), [fact]);
  const record = result.registry.features.find(item => item.id === "feature:example")!;
  const save = record.controls.find(control => control.label === "Save example")!;
  assert.deepEqual(save.destinations, ["/example/details"]);
  assert.deepEqual(save.requests, ["/api/example/save"]);
  assert.equal(record.controls.find(control => control.label === "Open Example")!.disabledState, "conditional");
  assert.ok(record.backendEvidence.some(endpoint => endpoint.path === "/api/example/save" && endpoint.match === "exact"));
});

test("does not infer a capability or official description from a tempting button label", () => {
  const source = { ...fixture, [pageFile]: `export default () => <><h1>Example Feature</h1><button>Diagnose every disease</button></>;` };
  const page = compileRegistry(analyzed(source), []).registry.features.find(item => item.route === "/example")!;
  assert.equal(page.description, null);
  assert.equal(page.verification, "unverified");
  assert.ok(page.gaps.includes("missing_description"));
  assert.equal(page.controls[0].requests.length, 0);
});

test("keeps dynamic labels and routes unresolved instead of guessing", () => {
  const file = analyzeFile(pageFile, `<><Route path={userRoute} component={Thing}/><button>{t("save")}</button></>`, new Set());
  assert.equal(file.unresolvedRoutes.length, 1);
  assert.equal(file.controls[0].label, null);
});

test("resolves lazy page imports and preserves source lines", () => {
  const text = `const Lazy = lazy(() => import("../pages/Example"));\n<Route path="/example" component={Lazy}/>;`;
  const file = analyzeFile(routeFile, text, new Set([routeFile, pageFile]));
  assert.deepEqual(resolveRouteComponents(file, ["Lazy"]).pages, [pageFile]);
  assert.equal(file.routes[0].source.line, 2);
});

test("excludes admin/debug/test navigation from generated feature records", () => {
  const output = compileRegistry(analyzed(), [fact]);
  assert.equal(output.coverage.summary.excludedInternalRouteDeclarations, 1);
  assert.ok(output.registry.features.every(record => !record.route?.startsWith("/admin")));
  assert.equal(output.registry.audience, "engineering_only");
  assert.equal(output.registry.runtimeIntegration, "not_connected");
});

test("distinguishes clinical and organization boundaries without inventing entitlements", () => {
  const clinical = { ...fact, access: "Physician-controlled Clinical access; exact relationship and consent." };
  const record = compileRegistry(analyzed(), [clinical]).registry.features.find(item => item.kind === "feature")!;
  assert.equal(record.access.documented, clinical.access);
  assert.equal(record.access.authoritativeAtRuntime, true);
  assert.equal(record.audience, "member");
  assert.deepEqual(record.limitations, clinical.limitations);
});

test("retains disabled/Coming Soon status from existing metadata, not labels", () => {
  const output = compileRegistry(analyzed(), [{ ...fact, availability: "coming_soon" }]);
  assert.equal(output.registry.features.find(record => record.kind === "feature")!.availability, "coming_soon");
});

test("reports obsolete routes, missing evidence and alias ambiguity", () => {
  const missing = { ...fact, id: "old", route: "/removed", sources: [{ file: "client/src/pages/Missing.tsx", line: 1 }] };
  const output = compileRegistry(analyzed(), [fact, missing]);
  const old = output.registry.features.find(item => item.id === "feature:old")!;
  assert.equal(old.verification, "contradictory");
  assert.ok(old.gaps.includes("knowledge_route_not_registered"));
  assert.ok(old.gaps.includes("source_reference_missing"));
  assert.ok(output.coverage.aliasCollisions.length > 0);
});

test("backend tracing differentiates mounted exact routes from unresolved suffixes", () => {
  const files = analyzed().files, api = backendIndex(files);
  assert.ok(api.some(endpoint => endpoint.path === "/api/example/save" && endpoint.match === "exact"));
  delete files["server/index.ts"];
  assert.ok(backendIndex(files).some(endpoint => endpoint.path === "/save" && endpoint.match === "suffix_only"));
});

test("does not mistake server-side HTTP clients for registered endpoints", () => {
  const file = analyzeFile("server/service.ts", `axios.get("/api/private"); router.get("/ok", requireAuth, handler);`, new Set());
  assert.deepEqual(file.api.map(endpoint => endpoint.path), ["/ok"]);
});

test("unmounted root routes cannot create false backend evidence for every feature", () => {
  const source = { ...fixture, "server/routes/unmounted.ts": `router.get("/", handler); router.get("/:id", handler);` };
  const output = compileRegistry(analyzed(source), [fact]);
  const record = output.registry.features.find(item => item.id === "feature:example")!;
  assert.ok(record.backendEvidence.every(endpoint => endpoint.source.file !== "server/routes/unmounted.ts"));
});

test("an unrelated dashboard card heading cannot become the official page name", () => {
  const source = { ...fixture, [pageFile]: `<div><h3>My Perfect Menu</h3><h2>Special Offer</h2></div>;` };
  const page = compileRegistry(analyzed(source), []).registry.features.find(item => item.id === "page:/example")!;
  assert.equal(page.name, null);
  assert.ok(page.gaps.includes("missing_official_name"));
});

test("multiple primary titles remain ambiguous rather than choosing a conditional branch", () => {
  const source = { ...fixture, [pageFile]: `<div>{condition ? <h1>First Page</h1> : <h1>Second Page</h1>}</div>;` };
  const page = compileRegistry(analyzed(source), []).registry.features.find(item => item.id === "page:/example")!;
  assert.equal(page.name, null);
  assert.ok(page.gaps.includes("ambiguous_page_title"));
});

test("internal navigation controls remain withheld even if imported on a member page", () => {
  const source = { ...fixture, [pageFile]: `<><h1>Example</h1><button onClick={() => setLocation("/admin/private")}>Open admin</button></>;` };
  const page = compileRegistry(analyzed(source), []).registry.features.find(item => item.id === "page:/example")!;
  assert.equal(page.controls.length, 0);
});

test("shared frontend dependencies and mounted backend edits invalidate affected features", () => {
  const original = analyzed(), prior = compileRegistry(original, [fact]);
  const changed = analyzed({ ...fixture, [cardFile]: fixture[cardFile] + "\n// changed implementation" });
  changed.changedFiles = [cardFile];
  const next = compileRegistry(changed, [fact], state(prior));
  assert.ok(dependencyClosure(changed.files, [pageFile]).includes(cardFile));
  assert.ok(next.coverage.incremental.affected.includes("feature:example"));
  assert.equal(next.registry.features.find(item => item.id === "feature:example")!.verification, "stale");
  const repeated = compileRegistry(changed, [fact], state(next, changed));
  assert.equal(repeated.registry.features.find(item => item.id === "feature:example")!.verification, "stale");
  const backendChanged = analyzed({ ...fixture,
    "server/routes/example.ts": fixture["server/routes/example.ts"] + "\n// updated backend implementation" });
  backendChanged.changedFiles = ["server/routes/example.ts"];
  const backendResult = compileRegistry(backendChanged, [fact], state(prior));
  assert.ok(backendResult.coverage.incremental.affected.includes("feature:example"));
  assert.equal(backendResult.registry.features.find(item => item.id === "feature:example")!.verification, "stale");
});

test("updated existing knowledge replaces stale descriptions without a second manual registry", () => {
  const first = compileRegistry(analyzed(), [fact]);
  const changed = analyzed({ ...fixture, [pageFile]: fixture[pageFile] + "\n// implementation updated" });
  const stale = compileRegistry(changed, [fact], state(first));
  const refreshed = compileRegistry(changed, [{ ...fact, description: "Updated reviewed workflow." }], state(stale, changed));
  assert.equal(refreshed.registry.features.find(item => item.id === "feature:example")!.verification, "verified");
});

test("identical source produces byte-stable registry and no modified records", () => {
  const input = analyzed(), first = compileRegistry(input, [fact]);
  const second = compileRegistry({ ...input, changedFiles: [] }, [fact], state(first));
  assert.equal(JSON.stringify(first.registry), JSON.stringify(second.registry));
  assert.deepEqual(second.coverage.incremental.modified, []);
});

test("detects removed and newly introduced records", () => {
  const input = analyzed(), first = compileRegistry(input, [fact]);
  const updated = analyzed({ ...fixture, [routeFile]: `import Page from "@/pages/Example"; <Route path="/new" component={Page}/>;` });
  const output = compileRegistry(updated, [], state(first));
  assert.ok(output.coverage.incremental.removed.includes("feature:example"));
  assert.ok(output.coverage.incremental.added.includes("page:/new"));
});

test("cache reparses changed files and newly resolvable imports, not the whole codebase", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "feature-discovery-"));
  const write = (file: string, text: string) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  try {
    write(pageFile, `import New from "./New"; export default () => <New/>;`);
    write(cardFile, fixture[cardFile]);
    write("client/src/__tests__/secret.test.ts", `"not scanned"`);
    write("client/src/.env", "NEVER_READ_THIS=secret");
    const first = scan(root, "cache");
    const snapshot: ScanState = { schemaVersion: 1, analyzerFingerprint: "cache", files: first.files, records: {} };
    const second = scan(root, "cache", snapshot);
    assert.equal(second.parsedFiles, 0);
    assert.equal(second.reusedFiles, 2);
    write("client/src/pages/New.tsx", "export default () => <h1>New</h1>;");
    const third = scan(root, "cache", snapshot);
    assert.equal(third.parsedFiles, 2);
    assert.equal(third.reusedFiles, 1);
    assert.ok(third.files[pageFile].dependencies.includes("client/src/pages/New.tsx"));
    fs.unlinkSync(path.join(root, cardFile));
    const removed = scan(root, "cache", { ...snapshot, files: third.files });
    assert.ok(removed.removedFiles.includes(cardFile));
    assert.ok(Object.keys(removed.files).every(file => !file.includes("secret") && !file.includes(".env")));
    assert.equal(scan(root, "different-analyzer", snapshot).reusedFiles, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("ignores symlinked source files and cyclic dependency graphs terminate", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "feature-discovery-"));
  try {
    fs.mkdirSync(path.join(root, "client/src"), { recursive: true });
    fs.symlinkSync("/etc/passwd", path.join(root, "client/src/outside.ts"));
    assert.equal(Object.keys(scan(root, "fixture").files).length, 0);
    const files = analyzed().files;
    files[pageFile].dependencies.push(cardFile); files[cardFile].dependencies.push(pageFile);
    assert.equal(dependencyClosure(files, [pageFile]).length, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("integrity rejects duplicate identities, unsafe sources and internal routes", () => {
  const output = compileRegistry(analyzed(), [fact]).registry;
  assert.deepEqual(integrityErrors(output), []);
  const duplicate = structuredClone(output); duplicate.features.push(duplicate.features[0]);
  assert.ok(integrityErrors(duplicate).some(error => error.includes("Duplicate")));
  const unsafe = structuredClone(output); unsafe.features[0].sources = [{ file: "../../.env", line: 0 }];
  assert.ok(integrityErrors(unsafe).some(error => error.includes("Unsafe")));
  const internal = structuredClone(output); internal.features[0].route = "/admin/private";
  assert.ok(integrityErrors(internal).some(error => error.includes("Internal")));
});

test("Development guard refuses Production, test and unspecified environments", () => {
  assert.doesNotThrow(() => requireDevelopment("development"));
  for (const environment of ["production", "test", undefined]) assert.throws(() => requireDevelopment(environment));
});

test("real Vite file-serving policy blocks engineering reports while retaining existing secret protection", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "feature-privacy-"));
  const write = (relative: string) => {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, "{}"); return full;
  };
  const report = write("generated-artifacts/feature-intelligence/registry.json");
  const analyzer = write("scripts/feature-intelligence/cli.ts");
  const secret = write(".env.private"), allowed = write("client/public/allowed.txt");
  const vite = await createServer({ configFile: false, root: path.join(root, "client"), logLevel: "silent",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, fs: { allow: [root], deny: PRIVATE_DEVELOPMENT_FILE_PATTERNS } } });
  try {
    for (const file of [report, analyzer, secret]) assert.equal(isFileServingAllowed(file, vite), false);
    assert.equal(isFileServingAllowed(allowed, vite), true);
    for (const file of ["vite.config.ts", "client/vite.config.ts"])
      assert.ok(fs.readFileSync(file, "utf8").includes("deny: PRIVATE_DEVELOPMENT_FILE_PATTERNS"));
    assert.ok(fs.readFileSync("server/vite.ts", "utf8").includes("fs: viteConfig.server?.fs"));
  } finally { await vite.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("existing source catalogs load offline without calling fetch or a model", () => {
  const environment = process.env.NODE_ENV, fetch = globalThis.fetch;
  process.env.NODE_ENV = "development";
  globalThis.fetch = () => { throw new Error("Network forbidden"); };
  try {
    const facts = existingKnowledge(process.cwd());
    assert.ok(facts.some(item => item.id === "sushi_creator" && item.name === "Sushi Creator"));
    assert.ok(facts.some(item => item.id === "product_scan"));
    assert.ok(facts.every(item => item.sources.length > 0 && item.access.length > 0));
  } finally { if (environment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = environment; globalThis.fetch = fetch; }
});

test("Ask Chef self-purpose is not invented from its button; missing identity knowledge is flagged", () => {
  const sources = { ...fixture, [pageFile]: `export default () => <><h1>Ask Chef</h1><button>Open Ask Chef</button></>;` };
  const page = compileRegistry(analyzed(sources), []).registry.features.find(record => record.id === "page:/example")!;
  assert.equal(page.name, "Ask Chef");
  assert.equal(page.description, null);
  assert.ok(page.gaps.includes("missing_description"));
  // The approved next-stage test must connect a reviewed self-purpose fact and
  // assert "What do you do?" explains Ask Chef, never defaults to shopping tools.
});

test("watch mode refreshes a temporary source tree without an application server", { timeout: 20000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "feature-watch-"));
  for (const [file, text] of Object.entries(fixture)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  const priorEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const child = spawn(process.execPath, ["--import", import.meta.resolve("tsx"),
    fileURLToPath(new URL("./cli.ts", import.meta.url)), "--watch"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  if (priorEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorEnvironment;
  let output = "";
  child.stdout.on("data", chunk => { output += chunk.toString(); });
  child.stderr.on("data", chunk => { output += chunk.toString(); });
  const waitFor = async (predicate: () => boolean) => {
    const deadline = Date.now() + 10000;
    while (!predicate()) {
      if (Date.now() > deadline || child.exitCode !== null) throw new Error(`Watch did not refresh: ${output}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  };
  try {
    await waitFor(() => output.includes("Watching source changes offline"));
    fs.writeFileSync(path.join(root, pageFile), fixture[pageFile].replace("Example Feature", "Updated Feature"));
    await waitFor(() => (output.match(/Feature Intelligence:/g) ?? []).length >= 2);
    const registry = JSON.parse(fs.readFileSync(path.join(root, "generated-artifacts/feature-intelligence/registry.json"), "utf8"));
    assert.equal(registry.features.find((record: { id: string }) => record.id === "page:/example").name, "Updated Feature");
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>(resolve => { if (child.exitCode !== null) resolve(); else child.once("exit", () => resolve()); });
    fs.rmSync(root, { recursive: true, force: true });
  }
});
