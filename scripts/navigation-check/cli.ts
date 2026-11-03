import fs from "node:fs";
import path from "node:path";
import { analyze, classify, routePattern, type Reference } from "./analyze";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--json")) throw new Error("Usage: npm run validate:navigation -- [--json]");
const root = process.cwd();
const authority = "client/src/components/Router.tsx";
const roots = ["client/src", "shared/coaching", "server/services/coaching"];
function sourceFiles(directory: string): string[] {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory())
      return /^(?:__tests__|__mocks__|node_modules)$/.test(entry.name) ? [] : sourceFiles(file);
    return /\.[jt]sx?$/.test(file) && !/\.(?:test|spec|d)\.[jt]sx?$/.test(file) ? [file] : [];
  });
}
if (!fs.existsSync(path.join(root, authority))) throw new Error(`Missing route authority: ${authority}`);
const files = roots.flatMap(sourceFiles).sort();
const analyses = files.map(file => analyze(file, fs.readFileSync(path.join(root, file), "utf8"), file === authority));
const routes = analyses.flatMap(item => item.routes);
if (!routes.length) throw new Error("No registered routes found; refusing a vacuous pass.");
const invalid: Reference[] = [], matched: Reference[] = [], dynamic: Reference[] = [], nonPage: Reference[] = [];
for (const ref of analyses.flatMap(item => item.destinations)) {
  const status = classify(ref.value, routes.map(route => route.value));
  ({ invalid, matched, dynamic, "non-page": nonPage })[status].push(ref);
}
const unresolved = analyses.flatMap(item => item.unresolved);
const unsupportedRoutes = routes.filter(route => !routePattern(route.value));
const unresolvedRoutes = unresolved.filter(ref => ref.kind === "route");
const report = {
  scope: { authority, roots, files: files.length, registeredRoutes: routes.length },
  invalid, matched: matched.length, dynamic, unresolved, nonPage: nonPage.length, unsupportedRoutes,
  limitations: [
    "Source-only check. Does not prove authentication, entitlement, redirects, page availability, or working actions.",
    "Dynamic/unresolved expressions require review. They are not verified destinations.",
    "API, external, protocol-relative, and file-resource targets are outside this SPA route check.",
    "Unreferenced/dead/conditional source is included; reachability and environment gates require review.",
    "Free-form prose, runtime-generated URLs, imported values, and arbitrary custom navigation wrappers are not fully resolved.",
  ],
};
if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Navigation static check: ${files.length} files, ${routes.length} registered routes, ${matched.length} matching references.`);
  for (const ref of invalid) console.error(`INVALID ${ref.file}:${ref.line} ${ref.kind} → ${ref.value}`);
  for (const ref of [...unsupportedRoutes, ...unresolvedRoutes])
    console.error(`UNRESOLVED ROUTE ${ref.file}:${ref.line} → ${ref.value}`);
  console.log(`Review required: ${dynamic.length} parameterized references, ${unresolved.length - unresolvedRoutes.length} unresolved expressions; ${nonPage.length} non-page references excluded.`);
  console.log(report.limitations.join("\n"));
  console.log(invalid.length || unsupportedRoutes.length || unresolvedRoutes.length ? "RESULT: FAIL" : "RESULT: PASS (static literals only; review unresolved references)");
}
process.exitCode = invalid.length || unsupportedRoutes.length || unresolvedRoutes.length ? 1 : 0;
