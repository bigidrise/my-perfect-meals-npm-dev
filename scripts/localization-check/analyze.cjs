const ts = require("typescript");
const { unwrap, lookup, variables, protectedWords } = require("./resources.cjs");
const literal = node => {
  node = unwrap(node);
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
};
const walk = (node, fn) => { fn(node); ts.forEachChild(node, child => walk(child, fn)); };
const displayNames = /^(title|description|label|message|text|heading|body|placeholder|emptyMessage|emptyText|loadingText|buttonText|helperText|confirmText|cancelText|tooltip|ariaLabel|aria-label|aria-description|alt)$/;
const nonTargets = /^(My Perfect Meals|MPM|GLP-1|BMI|TDEE|API|AI|AI™|™|®|kg|g|mg|ml|mL|L|oz|lb|lbs|cm|mm|kcal|mmHg|tbsp|tsp|https?:\/\/\S+)$/;
const normalize = value => value.replace(/\s+/g, " ").trim();
function scopeOf(node) {
  for (let p = node.parent; p; p = p.parent)
    if (ts.isSourceFile(p) || ts.isFunctionLike(p) || ts.isBlock(p)) return p;
}
function analyze(owner, text, resources, protectedTexts = new Set()) {
  const ast = ts.createSourceFile(owner, text, ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(owner) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw Error(`Cannot parse ${owner}: ${ts.flattenDiagnosticMessageText(ast.parseDiagnostics[0].messageText, " ")}`);
  const imports = new Map(), bindings = new Map(), connected = new Set(), records = [];
  function bind(node, name, info) {
    const scope = scopeOf(node);
    if (!bindings.has(scope)) bindings.set(scope, new Map());
    bindings.get(scope).set(name, info);
  }
  function resolve(node, name) {
    for (let p = node; p; p = p.parent) {
      if (bindings.get(p)?.has(name)) return bindings.get(p).get(name);
    }
  }
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const module = literal(statement.moduleSpecifier);
    if (statement.importClause.name) imports.set(statement.importClause.name.text, { module, original: "default" });
    const names = statement.importClause.namedBindings;
    if (names && ts.isNamedImports(names)) for (const item of names.elements)
      imports.set(item.name.text, { module, original: (item.propertyName || item.name).text });
  }
  function hookInfo(call) {
    if (!ts.isCallExpression(call)) return null;
    const imported = imports.get(call.expression.getText(ast));
    if (!imported) return null;
    if (imported.original === "useTranslation" && imported.module === "react-i18next")
      return { consumer: false, namespace: literal(call.arguments[0]) || (call.arguments.length ? null : "translation") };
    if (imported.original === "useConsumerCopy" && /(?:^|\/)useConsumerCopy$/.test(imported.module))
      return { consumer: true, namespace: literal(call.arguments[0]) || (call.arguments.length ? null : "translation") };
    return null;
  }
  walk(ast, node => {
    // Shadowing must not borrow another scope's translation helper.
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) bind(node, node.name.text, { unknown: true });
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const info = hookInfo(unwrap(node.initializer));
      if (ts.isObjectBindingPattern(node.name)) for (const item of node.name.elements) {
        if (ts.isIdentifier(item.name))
          bind(node, item.name.text, info && (item.propertyName || item.name).getText(ast) === "t" ? info : { unknown: true });
      } else if (ts.isIdentifier(node.name)) {
        bind(node, node.name.text, info ? { ...info, object: true } : { unknown: true });
      }
    }
  });
  function translationInfo(node) {
    if (!ts.isCallExpression(node)) return null;
    if (ts.isIdentifier(node.expression)) return resolve(node, node.expression.text);
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "t") {
      const object = node.expression.expression.getText(ast), bound = resolve(node, object);
      if (bound?.object) return bound;
      const imported = imports.get(object);
      if (imported && (imported.module === "i18next" || /(?:^|\/)i18n$/.test(imported.module))) return { namespace: "translation" };
    }
    return null;
  }
  function add(node, value, kind, classification, detail = "") {
    const trimmed = normalize(value);
    if (!/[A-Za-zÀ-ž]{2}/.test(trimmed) && kind !== "connection") return;
    if (nonTargets.test(trimmed) && kind !== "connection") return;
    if (protectedWords.test(trimmed) || protectedTexts.has(trimmed)) classification = "protected-review";
    records.push({ owner, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      kind, text: trimmed, classification, detail });
  }
  walk(ast, node => {
    if (!ts.isCallExpression(node)) return;
    const info = translationInfo(node);
    if (!info || info.unknown) {
      if (ts.isIdentifier(node.expression) && /^(t|tr|translate)$/.test(node.expression.text)) {
        connected.add(node);
        add(node, node.getText(ast), "connection", "review", "Unresolved translator binding; do not assume an arbitrary helper owns EN/ES resources.");
      }
      return;
    }
    connected.add(node);
    const keyValue = literal(node.arguments[0]), options = node.arguments[1];
    let namespace = info.namespace, key = keyValue, count = false;
    if (options && ts.isObjectLiteralExpression(options)) for (const prop of options.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = prop.name.getText(ast).replace(/["']/g, "");
      if (name === "ns") namespace = literal(prop.initializer);
      if (name === "count") count = true;
    }
    if (info.consumer && key && typeof lookup(resources, "en", "consumerJourney", key) === "string") namespace = "consumerJourney";
    else if (key?.includes(":")) [namespace, key] = key.split(/:(.*)/s);
    if (key === null || !namespace) {
      add(node, node.getText(ast), "connection", "review", "Dynamic key/namespace: provide bounded ownership evidence.");
      return;
    }
    const forms = count ? ["_one", "_other"] : [""];
    const values = forms.flatMap(suffix => ["en", "es"].map(lang =>
      lookup(resources, lang, namespace, key + suffix) ?? lookup(resources, lang, namespace, key)));
    if (values.some(value => typeof value !== "string" || !value.trim())) {
      add(node, `${namespace}:${key}`, "connection", "missing-connection", "Exact EN/ES value or count plural forms missing; English defaultValue is not a Spanish connection.");
    } else if (forms.some((_, i) => variables(values[i * 2]) !== variables(values[i * 2 + 1]))) {
      add(node, `${namespace}:${key}`, "connection", "missing-connection", "EN/ES interpolation mismatch.");
    } else if (values.some(value => protectedWords.test(value) || protectedTexts.has(normalize(value)))) {
      add(node, `${namespace}:${key}`, "connection", "protected-review", "New use of protected/clinical wording; use existing approval process, not automatic translation.");
    }
  });
  function insideConnection(node) {
    for (let p = node; p; p = p.parent) if (connected.has(p)) return true;
    return false;
  }
  function directShared(node, value) {
    const parent = node.parent;
    const element = ts.isJsxElement(parent) ? parent : ts.isJsxExpression(parent) && ts.isJsxElement(parent.parent) ? parent.parent : null;
    if (!element) return false;
    const opening = element.openingElement, tag = opening.tagName.getText(ast), imported = imports.get(tag);
    const allowed = {
      "@/components/ui/button": ["Button"],
      "@/components/ui/alert-dialog": ["AlertDialogAction", "AlertDialogCancel"],
      "@/components/ui/toast": ["ToastAction", "ToastTitle", "ToastDescription"],
    };
    if (!imported || !allowed[imported.module]?.includes(imported.original)) return false;
    if (opening.attributes.properties.some(prop => ts.isJsxSpreadAttribute(prop) ||
      (ts.isJsxAttribute(prop) && prop.name.getText(ast) === "asChild"))) return false;
    const actions = ["save","cancel","back","next","continue","done","close","submit","loading","error","tryAgain","confirm","delete","edit","add","remove","search","filter","apply","reset","yes","no","share"];
    return actions.some(action => lookup(resources, "en", "translation", `common.${action}`) === normalize(value) &&
      typeof lookup(resources, "es", "translation", `common.${action}`) === "string");
  }
  walk(ast, node => {
    if (insideConnection(node)) return;
    for (let p = node.parent; p; p = p.parent)
      if (ts.isJsxElement(p) && /^(style|script)$/.test(p.openingElement.tagName.getText(ast))) return;
    if (ts.isJsxText(node)) {
      const value = normalize(node.getText(ast));
      if (value && !directShared(node, value)) add(node, value, "jsx-text", "interface");
      return;
    }
    const value = ts.isTemplateExpression(node)
      ? node.head.text + node.templateSpans.map(span => `{{expression}}${span.literal.text}`).join("")
      : literal(node);
    if (value === null) return;
    const parent = node.parent;
    // Ignore resource/technical attributes including event-handler source and CSS.
    for (let p = node; p && !ts.isSourceFile(p); p = p.parent) {
      if (ts.isFunctionLike(p)) break; // Notification producers inside event callbacks still count.
      if (ts.isJsxAttribute(p)) {
        const name = p.name.getText(ast);
        if (displayNames.test(name)) add(node, value, `attribute:${name}`, "interface");
        return;
      }
    }
    if (ts.isPropertyAssignment(parent) && parent.initializer === node && displayNames.test(parent.name.getText(ast).replace(/["']/g, ""))) {
      const container = parent.parent, call = container.parent;
      const producer = ts.isCallExpression(call) && /(?:^|\.)(toast|notify|alert|confirm|showToast)$/.test(call.expression.getText(ast));
      add(node, value, `property:${parent.name.getText(ast)}`, producer ? "interface" : "review",
        producer ? "Notification producer." : "Configuration/data ownership must be reviewed; not a confirmed customer defect.");
      return;
    }
    if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
      /(?:^|\.)(toast|notify|alert|confirm|showToast|setError|Notification)$/.test(parent.expression.getText(ast))) {
      add(node, value, "notification", "interface"); return;
    }
    // JSX conditional/fallback literals, but not machine arguments to arbitrary calls.
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p)) break;
      if (ts.isJsxExpression(p)) {
        if (!directShared(node, value)) add(node, value, "jsx-expression", "interface");
        return;
      }
      if (ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p)) break;
    }
    if (ts.isBinaryExpression(parent) && parent.right === node && /(?:textContent|innerText)$/.test(parent.left.getText(ast))) {
      add(node, value, "dom-text", "interface"); return;
    }
    if (ts.isVariableDeclaration(parent) && (displayNames.test(parent.name.getText(ast)) || /(?:Label|Title|Message|Text)$/.test(parent.name.getText(ast))))
      add(node, value, "copy-variable", "review", "Potential displayed copy; establish the variable's caller ownership.");
    if (ts.isArrayLiteralExpression(parent)) {
      let p = parent.parent;
      if (ts.isVariableDeclaration(p) && /messages|labels|copy|titles/i.test(p.name.getText(ast)))
        add(node, value, "copy-array", "review", "Potential shared interface copy; establish caller ownership.");
    }
  });
  return records;
}
function introduced(before, after) {
  const identity = item => JSON.stringify([item.owner, item.kind, item.text, item.classification, item.detail]);
  const counts = new Map();
  for (const item of before) counts.set(identity(item), (counts.get(identity(item)) || 0) + 1);
  return after.filter(item => {
    const id = identity(item), remaining = counts.get(id) || 0;
    if (remaining) { counts.set(id, remaining - 1); return false; }
    return true;
  });
}
module.exports = { analyze, introduced, normalize };
