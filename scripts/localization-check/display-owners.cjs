// Read-only, fail-closed recognition of the two existing closed display maps.
// Unknown imports, labels, changed renderers and missing resources remain findings.
const ts = require("typescript");
const { unwrap, lookup, variables } = require("./resources.cjs");
const compact = text => text.replace(/\s+/g, "");
function loadDisplayOwners(read, resources) {
  const owners = new Map();
  const definitions = [
    {
      module: "@/components/navigation/BackNavigationLabel", component: "BackNavigationLabel",
      file: "client/src/components/navigation/BackNavigationLabel.tsx", variable: "BACK_NAVIGATION_SOURCES",
      functions: {
        useBackNavigationLabel: `{ const { t } = useConsumerCopy(); return useCallback((label: string) => sources.has(label) ? t(label) : label, [t]); }`,
        BackNavigationLabel: `{ const translate = useBackNavigationLabel(); const { t } = useConsumerCopy(); const name = translate(label); return <>{backTo ? t("Back to {{name}}", { name }) : name}</>; }`,
      },
    },
    {
      module: "@/components/ClinicalSupportLabel", component: "ClinicalSupportLabel",
      file: "client/src/components/ClinicalSupportLabel.tsx", variable: "CLINICAL_SUPPORT_RESOURCE_KEYS",
      functions: {
        ClinicalSupportLabel: `{ const { t } = useConsumerCopy(); const key = Object.prototype.hasOwnProperty.call(CLINICAL_SUPPORT_RESOURCE_KEYS, label) ? CLINICAL_SUPPORT_RESOURCE_KEYS[label] : null; return <>{key ? t(key, { defaultValue: label }) : label}</>; }`,
      },
    },
  ];
  for (const definition of definitions) {
    let source;
    try { source = read(definition.file); } catch { continue; } // Absent in older history.
    const ast = ts.createSourceFile(definition.file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    if (ast.parseDiagnostics.length) throw Error(`Cannot parse display owner: ${definition.file}`);
    const functions = new Map(ast.statements.filter(ts.isFunctionDeclaration).map(node => [node.name?.text, node]));
    if (!Object.entries(definition.functions).every(([name, body]) =>
      functions.get(name)?.body && compact(functions.get(name).body.getText(ast)) === compact(body))) continue;
    const hookImport = ast.statements.some(node => ts.isImportDeclaration(node) &&
      node.moduleSpecifier.text === "@/i18n/useConsumerCopy" &&
      node.importClause?.namedBindings?.elements?.some(item => item.name.text === "useConsumerCopy" && !item.propertyName));
    if (!hookImport) continue;
    let initializer;
    for (const statement of ast.statements) if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (declaration.name.getText(ast) === definition.variable) initializer = unwrap(declaration.initializer);
    const mappings = new Map();
    if (initializer && ts.isArrayLiteralExpression(initializer)) {
      if (!initializer.elements.every(ts.isStringLiteral)) continue;
      for (const item of initializer.elements) mappings.set(item.text, item.text);
      // Verify the renderer's membership set was constructed from this exact array.
      if (!source.includes("const sources = new Set<string>(BACK_NAVIGATION_SOURCES);")) continue;
    } else if (initializer && ts.isObjectLiteralExpression(initializer)) {
      if (!initializer.properties.every(item => ts.isPropertyAssignment(item) &&
        ts.isStringLiteral(item.name) && ts.isStringLiteral(item.initializer))) continue;
      for (const item of initializer.properties) mappings.set(item.name.text, item.initializer.text);
    } else continue;
    const labels = new Map();
    for (const [label, key] of mappings) {
      const namespace = typeof lookup(resources, "en", "consumerJourney", key) === "string" ? "consumerJourney" : "translation";
      const en = lookup(resources, "en", namespace, key), es = lookup(resources, "es", namespace, key);
      if (typeof en === "string" && en.trim() && typeof es === "string" && es.trim() &&
          variables(en) === variables(es)) labels.set(label, { namespace, key, en, es });
    }
    owners.set(`${definition.module}#${definition.component}`, labels);
  }
  return owners;
}
function displayConnection(attribute, imports, owners, valueNode = attribute.initializer) {
  if (!ts.isJsxAttribute(attribute) || attribute.name.getText() !== "label" ||
      !attribute.initializer || !valueNode || !ts.isStringLiteral(valueNode)) return null;
  // A closed literal can also be a displayed conditional/fallback branch.
  // Never borrow ownership for predicate operands or arbitrary call arguments.
  let branch = valueNode;
  while (branch !== attribute.initializer) {
    const parent = branch.parent;
    if (ts.isJsxExpression(parent) && parent.expression === branch ||
        ts.isParenthesizedExpression(parent) ||
        ts.isConditionalExpression(parent) && (parent.whenTrue === branch || parent.whenFalse === branch) ||
        ts.isBinaryExpression(parent) && [
          ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken,
        ].includes(parent.operatorToken.kind)) branch = parent;
    else return null;
  }
  const opening = attribute.parent.parent;
  if (opening.attributes.properties.some(ts.isJsxSpreadAttribute)) return null;
  const imported = imports.get(opening.tagName.getText());
  return imported && owners.get(`${imported.module}#${imported.original}`)?.get(valueNode.text) || null;
}
module.exports = { loadDisplayOwners, displayConnection };
