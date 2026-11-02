import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { digest, scan } from "./discovery";
import { existingKnowledge } from "./knowledge";
import { compileRegistry, integrityErrors, markdownReport } from "./registry";
import type { ScanState } from "./types";

export function requireDevelopment(environment: string | undefined) {
  if (environment !== "development") throw new Error("Feature Intelligence is offline Development-only. Run with NODE_ENV=development.");
}

export function run(root: string) {
  requireDevelopment(process.env.NODE_ENV);
  const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
  const analyzerFingerprint = digest(fs.readdirSync(toolDirectory).filter(file => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .sort().map(file => [file, fs.readFileSync(path.join(toolDirectory, file), "utf8")]));
  const output = path.join(root, "generated-artifacts/feature-intelligence");
  for (const candidate of [path.dirname(output), output, path.join(output, "state.json")]) {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isSymbolicLink())
      throw new Error("Refusing a symlinked output or state path.");
  }
  const statePath = path.join(output, "state.json");
  let previous: ScanState | undefined;
  if (fs.existsSync(statePath)) {
    previous = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if (previous?.schemaVersion !== 1 || !previous.files || !previous.records ||
        typeof previous.analyzerFingerprint !== "string") throw new Error("Invalid state cache; move it aside and regenerate explicitly.");
  }
  const discovered = scan(root, analyzerFingerprint, previous);
  // Analyzer changes establish a new structural baseline, not fictitious product drift.
  const comparison = previous?.analyzerFingerprint === analyzerFingerprint ? previous : undefined;
  const result = compileRegistry(discovered, existingKnowledge(root), comparison,
    comparison ? undefined : previous?.records);
  const errors = integrityErrors(result.registry);
  if (errors.length) throw new Error("Registry integrity failed:\n" + errors.join("\n"));
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  function save(name: string, value: unknown, plain = false) {
    const target = path.join(output, name), temporary = target + ".tmp";
    if (fs.existsSync(temporary) && fs.lstatSync(temporary).isSymbolicLink()) throw new Error("Refusing symlinked temporary file.");
    fs.writeFileSync(temporary, plain ? String(value) : JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
    fs.renameSync(temporary, target);
  }
  save("registry.json", result.registry);
  save("coverage.json", result.coverage);
  save("coverage.md", markdownReport(result), true);
  save("legacy-unused.json", result.legacy);
  save("legacy-unused.md", [
    "# Legacy and Unused Feature Report",
    "Development source evidence only. No deletion, archive or access authority.",
    "Missing dashboard navigation is never proof that a feature is unused.",
    `Explicitly superseded unreachable modules: ${result.legacy.confirmedLegacy.length}`,
    `Suspected/unverified unreachable components: ${result.legacy.suspectedComponents.length}`,
    `Redirect/compatibility entries (preserve legitimate direct links): ${result.legacy.supersededEntries.length}`,
    `Obsolete knowledge routes requiring review: ${result.legacy.obsoleteKnowledgeRoutes.length}`,
    "See legacy-unused.json for classifications, replacement destinations, source references and entry points.",
  ].join("\n") + "\n", true);
  const buildHashes = Object.fromEntries(["client/index.html", "package.json", "vite.config.ts", "client/vite.config.ts", ".replit"]
    .filter(file => fs.existsSync(path.join(root, file))).map(file => [file, digest(fs.readFileSync(path.join(root, file), "utf8"))]));
  save("state.json", { schemaVersion: 1, analyzerFingerprint, files: discovered.files, records: result.states,
    registryFingerprint: digest(result.registry), buildHashes } satisfies ScanState);
  const summary = result.coverage.summary;
  console.log(`Feature Intelligence: ${summary.featureRecords} documented feature records; ${summary.pageRecords} registered pages; ${summary.discoveredControls} control observations.`);
  console.log(`Parsed ${discovered.parsedFiles}; reused ${discovered.reusedFiles}; integrity PASS. Reports: generated-artifacts/feature-intelligence/`);
  console.log(`Coverage: ${JSON.stringify(summary.verification)}. These reports do not authorize or publish any feature.`);
  console.log(`Classification: ${JSON.stringify(summary.classifications)}. Reviewed descriptions: ${summary.reviewedDescriptions}; structural summaries (not verified purpose): ${summary.structuralSummaries}.`);
  if (result.coverage.aliasCollisions.length || result.legacy.obsoleteKnowledgeRoutes.length || !discovered.entrypoints?.client.length)
    console.warn(`Coverage warning: ${result.coverage.aliasCollisions.length} ambiguous aliases; ${result.legacy.obsoleteKnowledgeRoutes.length} obsolete knowledge routes; client build entry ${discovered.entrypoints?.client.length ? "resolved" : "UNRESOLVED"}.`);
  return result;
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--check", "--strict", "--watch"].includes(arg))) throw new Error("Supported arguments: --check, --strict, --watch.");
  requireDevelopment(process.env.NODE_ENV);
  const root = process.cwd();
  const execute = () => {
    const result = run(root);
    if (args.includes("--strict") && result.registry.features.some(feature => feature.verification !== "verified" || feature.gaps.length))
      throw new Error("Strict coverage failed. Review coverage.json; no unverified facts were published.");
  };
  execute();
  if (!args.includes("--watch")) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const refreshed = spawnSync(process.execPath, [
        "--import", import.meta.resolve("tsx"), fileURLToPath(import.meta.url),
        "--check", ...(args.includes("--strict") ? ["--strict"] : []),
      ], { cwd: root, stdio: "inherit" });
      if (refreshed.error || refreshed.status !== 0)
        console.error("Feature Intelligence refresh failed; see the diagnostic above. No runtime data was changed.");
    }, 500);
  };
  const watchers = ["client/src", "server", "shared", "scripts/feature-intelligence"].filter(dir => fs.existsSync(path.join(root, dir)))
    .map(dir => fs.watch(path.join(root, dir), { recursive: true }, () => {
      refresh();
    }));
  for (const [dir, names] of [[root, ["package.json", "vite.config.ts", ".replit"]],
    [path.join(root, "client"), ["index.html", "vite.config.ts"]]] as const) {
    if (fs.existsSync(dir)) watchers.push(fs.watch(dir, (_event, file) => {
      if (file && (names as readonly string[]).includes(file.toString())) refresh();
    }));
  }
  const stop = () => { if (timer) clearTimeout(timer); watchers.forEach(watcher => watcher.close()); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  console.log("Watching source changes offline; no application workflow or runtime integration was added.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : "Feature Intelligence failed.");
    process.exitCode = 1;
  }
}
