import ts from "typescript";

export interface Reference {
  file: string;
  line: number;
  kind: string;
  value: string;
}
export interface Analysis {
  routes: Reference[];
  destinations: Reference[];
  unresolved: Reference[];
}

// Parse source only: never import application modules or execute navigation.
export function analyze(file: string, text: string, routeAuthority = false): Analysis {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const syntaxErrors = (source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (syntaxErrors.length)
    throw new Error(`Cannot analyze ${file}: ${ts.flattenDiagnosticMessageText(syntaxErrors[0].messageText, " ")}`);
  const result: Analysis = { routes: [], destinations: [], unresolved: [] };
  const constants = new Map<string, ts.Expression[]>();
  const bindings = new Map<string, number>();
  const navigationCalls = new Set(["setLocation", "navigate", "nav", "navigateTo", "handleNavigate", "navigationHandler", "onNavigate", "goTo"]);
  function bind(name: ts.BindingName) {
    if (ts.isIdentifier(name)) bindings.set(name.text, (bindings.get(name.text) ?? 0) + 1);
    else name.elements.forEach(element => { if (ts.isBindingElement(element)) bind(element.name); });
  }
  function collect(node: ts.Node) {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) bind(node.name);
    if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportClause(node)) {
      if (node.name) bind(node.name);
    }
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) &&
        node.initializer && ts.isCallExpression(node.initializer) &&
        node.initializer.expression.getText(source) === "useLocation") {
      const setter = node.name.elements[1];
      if (setter && ts.isBindingElement(setter) && ts.isIdentifier(setter.name))
        navigationCalls.add(setter.name.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
        ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const)) {
      const entries = constants.get(node.name.text) ?? [];
      entries.push(node.initializer);
      constants.set(node.name.text, entries);
    }
    ts.forEachChild(node, collect);
  }
  collect(source);

  function strings(node: ts.Node | undefined, seen = new Set<string>()): { values: string[]; unknown: boolean } {
    if (!node) return { values: [], unknown: true };
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      return { values: [node.text], unknown: false };
    if (ts.isJsxExpression(node)) return strings(node.expression, seen);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node))
      return strings(node.expression, seen);
    if (ts.isIdentifier(node) && !seen.has(node.text) && bindings.get(node.text) === 1 && constants.get(node.text)?.length === 1) {
      return strings(constants.get(node.text)![0], new Set([...seen, node.text]));
    }
    if (ts.isConditionalExpression(node)) {
      const a = strings(node.whenTrue, seen), b = strings(node.whenFalse, seen);
      return { values: [...a.values, ...b.values], unknown: a.unknown || b.unknown };
    }
    if (ts.isArrayLiteralExpression(node)) {
      const parts = node.elements.map(part => strings(part, seen));
      return { values: parts.flatMap(part => part.values), unknown: parts.some(part => part.unknown) };
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const a = strings(node.left, seen), b = strings(node.right, seen);
      return { values: a.values.flatMap(left => b.values.map(right => left + right)), unknown: a.unknown || b.unknown };
    }
    return { values: [], unknown: true };
  }

  function record(node: ts.Node, expression: ts.Node | undefined, kind: string, route = false) {
    const resolved = strings(expression);
    const ref = { file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind };
    for (const value of new Set(resolved.values)) {
      if (route || value.startsWith("/")) (route ? result.routes : result.destinations).push({ ...ref, value });
      else if (!/^(?:[a-z][\w+.-]*:|#)/i.test(value))
        result.unresolved.push({ ...ref, kind: `${kind} (relative)`, value });
    }
    if (resolved.unknown) result.unresolved.push({ ...ref, value: expression?.getText(source).slice(0, 160) ?? "(missing)" });
  }

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const name = attr.name.getText(source);
        if (tag === "Route" && name === "path" && routeAuthority)
          record(attr, attr.initializer, "route", true);
        else if (tag !== "Route" && ["href", "to", "route", "destination", "returnTo", "backTo", "targetRoute"].includes(name))
          record(attr, attr.initializer, `${tag}.${name}`);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(source).replace(/^["']|["']$/g, "");
      const container = node.parent.parent;
      const queryParameters = ts.isNewExpression(container) && container.expression.getText(source) === "URLSearchParams";
      if (!queryParameters && ["route", "path", "href", "to", "destination", "returnTo", "backTo", "targetRoute", "redirectTo"].includes(name))
        record(node, node.initializer, `metadata.${name}`);
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      if (navigationCalls.has(name) || /^(router\.(push|replace)|history\.(push|replace)|(?:window\.)?location\.(assign|replace))$/.test(name))
        record(node, node.arguments[0], `call.${name}`);
      if (/^(?:window\.)?history\.(?:pushState|replaceState)$/.test(name) && node.arguments[2])
        record(node, node.arguments[2], `call.${name}`);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        /^(?:window\.)?location(?:\.(href|pathname))?$/.test(node.left.getText(source)))
      record(node, node.right, "location assignment");
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}

// Match the literal/parameter/optional/wildcard forms used by the Wouter registry.
// Unsupported route syntax is not treated as a universal match.
export function routePattern(route: string): RegExp | null {
  if (!route.startsWith("/") || /[()[\]{}\\]/.test(route)) return null;
  const parts = route.replace(/\/$/, "").split("/").slice(1);
  const escape = (part: string) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let pattern = "^";
  for (const part of parts) {
    if (/^:[\w]+[?]?$/.test(part)) pattern += part.endsWith("?") ? "(?:/[^/]+)?" : "/[^/]+";
    else if (part === "*" || /^\*[\w]+$/.test(part)) pattern += "/.*";
    else if (/[:*?]/.test(part)) return null;
    else pattern += "/" + escape(part);
  }
  return new RegExp(pattern + "/?$", "i");
}

export function classify(value: string, routes: string[]): "matched" | "invalid" | "non-page" | "dynamic" {
  if (!value.startsWith("/") || value.startsWith("//")) return "non-page";
  const pathname = value.split(/[?#]/)[0] || "/";
  if (pathname === "/api" || pathname.startsWith("/api/") ||
      /\.(?:png|jpe?g|gif|webp|svg|ico|mp[34]|wav|pdf|csv|json|txt|woff2?|ttf|css|js|html)$/i.test(pathname))
    return "non-page";
  // Route placeholders/expressions are evidence requiring review, not verified links.
  if (/[:*{}]/.test(pathname)) return "dynamic";
  return routes.some(route => route !== "*" && route !== "/*" && routePattern(route)?.test(pathname))
    ? "matched" : "invalid";
}
