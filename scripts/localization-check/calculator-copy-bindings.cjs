// One-time source migration, also usable as a read-only coverage inventory.
// No DOM scanning, runtime rewriting, canonical option changes or data writes.
const ts = require("typescript");

function bindCalculatorCopy(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [], phrases = new Set();
  const displayAttributes = new Set(["title", "description", "label", "placeholder", "aria-label", "alt"]);
  const displayProperties = new Set(["label", "sub", "desc", "description", "rationale", "explanation"]);
  const displayIdentifiers = new Set(["label", "title", "description", "bullet", "b"]);
  function textCall(text) {
    phrases.add(text);
    return `t(${JSON.stringify(text)})`;
  }
  function attribute(node) {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxAttribute(parent)) return parent.name.getText(tree);
      if (ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent)) return null;
    }
    return null;
  }
  function isToastProperty(node) {
    if (!ts.isPropertyAssignment(node.parent) || !["title", "description"].includes(node.parent.name.getText(tree))) return false;
    const call = node.parent.parent?.parent;
    return ts.isCallExpression(call) && call.expression.getText(tree) === "toast";
  }
  function template(node) {
    let key = node.head.text;
    const values = [];
    node.templateSpans.forEach((span, index) => {
      const name = `value${index + 1}`;
      key += `{{${name}}}${span.literal.text}`;
      values.push(`${name}: ${span.expression.getText(tree)}`);
    });
    phrases.add(key);
    return `t(${JSON.stringify(key)}, { ${values.join(", ")} })`;
  }
  function add(node, replacement) { edits.push({ start: node.getStart(tree), end: node.end, replacement }); }
  function visit(node) {
    if (ts.isJsxText(node)) {
      const raw = source.slice(node.pos, node.end);
      const text = raw.replace(/\s+/g, " ").trim()
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, "\u00a0");
      if (/[A-Za-z]/.test(text)) {
        const leading = /^[ \t]/.test(raw) && !/^[ \t]*\n/.test(raw) ? '{" "}' : "";
        const trailing = /[ \t]$/.test(raw) && !/\n[ \t]*$/.test(raw) ? '{" "}' : "";
        edits.push({ start: node.pos, end: node.end, replacement: `${leading}{${textCall(text)}}${trailing}` });
      }
      return;
    }
    if (ts.isJsxExpression(node) && node.expression) {
      const expression = node.expression, attr = attribute(node);
      if (!attr || displayAttributes.has(attr)) {
        if ((ts.isPropertyAccessExpression(expression) &&
          !expression.expression.getText(tree).startsWith("record") &&
          (displayProperties.has(expression.name.text) || expression.getText(tree) === "entry.name" || expression.getText(tree) === "risk.label")) ||
          (ts.isIdentifier(expression) && displayIdentifiers.has(expression.text)) ||
          (ts.isCallExpression(expression) && ["goalLabel", "bodyTendencyLabel"].includes(expression.expression.getText(tree)))) {
          add(expression, `t(${expression.getText(tree)})`); return;
        }
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!/[A-Za-z]/.test(node.text)) return;
      const parent = node.parent, attr = attribute(node);
      if (ts.isJsxAttribute(parent) && displayAttributes.has(parent.name.getText(tree))) {
        add(node, `{${textCall(node.text)}}`); return;
      }
      if (isToastProperty(node)) { add(node, textCall(node.text)); return; }
      let expr = parent;
      while (ts.isConditionalExpression(expr) || ts.isParenthesizedExpression(expr)) expr = expr.parent;
      if (ts.isJsxExpression(expr) && (!attr || displayAttributes.has(attr))) {
        add(node, textCall(node.text)); return;
      }
    }
    if (ts.isTemplateExpression(node)) {
      const attr = attribute(node);
      let parent = node.parent;
      while (ts.isConditionalExpression(parent) || ts.isParenthesizedExpression(parent)) parent = parent.parent;
      if (((ts.isJsxExpression(parent) && (!attr || displayAttributes.has(attr))) || isToastProperty(node)) &&
          /[A-Za-z]{2}/.test(node.head.text + node.templateSpans.map(span => span.literal.text).join(""))) {
        add(node, template(node)); return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
  if (ts.createSourceFile(file, result, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length) {
    throw new Error(`Invalid transformed calculator source: ${file}`);
  }
  return { file, source: result, phrases: [...phrases], bindingCount: edits.length };
}
function collectSourcePhrases(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const phrases = new Set();
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent, text = node.text;
      const property = ts.isPropertyAssignment(parent) && ["label", "desc", "sub", "description", "title", "name", "rationale", "explanation", "hint", "why", "safetyFloorReason"].includes(parent.name.getText(tree));
      const prose = text.includes(" ") && /[a-z]/.test(text) && !/(?:text-|bg-|border-|items-|justify-|rounded-|flex |grid |https?:|\/api\/|console\.)/.test(text);
      const displayWord = /^[A-Z][a-z]+$/.test(text);
      if ((property || prose || displayWord) && !text.includes("\n") && text.length < 1000) phrases.add(text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return [...phrases];
}
module.exports = { bindCalculatorCopy, collectSourcePhrases };
if (require.main === module && process.argv.includes("--inventory")) {
  const fs = require("fs");
  const files = [
    "client/src/pages/MacroCalculator.tsx", "client/src/lib/clinicalAdvisory.ts",
    "shared/waistRisk.ts", "server/services/macroCalculatorEngine.ts",
    "shared/starchPreferences.ts", "client/src/hooks/useSavedMacroSetup.ts",
    "client/src/lib/guidedJourney/explanation.ts", "client/src/lib/guidedJourney/dashboardModel.ts",
    "client/src/hooks/useGuidedJourneyDashboard.ts",
    "client/src/components/guided/GuidedJourneyExplanation.tsx",
    "client/src/components/guided/GuidedWorkflowNextStep.tsx",
    ...["MetabolicConsiderations", "BodyCompositionSection", "BodyCompositionSheet", "WaistRiskSection"]
      .map(name => `client/src/components/macro-targeting/${name}.tsx`),
  ];
  console.log(JSON.stringify(files.flatMap(file => collectSourcePhrases(file, fs.readFileSync(file, "utf8")))));
}
