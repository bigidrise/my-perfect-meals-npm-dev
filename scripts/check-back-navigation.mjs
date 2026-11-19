import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const roots = ["client/src"];
const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(path.join(directory, entry.name)) :
    entry.name.endsWith(".tsx") ? [path.join(directory, entry.name)] : []);
const walk = directory => files(directory).filter(file =>
  !file.includes("__tests__") && !file.includes("__mocks__") &&
  !file.startsWith("client/src/legacy/"));
const labelSource = fs.readFileSync("client/src/components/navigation/BackNavigationLabel.tsx", "utf8");
const sourceFile = ts.createSourceFile("labels.tsx", labelSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const known = new Set();
function collect(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === "BACK_NAVIGATION_SOURCES") {
    function strings(child) {
      if (ts.isStringLiteral(child)) known.add(child.text);
      ts.forEachChild(child, strings);
    }
    strings(node);
  }
  ts.forEachChild(node, collect);
}
collect(sourceFile);

const findings = [];
let inspectedFiles = 0;
for (const file of roots.flatMap(walk).sort()) {
  inspectedFiles++;
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function navigationParent(node) {
    let parent = node.parent;
    while (parent && !(ts.isJsxElement(parent) &&
      /^(button|Button|a|Link|NavLink|PillButton|GlassButton)$/.test(parent.openingElement.tagName.getText(source)))) {
      parent = parent.parent;
    }
    return parent;
  }
  function isBackDestination(node) {
    const parent = navigationParent(node);
    if (!parent) return false;
    let arrow = false;
    function inspect(child) {
      if ((ts.isJsxSelfClosingElement(child) || ts.isJsxOpeningElement(child)) &&
        /^(ArrowLeft|ChevronLeft|MoveLeft|CornerUpLeft)$/.test(child.tagName.getText(source))) arrow = true;
      ts.forEachChild(child, inspect);
    }
    inspect(parent);
    return arrow;
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
      /(?:^|\/)legacy\//.test(node.moduleSpecifier.text)) {
      findings.push({ file, kind: "active_import_of_excluded_legacy_page", label: node.moduleSpecifier.text });
    }
    if (ts.isJsxText(node)) {
      const label = node.text.trim().replace(/^←\s*/, "");
      const literalBack = /^(Back|Go [Bb]ack|Return to)(?:\s.+)?$/.test(label) && label !== "Back to";
      if (label && label.length < 120 && navigationParent(node) &&
        (literalBack || known.has(label) && isBackDestination(node))) {
        findings.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, label });
      }
    }
    if (ts.isJsxAttribute(node) && ["aria-label", "title"].includes(node.name.getText(source)) &&
      node.initializer && ts.isStringLiteral(node.initializer) &&
      /^(Back|Go [Bb]ack|Return to|Previous)(?:\s|$)/.test(node.initializer.text)) {
      findings.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        label: node.initializer.text, kind: "accessible_label" });
    }
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText(source) === "BackNavigationLabel") {
      const attribute = node.attributes.properties.find(property =>
        ts.isJsxAttribute(property) && property.name.getText(source) === "label");
      if (attribute?.initializer && ts.isStringLiteral(attribute.initializer) && !known.has(attribute.initializer.text)) {
        findings.push({ file, label: attribute.initializer.text, kind: "unregistered_navigation_label" });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log(JSON.stringify({
  inspectedFiles, excluded: ["tests", "mocks", "unimported retired legacy sources"],
  staticBackLabelFindings: findings.length, findings,
}, null, 2));
process.exitCode = findings.length ? 1 : 0;
