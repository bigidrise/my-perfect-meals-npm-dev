// Static resource reader: no application imports, VM evaluation, providers or writes.
const ts = require("typescript");
const protectedWords = /\b(allerg(?:y|ies|en)|anaphylaxis|insulin|glucose|HbA1c|dosage|medication|prescription|contraindication|pregnan\w*|trimester|diagnos\w*|medical advice|clinical|consent|legal agreement|terms of service|privacy policy)\b/i;

function unwrap(node) {
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression;
  return node;
}
function stringsObject(read, file, name, spreads = {}) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) throw Error(`Cannot parse resource module: ${file}`);
  let expression;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations)
      if (declaration.name.getText(source) === name) expression = unwrap(declaration.initializer);
  }
  if (!expression || !ts.isObjectLiteralExpression(expression)) throw Error(`Unsupported static dictionary: ${file}#${name}`);
  const result = Object.create(null);
  for (const property of expression.properties) {
    if (ts.isSpreadAssignment(property)) {
      const key = property.expression.getText(source);
      if (!Object.hasOwn(spreads, key)) throw Error(`Unregistered dictionary spread: ${file}#${key}`);
      Object.assign(result, spreads[key]);
    } else if (ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      (ts.isStringLiteral(unwrap(property.initializer)) || ts.isNoSubstitutionTemplateLiteral(unwrap(property.initializer)))) {
      result[property.name.text] = unwrap(property.initializer).text;
    } else throw Error(`Unsupported resource expression in ${file}#${name}; extend the static reader with tests.`);
  }
  return result;
}
// Explicit, lazy registrations: historical snapshots need only dictionaries
// they actually spread. Unknown spreads and executable values still fail closed.
function registeredSpreads(read, definitions) {
  const spreads = Object.create(null);
  for (const [name, file] of Object.entries(definitions)) {
    Object.defineProperty(spreads, name, {
      enumerable: true,
      get: () => stringsObject(read, file, name),
    });
  }
  return spreads;
}
function hasCalculatorNamespace(read) {
  const file = "client/src/i18n/index.ts";
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length) throw Error(`Cannot parse resource module: ${file}`);
  let initialization;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "init" && node.arguments[0] &&
      ts.isObjectLiteralExpression(unwrap(node.arguments[0]))) initialization = unwrap(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const property = (object, name) => object && ts.isObjectLiteralExpression(object)
    ? object.properties.find(item => ts.isPropertyAssignment(item) &&
      (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name)?.initializer
    : undefined;
  const resources = unwrap(property(initialization, "resources"));
  const english = property(unwrap(property(resources, "en")), "macroCalculatorCopy");
  const spanish = property(unwrap(property(resources, "es")), "macroCalculatorCopy");
  if (!english && !spanish) return false;
  if (!english || !spanish || english.getText(ast) !== "macroCalculatorEnglish" ||
    spanish.getText(ast) !== "macroCalculatorSpanish")
    throw Error(`Resource construction changed: ${file}#macroCalculatorCopy. Both EN/ES registrations must match the reviewed catalog.`);
  return true;
}
function loadResources(read) {
  const en = JSON.parse(read("client/src/i18n/locales/en.json"));
  const es = JSON.parse(read("client/src/i18n/locales/es.json"));
  const startupFile = "shared/consumerStartupCopy.ts";
  const startupEn = stringsObject(read, startupFile, "startupEnglish");
  const startupEs = stringsObject(read, startupFile, "startupSpanish");
  const approved = stringsObject(read, "client/src/i18n/approvedConsumerOnboarding.ts", "approvedConsumerOnboardingSpanish");
  // The adoption commit predates this module. Require it only when the
  // consumer dictionary actually spreads it; never hide a missing current file.
  const food = /\.\.\.\s*foodWorkflowSpanish\b/.test(read("client/src/i18n/consumerJourney.ts"))
    ? stringsObject(read, "client/src/i18n/foodWorkflowCopy.ts", "foodWorkflowSpanish")
    : {};
  const features = /\.\.\.\s*consumerFeatureSpanish\b/.test(read("client/src/i18n/consumerJourney.ts"))
    ? stringsObject(read, "client/src/i18n/consumerFeatureCopy.ts", "consumerFeatureSpanish", registeredSpreads(read, {
      savedGroceriesSpanish: "client/src/i18n/savedGroceriesCopy.ts",
      ingredientAnalysisLabelsSpanish: "client/src/i18n/ingredientAnalysisLabels.ts",
      biometricsSpanish: "client/src/i18n/biometricsCopy.ts",
      biometricsClinicalSpanish: "client/src/i18n/biometricsClinicalCopy.ts",
      trainingScheduleSpanish: "client/src/i18n/trainingScheduleCopy.ts",
    }))
    : {};
  const dailyDisplay = /\.\.\.\s*consumerDailyDisplaySpanish\b/.test(read("client/src/i18n/consumerJourney.ts"))
    ? stringsObject(read, "client/src/i18n/consumerDailyDisplayCopy.ts", "consumerDailyDisplaySpanish")
    : {};
  const trainingExplanations = /\.\.\.\s*approvedTrainingExplanationSpanish\b/.test(read("client/src/i18n/consumerJourney.ts"))
    ? stringsObject(read, "client/src/i18n/approvedTrainingExplanations.ts", "approvedTrainingExplanationSpanish")
    : {};
  const phrases = Object.fromEntries(Object.entries(startupEn).map(([key, phrase]) => [phrase, startupEs[key]]));
  const consumerEs = stringsObject(read, "client/src/i18n/consumerJourney.ts", "consumerSpanish", {
    startupPhraseTranslations: phrases, approvedConsumerOnboardingSpanish: approved, foodWorkflowSpanish: food,
    consumerFeatureSpanish: features, consumerDailyDisplaySpanish: dailyDisplay,
    approvedTrainingExplanationSpanish: trainingExplanations,
  });
  const consumerEn = Object.fromEntries(Object.keys(consumerEs).map(key => [key, key]));
  // Never silently model a changed runtime resource-construction contract.
  assertDerived(read, "client/src/i18n/consumerJourney.ts", "consumerEnglish",
    "Object.fromEntries(Object.keys(consumerSpanish).map(key => [key, key]))");
  assertDerived(read, startupFile, "startupPhraseTranslations",
    "Object.fromEntries(Object.entries(startupEnglish).map(([key, phrase]) => [phrase, startupSpanish[key as keyof typeof startupEnglish]]))");
  const calculator = {};
  if (hasCalculatorNamespace(read)) {
    const file = "client/src/i18n/macroCalculatorCopy.ts";
    const spanish = stringsObject(read, file, "macroCalculatorSpanish");
    assertDerived(read, file, "macroCalculatorEnglish",
      "Object.fromEntries(Object.keys(macroCalculatorSpanish).map(key => [key, key]))");
    calculator.en = { macroCalculatorCopy: Object.fromEntries(Object.keys(spanish).map(key => [key, key])) };
    calculator.es = { macroCalculatorCopy: spanish };
  }
  return {
    en: { ...en, translation: en, consumerJourney: consumerEn, ...calculator.en },
    es: { ...es, translation: es, consumerJourney: consumerEs, ...calculator.es },
  };
}
function assertDerived(read, file, name, expected) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  let initializer;
  for (const statement of ast.statements) if (ts.isVariableStatement(statement))
    for (const declaration of statement.declarationList.declarations)
      if (declaration.name.getText(ast) === name) initializer = unwrap(declaration.initializer);
  const normalized = value => value.replace(/[\s,]/g, "");
  if (!initializer || normalized(initializer.getText(ast)) !== normalized(expected))
    throw Error(`Resource construction changed: ${file}#${name}. Review and extend the static resource reader with tests.`);
}
function lookup(resources, language, namespace, key) {
  const dictionary = resources[language]?.[namespace];
  if (!dictionary) return undefined;
  if (Object.hasOwn(dictionary, key)) return dictionary[key];
  return key.split(".").reduce((value, part) => value && Object.hasOwn(value, part) ? value[part] : undefined, dictionary);
}
function flatten(value, prefix = "", result = {}) {
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") result[full] = child;
    else if (child && typeof child === "object") flatten(child, full, result);
  }
  return result;
}
const variables = text => [...text.matchAll(/\{\{\s*-?\s*([\w.]+)(?:,[^}]+)?\s*\}\}/g)].map(match => match[1]).sort().join("|");
function resourceFindings(resources) {
  const results = [];
  for (const [namespace, dict] of Object.entries(resources.en)) {
    if (!dict || typeof dict !== "object") continue;
    const english = flatten(dict), spanish = flatten(resources.es[namespace] || {});
    for (const key of new Set([...Object.keys(english), ...Object.keys(spanish)])) {
      // Spanish may legitimately have an additional plural category (e.g. many).
      const pluralBase = key.replace(/_(zero|one|two|few|many|other)$/, "");
      const en = english[key] ?? (pluralBase !== key && english[`${pluralBase}_one`] && english[`${pluralBase}_other`] ? english[`${pluralBase}_other`] : undefined);
      const es = spanish[key];
      let reason;
      if (typeof en !== "string" || typeof es !== "string" || !en.trim() || !es.trim()) reason = "Missing/empty EN or ES resource";
      else if (/^(TODO|TBD|FIXME|TRANSLATE|\[missing\])$/i.test(es.trim())) reason = "Placeholder Spanish resource";
      else if (variables(en) !== variables(es)) reason = "EN/ES interpolation mismatch";
      if (reason) results.push({ owner: "client/src/i18n", line: 1, kind: "resource", text: `${namespace}:${key}`, detail: `${reason}: ${JSON.stringify([en, es])}`, classification: "missing-connection" });
      else if (protectedWords.test(en))
        results.push({ owner: "client/src/i18n", line: 1, kind: "resource", text: `${namespace}:${key}`,
          detail: `Protected resource requires existing wording approval: ${JSON.stringify([en, es])}`, classification: "protected-review" });
    }
  }
  return results;
}
module.exports = { unwrap, loadResources, lookup, resourceFindings, variables, protectedWords };
