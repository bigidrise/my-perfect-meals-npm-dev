import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { ApiFact, FileFacts, ScanResult, ScanState, SourceReference, SymbolFact } from "./types";

export const digest = (value: unknown): string =>
  createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

const skipped = new Set(["node_modules", ".git", "dist", "build", "__tests__", "tests", "test",
  "fixtures", "__fixtures__", "legacy", "demo-studio", "generated-artifacts"]);
const unix = (value: string) => value.split(path.sep).join("/");
export function sourceFiles(root: string): string[] {
  const result: string[] = [];
  function walk(relative: string) {
    const dir = path.join(root, relative);
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.isSymbolicLink() || skipped.has(item.name) || item.name.startsWith(".")) continue;
      const child = unix(path.join(relative, item.name));
      if (item.isDirectory()) walk(child);
      else if (/\.[cm]?[jt]sx?$/.test(item.name) && !/\.(test|spec|d)\.[cm]?[jt]sx?$/.test(item.name)) result.push(child);
    }
  }
  for (const dir of ["client/src", "server", "shared"]) walk(dir);
  return result.sort();
}

function resolveModule(file: string, specifier: string, knownFiles: Set<string>): string | undefined {
  const base = specifier.startsWith("@/") ? "client/src/" + specifier.slice(2)
    : specifier.startsWith(".") ? unix(path.normalize(path.join(path.dirname(file), specifier))) : undefined;
  if (!base) return undefined;
  return [base, ...[".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"].map(ext => base + ext)]
    .find(candidate => knownFiles.has(candidate));
}

/** Literals/templates only. Never eval code, expand env vars, or read runtime data. */
export function staticText(node: ts.Node | undefined, templates = false): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isJsxExpression(node)) return staticText(node.expression, templates);
  if (ts.isTemplateExpression(node) && templates) {
    return node.head.text + node.templateSpans.map(span => ":param" + span.literal.text).join("");
  }
  return null;
}

