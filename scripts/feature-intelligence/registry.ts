import { backendIndex, dependencyClosure, digest, resolveRouteComponents } from "./discovery";
import type { FeatureRecord, FileFacts, KnowledgeFact, Registry, ScanResult, ScanState, SourceReference } from "./types";

const restrictedRoute = (route: string) =>
  /^\/(?:admin|__[^/]*|dev|debug|demo(?:-studio)?|test)(?:\/|$)/i.test(route);
const internalSource = (file: string) => /\/(?:admin|legacy|demo-studio|__tests__|debug)(?:\/|$)/i.test(file) ||
  /(?:TestHarness|AdminDashboard|DebugPanel)\.[jt]sx?$/.test(file);
const audienceFor = (route: string): FeatureRecord["audience"] =>
  /^\/(?:business|organization)(?:\/|$)/.test(route) ? "organization_admin"
    : /^\/(?:pro|studio|physician|clinician|trainer)(?:\/|$)/.test(route) ? "professional" : "member";
const uniqueSources = (sources: SourceReference[]) => [...new Map(sources.map(item =>
  [`${item.file}:${item.line}`, item])).values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

export function compileRegistry(scan: ScanResult, knowledge: KnowledgeFact[], previous?: ScanState) {
  const { files } = scan;
  const routes = Object.entries(files).flatMap(([file, facts]) =>
    facts.routes.map(route => ({ ...route, ...resolveRouteComponents(facts, route.components), file })));
  const excluded = routes.filter(route => restrictedRoute(route.path));
  const publicRoutes = routes.filter(route => !restrictedRoute(route.path));
  const api = backendIndex(files);
  const records: FeatureRecord[] = [];
  const pageIds = new Map(publicRoutes.map(route => [route.path, `page:${route.path}`]));
  const byPath = new Map<string, typeof publicRoutes>();
  for (const route of publicRoutes) byPath.set(route.path, [...(byPath.get(route.path) ?? []), route]);
  const normalizeApi = (value: string) => value.replace(/:[a-zA-Z_]\w*/g, ":param").replace(/\/$/, "");

  function add(id: string, kind: FeatureRecord["kind"], route: string | null, fact?: KnowledgeFact) {
    const matches = route ? byPath.get(route) ?? [] : [];
    const pages = [...new Set(matches.flatMap(match => match.pages))].sort();
    const dependencies = dependencyClosure(files, pages);
    const controlFiles = new Set<string>();
    function collectControls(file: string) {
      if (controlFiles.has(file) || !files[file]) return;
      controlFiles.add(file);
      files[file].renderedModules.forEach(collectControls);
    }
    pages.forEach(collectControls);
    const controls = [...controlFiles].filter(file => !internalSource(file)).sort()
      .flatMap(file => files[file]?.controls ?? []).filter(control => !control.destinations.some(restrictedRoute));
    const requests = new Set(dependencies.flatMap(file => files[file]?.requests ?? []));
    const backendEvidence = api.filter(endpoint => [...requests].some(request => endpoint.match === "exact"
      ? normalizeApi(endpoint.path) === normalizeApi(request)
      : endpoint.path.split("/").some(part => part && !part.startsWith(":")) &&
        normalizeApi(request).endsWith(normalizeApi(endpoint.path))));
    const guards = [...new Set(matches.flatMap(match => match.guards))].sort();
    const sources = uniqueSources([
      ...(fact?.sources ?? []), ...matches.map(match => match.source),
      ...pages.map(file => ({ file, line: 1 })), ...backendEvidence.map(endpoint => endpoint.source),
    ]);
    const nameCandidates = [...new Set(pages.flatMap(file => files[file]?.primaryHeadings ?? []))].sort();
    const name = fact?.name ?? (nameCandidates.length === 1 ? nameCandidates[0] : null);
    const gaps: string[] = [];
    if (!name) gaps.push("missing_official_name");
    if (!fact && nameCandidates.length > 1) gaps.push("ambiguous_page_title");
    if (!fact?.description) gaps.push("missing_description");
    if (route && !matches.length) gaps.push("knowledge_route_not_registered");
    if (route && matches.length && !pages.length) gaps.push("page_component_unresolved");
    if (!route) gaps.push("knowledge_only_no_verified_page_binding");
    if (sources.some(ref => !files[ref.file])) gaps.push("source_reference_missing");
    if (controls.some(control => !control.label)) gaps.push("dynamic_or_translated_control_labels");
    if (controls.some(control => !control.handler && !control.destinations.length && !control.requests.length))
      gaps.push("control_behavior_unresolved");
    if (backendEvidence.some(endpoint => endpoint.match === "suffix_only")) gaps.push("backend_mount_unresolved");
    if ([...requests].some(request => !backendEvidence.some(endpoint => endpoint.match === "exact" &&
      normalizeApi(request) === normalizeApi(endpoint.path)))) gaps.push("api_trace_incomplete");
    if (dependencies.some(file => files[file]?.availabilityMarkers.length)) gaps.push("availability_marker_requires_review");
    if (!fact?.access && guards.length === 0) gaps.push("access_rules_not_documented");
    const documentedAvailability = fact?.availability ?? "unknown";
    if (documentedAvailability === "unknown") gaps.push("availability_not_verified");
    const legacy = Object.values(files).flatMap(file => file.legacyFeatures)
      .filter(item => item.route === route && fact && item.name !== fact.name && !fact.aliases.includes(item.name));
    if (legacy.length) gaps.push("legacy_display_name_disagreement");
    const knowledgeFingerprint = digest(fact ? { ...fact, sources: undefined } : null);
    const implementationFingerprint = digest({
      matches: matches.map(match => ({ path: match.path, components: match.components, pages: match.pages, guards: match.guards })),
      files: dependencies.map(file => [file, files[file]?.hash]),
      backend: backendEvidence.map(endpoint => [endpoint.method, endpoint.path, endpoint.source.file, files[endpoint.source.file]?.hash]),
    });
    const prior = previous?.records[id];
    const stale = !!prior && prior.knowledgeFingerprint === knowledgeFingerprint &&
      (prior.implementationFingerprint !== implementationFingerprint || prior.stale);
    if (stale) gaps.push("implementation_changed_documentation_review_needed");
    const broken = gaps.some(gap => ["knowledge_route_not_registered", "source_reference_missing"].includes(gap));
    records.push({
      id, kind, name, nameEvidence: fact ? "existing_knowledge" : name ? "source_heading" : "missing",
      nameCandidates,
      description: fact?.description ?? null, aliases: fact?.aliases ?? [], route,
      audience: fact?.audience ?? audienceFor(route ?? ""),
      access: { documented: fact?.access ?? null, observedGuards: guards, authoritativeAtRuntime: true },
      availability: documentedAvailability,
      verification: broken ? "contradictory" : stale ? "stale"
        : fact?.reviewed && !!route && matches.length > 0 && pages.length > 0 ? "verified"
          : fact ? "partial" : "unverified",
      verificationScope: "source_backed_documentation_only",
      confidence: fact?.reviewed ? "reviewed_metadata" : pages.length ? "structural_evidence_only" : "insufficient",
      limitations: fact?.limitations ?? [], workflows: fact?.workflows ?? [], controls, backendEvidence,
      relatedFeatureIds: [], navigationTargetIds: [], sources,
      dependencyFiles: [...new Set([...dependencies, ...sources.map(ref => ref.file)])].sort(),
      gaps: [...new Set(gaps)].sort(), knowledgeFingerprint, implementationFingerprint,
    });
  }
  for (const fact of knowledge) if (!fact.route || !restrictedRoute(fact.route)) add(`feature:${fact.id}`, "feature", fact.route, fact);
  for (const route of [...byPath.keys()].sort()) {
    const documented = knowledge.filter(fact => fact.route === route);
    add(pageIds.get(route)!, "page", route, documented.length === 1 ? documented[0] : undefined);
  }
  for (const record of records) {
    record.relatedFeatureIds = records.filter(other => other.id !== record.id && other.route && other.route === record.route)
      .map(other => other.id).sort();
    record.navigationTargetIds = [...new Set(record.controls.flatMap(control => control.destinations)
      .map(target => pageIds.get(target.split(/[?#]/)[0])).filter((id): id is string => !!id))].sort();
  }
  records.sort((a, b) => a.id.localeCompare(b.id));
  const registry: Registry = { schemaVersion: 1, environment: "development", runtimeIntegration: "not_connected",
    audience: "engineering_only", authority: "evidence_not_permissions", features: records };
  const aliases = new Map<string, Set<string>>();
  for (const fact of knowledge) for (const label of [fact.name, ...fact.aliases]) {
    const key = label.trim().toLowerCase();
    if (!aliases.has(key)) aliases.set(key, new Set());
    aliases.get(key)!.add(`feature:${fact.id}`);
  }
  const aliasCollisions = [...aliases].filter(([, ids]) => ids.size > 1)
    .map(([alias, ids]) => ({ alias, featureIds: [...ids].sort() })).sort((a, b) => a.alias.localeCompare(b.alias));
  const priorIds = new Set(Object.keys(previous?.records ?? {}));
  const states: ScanState["records"] = Object.fromEntries(records.map(record => [record.id, {
    knowledgeFingerprint: record.knowledgeFingerprint, implementationFingerprint: record.implementationFingerprint,
    fingerprint: digest(record), stale: record.gaps.includes("implementation_changed_documentation_review_needed"),
  }]));
  const changes = {
    added: records.filter(record => !priorIds.has(record.id)).map(record => record.id),
    modified: records.filter(record => previous?.records[record.id] &&
      previous.records[record.id].fingerprint !== states[record.id].fingerprint).map(record => record.id),
    removed: [...priorIds].filter(id => !states[id]).sort(),
    affected: records.filter(record => record.dependencyFiles.some(file =>
      [...scan.changedFiles, ...scan.removedFiles].includes(file))).map(record => record.id),
  };
  const counts = (values: string[]) => Object.fromEntries([...new Set(values)].sort()
    .map(value => [value, values.filter(item => item === value).length]));
  const coverage = {
    schemaVersion: 1, scope: "Static source discovery; not runtime, authorization or clinical validation.",
    summary: {
      featureRecords: records.filter(record => record.kind === "feature").length,
      pageRecords: records.filter(record => record.kind === "page").length,
      totalRecords: records.length, registeredRouteDeclarations: publicRoutes.length,
      discoveredControls: Object.values(files).reduce((sum, file) => sum + file.controls.length, 0),
      sourceFiles: Object.keys(files).length,
      verification: counts(records.map(record => record.verification)),
      featureVerification: counts(records.filter(record => record.kind === "feature").map(record => record.verification)),
      pageVerification: counts(records.filter(record => record.kind === "page").map(record => record.verification)),
      gaps: counts(records.flatMap(record => record.gaps)),
      excludedInternalRouteDeclarations: excluded.length,
    },
    incremental: { parsedFiles: scan.parsedFiles, reusedFiles: scan.reusedFiles,
      changedFiles: scan.changedFiles, removedFiles: scan.removedFiles, ...changes },
    aliasCollisions,
    unresolvedRoutes: Object.values(files).flatMap(file => file.unresolvedRoutes),
    orphanPages: Object.keys(files).filter(file => file.startsWith("client/src/pages/") &&
      !routes.some(route => route.pages.includes(file))).map(file => ({ file, reason: "No statically resolved route; may be nested, unused or dynamically loaded." })),
    legacyUnregisteredRoutes: Object.values(files).flatMap(file => file.legacyFeatures)
      .filter(feature => !byPath.has(feature.route) && !restrictedRoute(feature.route)),
    records: records.filter(record => record.gaps.length).map(({ id, name, route, verification, gaps }) =>
      ({ id, name, route, verification, gaps })),
  };
  return { registry, coverage, states };
}

export function integrityErrors(registry: Registry): string[] {
  const errors: string[] = [], ids = new Set<string>();
  if (registry.environment !== "development" || registry.runtimeIntegration !== "not_connected" ||
      registry.audience !== "engineering_only" || registry.authority !== "evidence_not_permissions")
    errors.push("Invalid Development isolation metadata");
  for (const record of registry.features) {
    if (ids.has(record.id)) errors.push(`Duplicate ID: ${record.id}`);
    ids.add(record.id);
    if (record.route && restrictedRoute(record.route)) errors.push(`Internal route in feature registry: ${record.id}`);
    if (record.verification === "verified" && (!record.description || !record.sources.length ||
        record.confidence !== "reviewed_metadata")) errors.push(`Unsubstantiated verified record: ${record.id}`);
    for (const source of record.sources) {
      if (!/^(client\/src|server|shared)\//.test(source.file) || source.file.includes("..") || source.file.includes("\\") ||
          !Number.isInteger(source.line) || source.line < 1) errors.push(`Unsafe source reference: ${record.id}`);
    }
  }
  for (const record of registry.features) for (const related of [...record.relatedFeatureIds, ...record.navigationTargetIds])
    if (!ids.has(related)) errors.push(`Dangling relationship: ${record.id}`);
  return errors;
}

export function markdownReport(result: ReturnType<typeof compileRegistry>): string {
  const { summary, incremental, records, aliasCollisions, legacyUnregisteredRoutes, orphanPages } = result.coverage;
  const escape = (value: unknown) => String(value ?? "—").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  return [
    "# Development Feature Intelligence coverage",
    "", "**Engineering-only. Not connected to Ask Chef. Not authorization, execution, runtime or clinical proof.**",
    "", `Discovered ${summary.featureRecords} existing documented features and ${summary.pageRecords} registered page records.`,
    `Scanned ${summary.sourceFiles} source files; ${summary.discoveredControls} control observations (not distinct verified capabilities).`,
    `Excluded ${summary.excludedInternalRouteDeclarations} internal/admin/demo/test route declarations.`,
    "", "## Verification", ...Object.entries(summary.verification).map(([key, count]) => `- ${key}: ${count}`),
    "", "## Coverage gaps", ...Object.entries(summary.gaps).map(([key, count]) => `- ${key}: ${count}`),
    "", "## Incremental changes",
    `Parsed ${incremental.parsedFiles}; reused ${incremental.reusedFiles}; added ${incremental.added.length}; modified ${incremental.modified.length}; removed ${incremental.removed.length}; affected ${incremental.affected.length}.`,
    "", `Alias collisions: ${aliasCollisions.length}. Legacy unregistered routes: ${legacyUnregisteredRoutes.length}. Unresolved/unbound page modules: ${orphanPages.length}.`,
    "", "## Records requiring coverage or review", "| Record | Name | Route | Verification | Gaps |",
    "| --- | --- | --- | --- | --- |",
    ...records.map(record => `| ${[record.id, record.name, record.route, record.verification, record.gaps.join(", ")].map(escape).join(" | ")} |`),
    "", "See coverage.json for exact sources, aliases, unbound pages and change details. Do not treat a route or label as capability verification.", "",
  ].join("\n");
}
