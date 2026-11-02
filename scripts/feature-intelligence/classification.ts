import { dependencyClosure } from "./discovery";
import type { FeatureRecord, FileFacts, ScanResult } from "./types";

/** Unknown flags stay unknown; no evaluating project code or reading env secrets. */
function conditionValue(expression: string, file: string, files: Record<string, FileFacts>, seen = new Set<string>()): boolean | undefined {
  const key = `${file}:${expression}`;
  if (seen.has(key)) return undefined;
  seen.add(key);
  if (expression === "true" || expression === "false") return expression === "true";
  if (expression.startsWith("!")) {
    const value = conditionValue(expression.slice(1), file, files, seen);
    return value === undefined ? undefined : !value;
  }
  if (!/^\w+$/.test(expression)) return undefined;
  const facts = files[file];
  if (facts?.constants?.[expression] !== undefined) return facts.constants[expression];
  const imported = facts?.imports[expression];
  return imported ? conditionValue(expression, imported, files, seen) : undefined;
}

export function classifyInternalEntry(scan: ScanResult, route: {
  path: string; file: string; pages: string[]; conditions?: string[]; source: { file: string; line: number };
}, context: ReturnType<typeof classificationContext>) {
  const reachable = context.client.has(route.file) && route.pages.length > 0;
  const resolved = (route.conditions ?? []).every(condition => conditionValue(condition, route.file, scan.files) === true);
  return { route: route.path, status: reachable && resolved ? "restricted" : "unverified",
    reason: "Internal/admin entry: retained in engineering coverage, never consumer knowledge. Conditional registration is not permission.",
    evidence: [route.source, ...route.pages.map(file => ({ file, line: 1 }))], conditions: route.conditions ?? [] };
}

export function classificationContext(scan: ScanResult) {
  // Synthetic scans must explicitly supply roots too; missing build evidence is
  // not permission to assume every source file is registered in the live app.
  const roots = scan.entrypoints;
  const client = new Set(dependencyClosure(scan.files, roots?.client ?? []));
  const server = new Set(dependencyClosure(scan.files, roots?.developmentServer ?? []));
  return { client, server };
}

export function classify(record: FeatureRecord, scan: ScanResult,
  matches: Array<{ file: string; conditions?: string[]; source: { file: string; line: number } }>,
  pages: string[], context: ReturnType<typeof classificationContext>): NonNullable<FeatureRecord["classification"]> {
  const internal = /^\/(?:admin|__[^/]*|dev|debug|demo|test)(?:\/|$)/i.test(record.route ?? "") ||
    pages.some(file => /\/(?:admin|legacy|debug|demo-studio)\//i.test(file));
  const redirect = pages.some(file => (scan.files[file]?.redirects?.length ?? 0) > 0);
  const evidence = [...matches.map(match => match.source), ...pages.map(file => ({ file, line: 1 })),
    ...(scan.entrypoints?.evidence ?? [])];
  const conditionalEntries = [...new Set(matches.flatMap(match => match.conditions ?? []))];
  const result = (status: NonNullable<FeatureRecord["classification"]>["status"], ...reasons: string[]) =>
    ({ status, reasons, evidence, conditionalEntries, internal, redirect });
  if (["coming_soon", "disabled"].includes(record.availability))
    return result("coming_soon", "Existing authoritative documentation explicitly marks this unavailable or planned.");
  if (!matches.length) {
    if (pages.some(file => scan.files[file]?.superseded))
      return result("legacy_unused", "Explicit @deprecated/replaced evidence and no registered route.");
    return result("unverified", "No resolved route registration; absent dashboard navigation is not evidence of retirement.");
  }
  const reachable = matches.filter(match => context.client.has(match.file));
  if (!reachable.length) return result("unverified", "Route declaration is not proven reachable from the configured client entry point.");
  const evaluated = reachable.map(match => (match.conditions ?? []).map(condition => conditionValue(condition, match.file, scan.files)));
  const enabled = evaluated.some(values => values.every(value => value === true));
  const ownRequests = new Set(pages.flatMap(file => scan.files[file]?.requests ?? []));
  const apiEntry = record.backendEvidence.filter(endpoint => endpoint.match === "exact" &&
    context.server.has(endpoint.source.file) && ownRequests.has(endpoint.path));
  evidence.push(...apiEntry.map(endpoint => endpoint.source));
  const explicitlyDisabled = evaluated.every(values => values.some(value => value === false));
  const independentEntry = !explicitlyDisabled && apiEntry.some(endpoint => endpoint.path === record.independentBackendEntry);
  if (!enabled && !independentEntry)
    return result("unverified", evaluated.some(values => values.some(value => value === false))
      ? "Registered entry is disabled by a source-proven flag; this alone does not establish retirement."
      : "Conditional entry flag is unresolved; no independent reachable backend entry is proven.");
  if (!pages.length) return result("unverified", "Registered entry exists, but its rendered implementation is unresolved.");
  if (record.gaps.includes("availability_marker_requires_review"))
    return result("unverified", "A reachable dependency contains a Coming Soon marker; scope requires review.");
  const restricted = internal || record.access.observedGuards.length > 0 ||
    apiEntry.some(endpoint => endpoint.middleware.some(name => /auth|access|role|permission|consent|clinical/i.test(name))) ||
    /\b(pro|clinical|professional|owner|admin|subscription|relationship|consent)\b/i.test(record.access.documented ?? "");
  return result(restricted ? "restricted" : "active",
    enabled ? "Registration and implementation are reachable from the configured client entry."
      : "UI flag is unresolved, but an explicitly documented independent authenticated backend entry is source-reachable.",
    restricted ? "Existing guards/permissions remain authoritative; this classification grants no access."
      : "No specific guard resolved at this entry; this is not proof of anonymous authorization.",
    ...(redirect ? ["This is a redirect entry; preserve direct links but do not describe the superseded screen as a current workflow."] : []));
}

export function legacyReport(scan: ScanResult, records: FeatureRecord[], context: ReturnType<typeof classificationContext>) {
  return {
    scope: "Development static classification; candidates are not deletion authority.",
    entrypoints: scan.entrypoints ?? null,
    confirmedLegacy: Object.keys(scan.files).filter(file => scan.files[file].superseded && !context.client.has(file) && !context.server.has(file))
      .map(file => ({ file, status: "legacy_unused", reason: "Explicit @deprecated/replaced evidence; not reached from configured entries.", evidence: { file, line: 1 } })),
    suspectedComponents: Object.keys(scan.files).filter(file => /^client\/src\/(?:pages|components)\//.test(file) &&
      !context.client.has(file)).map(file => ({ file, status: "unverified",
        evidence: [{ file, line: 1 }],
        reason: "Not statically reached from configured entry; dynamic imports, invitations and direct links require review. Not absence from dashboard." })),
    supersededEntries: records.filter(record => record.kind === "page" && record.classification?.redirect)
      .map(record => ({ id: record.id, route: record.route, replacements: record.dependencyFiles.flatMap(file => scan.files[file]?.redirects ?? []),
        classification: record.classification })),
    obsoleteKnowledgeRoutes: records.filter(record => record.kind === "feature" && record.gaps.includes("knowledge_route_not_registered"))
      .map(record => ({ id: record.id, route: record.route, status: "unverified", reason: "Documented route is unregistered; no replacement inferred.", evidence: record.sources })),
  };
}