export function analyzeFile(file: string, text: string, knownFiles: Set<string>): FileFacts {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const reference = (node: ts.Node): SourceReference =>
    ({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
  const result: FileFacts = {
    hash: digest(text), imports: {}, moduleSpecifiers: {}, dependencies: [], renderedModules: [], symbols: {}, routes: [], controls: [],
    api: [], mounts: [], requests: [], headings: [], primaryHeadings: [], availabilityMarkers: [], unresolvedRoutes: [], legacyFeatures: [],
  };
  const moduleTarget = (specifier: string) => {
    const resolved = resolveModule(file, specifier, knownFiles);
    if (specifier.startsWith(".") || specifier.startsWith("@/")) result.moduleSpecifiers[specifier] = resolved ?? null;
    return resolved;
  };
  const declarations = new Map<string, ts.Node>();
  function discoverSymbols(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const resolved = moduleTarget(node.moduleSpecifier.text);
      if (resolved && !node.importClause?.isTypeOnly) {
        result.dependencies.push(resolved);
        if (node.importClause?.name) result.imports[node.importClause.name.text] = resolved;
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
          bindings.elements.filter(item => !item.isTypeOnly).forEach(item => { result.imports[item.name.text] = resolved; });
      }
    }
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
      declarations.set(node.name.text, ts.isVariableDeclaration(node) ? node.initializer ?? node : node);
    }
    ts.forEachChild(node, discoverSymbols);
  }
  discoverSymbols(source);
  function symbolFact(node: ts.Node): SymbolFact {
    const refs = new Set<string>(), modules = new Set<string>();
    function visit(child: ts.Node) {
      if (ts.isIdentifier(child)) refs.add(child.text);
      if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = staticText(child.arguments[0]);
        const target = specifier && moduleTarget(specifier);
        if (target) modules.add(target);
      }
      ts.forEachChild(child, visit);
    }
    visit(node);
    return { references: [...refs].sort(), modules: [...modules].sort() };
  }
  for (const [name, node] of declarations) result.symbols[name] = symbolFact(node);
  function descendants(node: ts.Node, callback: (child: ts.Node) => void) {
    callback(node); ts.forEachChild(node, child => descendants(child, callback));
  }
  function localEffects(node: ts.Node, seen = new Set<string>()): { destinations: string[]; requests: string[] } {
    const destinations = new Set<string>(), requests = new Set<string>();
    descendants(node, child => {
      if (ts.isIdentifier(child) && declarations.has(child.text) && !seen.has(child.text) && seen.size < 24) {
        seen.add(child.text);
        const nested = localEffects(declarations.get(child.text)!, seen);
        nested.destinations.forEach(value => destinations.add(value));
        nested.requests.forEach(value => requests.add(value));
      }
      if (!ts.isCallExpression(child)) return;
      const name = child.expression.getText(source);
      const args = child.arguments.map(argument => staticText(argument, true)).filter((v): v is string => v !== null);
      if (/^(setLocation|navigate|nav|router\.push|router\.replace|history\.push)$/.test(name)) {
        args.filter(value => /^\/(?!\/)/.test(value) && !value.startsWith("/api/")).forEach(value => destinations.add(value));
      }
      if (/^(fetch|apiRequest|apiUrl|axios\.(get|post|put|patch|delete))$/.test(name))
        args.filter(value => value.startsWith("/api/")).forEach(value => requests.add(value.split("?")[0]));
    });
    return { destinations: [...destinations].sort(), requests: [...requests].sort() };
  }
  function jsxLabel(node: ts.Node): string | null {
    const parts: string[] = [];
    descendants(node, child => {
      if (ts.isJsxText(child)) parts.push(child.text);
      if (ts.isJsxExpression(child) && child.expression && staticText(child.expression)) parts.push(staticText(child.expression)!);
    });
    const label = parts.join(" ").replace(/\s+/g, " ").trim();
    return label && label.length <= 180 ? label : null;
  }
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = staticText(node.arguments[0]);
      const target = specifier && moduleTarget(specifier);
      if (target) result.dependencies.push(target);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text.toLowerCase();
      const route = staticText(node.arguments[0]);
      const receiver = node.expression.expression.getText(source);
      const isRouter = /^(app|router|[A-Za-z_]\w*Router)$/.test(receiver);
      if (file.startsWith("server/") && isRouter && route?.startsWith("/") &&
          ["get", "post", "put", "patch", "delete", "all", "options", "head"].includes(method)) {
        result.api.push({ method: method.toUpperCase(), path: route,
          middleware: node.arguments.slice(1).filter(ts.isIdentifier).map(argument => argument.text), source: reference(node) });
      }
      if (file.startsWith("server/") && isRouter && method === "use" && route) {
        for (const argument of node.arguments.slice(1)) {
          if (ts.isIdentifier(argument) && result.imports[argument.text])
            result.mounts.push({ path: route, module: result.imports[argument.text] });
        }
      }
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(source);
      if (result.imports[tag]) result.renderedModules.push(result.imports[tag]);
      if (result.symbols[tag]) result.renderedModules.push(...result.symbols[tag].modules);
      const attrs = opening.attributes.properties.filter(ts.isJsxAttribute);
      const attr = (name: string) => attrs.find(item => item.name.getText(source) === name);
      if (tag === "Route") {
        const value = attr("path");
        const route = staticText(value?.initializer);
        if (route) {
          const components = new Set<string>();
          const component = attr("component")?.initializer;
          if (component) descendants(component, child => { if (ts.isIdentifier(child)) components.add(child.text); });
          if (ts.isJsxElement(node)) {
            for (const child of node.children) descendants(child, part => {
              if (ts.isJsxOpeningElement(part) || ts.isJsxSelfClosingElement(part)) components.add(part.tagName.getText(source));
            });
          }
          result.routes.push({ path: route, components: [...components].sort(), source: reference(node) });
        } else if (value) result.unresolvedRoutes.push(reference(node));
      }
      if (/^h[1-3]$/.test(tag)) {
        const label = jsxLabel(node);
        if (label) {
          result.headings.push(label);
          if (tag === "h1") result.primaryHeadings.push(label);
        }
      }
      if (tag !== "Route" && (/^(button|a)$/.test(tag) || /(Button|Link|MenuItem|TabsTrigger)$/.test(tag) || !!attr("onClick"))) {
        const handlerAttribute = attr("onClick")?.initializer ?? attr("onSelect")?.initializer;
        const handlerNode = handlerAttribute && ts.isJsxExpression(handlerAttribute) ? handlerAttribute.expression : handlerAttribute;
        const effects = handlerNode ? localEffects(handlerNode) : { destinations: [], requests: [] };
        for (const field of ["href", "to"]) {
          const value = staticText(attr(field)?.initializer);
          if (value?.startsWith("/") && !value.startsWith("//")) effects.destinations.push(value);
        }
        result.controls.push({
          label: staticText(attr("aria-label")?.initializer) ?? jsxLabel(node),
          handler: handlerNode && ts.isIdentifier(handlerNode) ? handlerNode.text : null,
          destinations: [...new Set(effects.destinations)].sort(), requests: effects.requests,
          disabledState: !attr("disabled") ? "not_declared"
            : !attr("disabled")?.initializer || attr("disabled")?.initializer?.getText(source) === "{true}" ? "always" : "conditional",
          source: reference(node),
        });
      }
    }
    if (ts.isJsxText(node) && /\bcoming soon\b/i.test(node.text)) result.availabilityMarkers.push(reference(node));
    // Reuse the legacy registry as untrusted evidence, never as navigation authority.
    if (file === "client/src/chef/featureRegistry.ts" && ts.isObjectLiteralExpression(node)) {
      const fields = new Map(node.properties.filter(ts.isPropertyAssignment).map(prop => [prop.name.getText(source), prop.initializer]));
      const id = staticText(fields.get("id")), name = staticText(fields.get("displayName")), route = staticText(fields.get("path"));
      if (id && name && route) {
        const aliases: string[] = [];
        const synonyms = fields.get("synonyms");
        if (synonyms && ts.isArrayLiteralExpression(synonyms))
          synonyms.elements.forEach(item => { const value = staticText(item); if (value) aliases.push(value); });
        result.legacyFeatures.push({ id, name, route, aliases, source: reference(node) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  // File-level request discovery avoids attributing every request to every button.
  const requests = new Set<string>();
  descendants(source, node => {
    if (!ts.isCallExpression(node)) return;
    const name = node.expression.getText(source);
    if (!/^(fetch|apiRequest|apiUrl|axios\.(get|post|put|patch|delete))$/.test(name)) return;
    for (const argument of node.arguments) {
      const value = staticText(argument, true);
      if (value?.startsWith("/api/")) requests.add(value.split("?")[0]);
    }
  });
  result.requests = [...requests].sort();
  result.dependencies = [...new Set(result.dependencies)].sort();
  result.renderedModules = [...new Set(result.renderedModules)].sort();
  return result;
}

export function scan(root: string, analyzerFingerprint: string, previous?: ScanState): ScanResult {
  const names = sourceFiles(root), known = new Set(names);
  const files: Record<string, FileFacts> = {};
  const reusable = previous?.analyzerFingerprint === analyzerFingerprint ? previous.files : {};
  let parsedFiles = 0, reusedFiles = 0;
  const changedFiles: string[] = [];
  for (const name of names) {
    const text = fs.readFileSync(path.join(root, name), "utf8"), hash = digest(text);
    const prior = reusable[name];
    const sameResolution = prior && Object.entries(prior.moduleSpecifiers).every(([specifier, target]) =>
      (resolveModule(name, specifier, known) ?? null) === target);
    if (prior?.hash === hash && sameResolution) { files[name] = prior; reusedFiles++; }
    else { files[name] = analyzeFile(name, text, known); parsedFiles++; changedFiles.push(name); }
  }
  return { files, changedFiles, removedFiles: Object.keys(previous?.files ?? {}).filter(name => !known.has(name)).sort(), parsedFiles, reusedFiles };
}

export function dependencyClosure(files: Record<string, FileFacts>, entries: string[]): string[] {
  const seen = new Set<string>();
  function visit(file: string) {
    if (seen.has(file) || !files[file]) return;
    seen.add(file); files[file].dependencies.forEach(visit);
  }
  entries.forEach(visit);
  return [...seen].sort();
}

export function resolveRouteComponents(file: FileFacts, names: string[]): { pages: string[]; guards: string[] } {
  const seen = new Set<string>(), pages = new Set<string>(), guards = new Set<string>();
  function visit(name: string) {
    if (seen.has(name)) return;
    seen.add(name);
    if (/(Guard|Protected|Require|Gate)/.test(name)) guards.add(name);
    const imported = file.imports[name];
    if (imported?.startsWith("client/src/pages/")) pages.add(imported);
    const symbol = file.symbols[name];
    symbol?.modules.filter(module => module.startsWith("client/src/pages/")).forEach(module => pages.add(module));
    symbol?.references.filter(ref => ref !== name).forEach(visit);
  }
  names.forEach(visit);
  return { pages: [...pages].sort(), guards: [...guards].sort() };
}

/** Exact mounted paths are stronger evidence than an unresolved router suffix. */
export function backendIndex(files: Record<string, FileFacts>): Array<ApiFact & { match: "exact" | "suffix_only" }> {
  const mounts = new Map<string, Set<string>>();
  const join = (prefix: string, suffix: string) => (prefix.replace(/\/$/, "") + "/" + suffix.replace(/^\//, "")).replace(/\/$/, "") || "/";
  for (const file of Object.values(files)) for (const mount of file.mounts) {
    if (mount.path.startsWith("/api")) {
      if (!mounts.has(mount.module)) mounts.set(mount.module, new Set());
      mounts.get(mount.module)!.add(mount.path);
    }
  }
  // Resolve imported nested routers without executing any registration.
  for (let round = 0; round < 8; round++) {
    let changed = false;
    for (const [name, prefixes] of [...mounts]) for (const mount of files[name]?.mounts ?? []) {
      if (!mounts.has(mount.module)) mounts.set(mount.module, new Set());
      for (const prefix of [...prefixes]) {
        const value = join(prefix, mount.path), target = mounts.get(mount.module)!;
        if (value.length < 240 && !target.has(value)) { target.add(value); changed = true; }
      }
    }
    if (!changed) break;
  }
  return Object.entries(files).flatMap(([name, file]) => file.api.flatMap<ApiFact & { match: "exact" | "suffix_only" }>(api =>
    api.path.startsWith("/api/") ? [{ ...api, match: "exact" as const }]
      : mounts.has(name) ? [...mounts.get(name)!].map(prefix => ({ ...api, path: join(prefix, api.path), match: "exact" as const }))
      : [{ ...api, match: "suffix_only" as const }]));
}
