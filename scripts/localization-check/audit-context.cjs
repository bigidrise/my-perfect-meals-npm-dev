const ts = require("typescript");
const { displayConnection } = require("./display-owners.cjs");
function auditContext(source, file, owners = new Map()) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (ast.parseDiagnostics.length) throw Error(`Cannot parse localization audit source: ${file}`);
  const imports = new Map(), spans = [];
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements)
      imports.set(item.name.text, { module: statement.moduleSpecifier.text, original: (item.propertyName || item.name).text });
  }
  function visit(node) {
    if (ts.isJsxText(node)) spans.push({ start: node.pos, end: node.end, kind: "text" });
    if (ts.isStringLiteral(node)) {
      const parent = node.parent;
      if (ts.isJsxAttribute(parent) && parent.initializer === node)
        spans.push({ start: node.getStart(ast) + 1, end: node.end - 1, kind: "prop", connected: !!displayConnection(parent, imports, owners) });
      if (ts.isPropertyAssignment(parent) && parent.initializer === node)
        spans.push({ start: node.getStart(ast) + 1, end: node.end - 1, kind: "config" });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return (position, kind) => spans.some(span => span.kind === kind && !span.connected &&
    position >= span.start && position < span.end);
}
module.exports = { auditContext };
