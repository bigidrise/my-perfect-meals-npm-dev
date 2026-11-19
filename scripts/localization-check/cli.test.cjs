const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { check } = require("./cli.cjs");
const { loadResources } = require("./resources.cjs");
const fixture = (run) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mpm-i18n-guard-"));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q"); git("config", "user.email", "fixture@example.invalid"); git("config", "user.name", "Offline fixture"); git("config", "core.hooksPath", "/dev/null");
  write("client/src/i18n/locales/en.json", '{"common":{"save":"Save"}}');
  write("client/src/i18n/locales/es.json", '{"common":{"save":"Guardar"}}');
  write("client/src/i18n/index.ts", 'i18n.init({resources:{en:{translation:en,consumerJourney:consumerEnglish},es:{translation:es,consumerJourney:consumerSpanish}}});');
  write("shared/consumerStartupCopy.ts", 'export const startupEnglish={loading:"Loading"};export const startupSpanish={loading:"Cargando"};export const startupPhraseTranslations=Object.fromEntries(Object.entries(startupEnglish).map(([key,phrase])=>[phrase,startupSpanish[key as keyof typeof startupEnglish]]));');
  write("client/src/i18n/approvedConsumerOnboarding.ts", 'export const approvedConsumerOnboardingSpanish={"Approved":"Aprobado"};');
  write("client/src/i18n/foodWorkflowCopy.ts", 'export const foodWorkflowSpanish={"Recipe Ready":"Receta lista"};');
  write("client/src/i18n/consumerJourney.ts", 'export const consumerSpanish={...startupPhraseTranslations,...approvedConsumerOnboardingSpanish,"Listen":"Escuchar"};export const consumerEnglish=Object.fromEntries(Object.keys(consumerSpanish).map(key=>[key,key]));');
  write("docs/localization/clinical-registry.json", '{"allStrings":[]}');
  write("client/src/Existing.tsx", 'export const X=()=> <p>Existing English debt</p>');
  git("add", "."); git("commit", "-qm", "Adoption fixture");
  const base = git("rev-parse", "HEAD");
  const config = { version: 1, adoptionBase: base, exceptions: [] };
  const saveConfig = () => write("docs/localization/new-interface-text.json", JSON.stringify(config));
  saveConfig();
  try { run({ root, write, git, base, config, saveConfig }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
};
test("unchanged historical debt is not an incremental failure; committed, staged, unstaged and untracked text is checked", () => fixture(({ root, write, git }) => {
  assert.equal(check(root).findings.length, 0);
  write("client/src/Existing.tsx", 'export const X=()=> <p>New English heading</p>');
  assert.equal(check(root).findings[0].text, "New English heading");
  git("add", "client/src/Existing.tsx");
  assert.equal(check(root).findings.length, 1);
  git("commit", "-qm", "New text");
  assert.equal(check(root).findings.length, 1);
  write("client/src/New.tsx", 'export const X=()=> <input aria-label="Find items" />');
  assert.equal(check(root).findings.length, 2);
}));
test("invalid or unavailable base fails closed; no fallback to HEAD", () => fixture(({ root }) => {
  assert.throws(() => check(root, { base: "missing-base" }));
  const result = execFileSync(process.execPath, ["-e", `
    const {spawnSync}=require("node:child_process");
    const r=spawnSync(process.execPath,[${JSON.stringify(path.resolve(__dirname, "cli.cjs"))},"--base","missing-base"],{cwd:${JSON.stringify(root)},encoding:"utf8"});
    process.stdout.write(JSON.stringify({status:r.status,stderr:r.stderr}));
  `], { encoding: "utf8" });
  const parsed = JSON.parse(result);
  assert.equal(parsed.status, 2);
  assert.match(parsed.stderr, /could not run/);
}));
test("a comparison base before adoption or not in HEAD ancestry is rejected", () => fixture(({ root, write, git, config, saveConfig, base }) => {
  write("note", "after");
  git("add", "note"); git("commit", "-qm", "Later adoption");
  config.adoptionBase = git("rev-parse", "HEAD"); saveConfig();
  assert.throws(() => check(root, { base }));
}));
test("catalog-only missing Spanish change is checked without changed UI files", () => fixture(({ root, write }) => {
  write("client/src/i18n/locales/en.json", '{"common":{"save":"Save","new":"New message"}}');
  assert.ok(check(root).findings.some(item => item.text === "translation:common.new"));
}));
test("pure resource reading supports current additive spreads and refuses executable expressions", () => fixture(({ root, write }) => {
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  assert.equal(loadResources(read).es.consumerJourney.Loading, "Cargando");
  write("client/src/i18n/consumerJourney.ts", 'export const consumerSpanish=fetch("https://example.invalid");');
  assert.throws(() => loadResources(read), /Unsupported static dictionary/);
}));
test("feature dictionaries are loaded lazily and connected saved groceries cannot be missing or executable", () => fixture(({ root, write }) => {
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  // Historical snapshots do not need any of the later feature modules.
  assert.equal(loadResources(read).es.consumerJourney.Loading, "Cargando");
  write("client/src/i18n/consumerJourney.ts", 'export const consumerSpanish={...consumerFeatureSpanish};export const consumerEnglish=Object.fromEntries(Object.keys(consumerSpanish).map(key=>[key,key]));');
  write("client/src/i18n/consumerFeatureCopy.ts", 'export const consumerFeatureSpanish={...savedGroceriesSpanish};');
  assert.throws(() => loadResources(read), /ENOENT/);
  write("client/src/i18n/savedGroceriesCopy.ts", 'export const savedGroceriesSpanish={"Saved Groceries":"Productos guardados"};');
  assert.equal(loadResources(read).es.consumerJourney["Saved Groceries"], "Productos guardados");
  assert.equal(check(root).findings.length, 0);
  write("client/src/i18n/savedGroceriesCopy.ts", 'export const savedGroceriesSpanish={"Saved Groceries":fetch("https://example.invalid")};');
  assert.throws(() => loadResources(read), /Unsupported resource expression/);
}));
test("all current feature spreads and approved training explanations preserve runtime precedence", () => fixture(({ root, write }) => {
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  const definitions = [
    ["savedGroceriesSpanish", "savedGroceriesCopy", "Saved Groceries", "Productos guardados"],
    ["ingredientAnalysisLabelsSpanish", "ingredientAnalysisLabels", "Product summary", "Resumen del producto"],
    ["biometricsSpanish", "biometricsCopy", "Daily progress", "Progreso diario"],
    ["biometricsClinicalSpanish", "biometricsClinicalCopy", "Expanded details", "Detalles ampliados"],
    ["trainingScheduleSpanish", "trainingScheduleCopy", "Training schedule", "Programa de entrenamiento"],
  ];
  for (const [name, file, key, value] of definitions)
    write(`client/src/i18n/${file}.ts`, `export const ${name}=${JSON.stringify({ [key]: value, Shared: name })};`);
  write("client/src/i18n/consumerFeatureCopy.ts", `export const consumerFeatureSpanish={${definitions.map(([name]) => `...${name}`).join(",")},"Shared":"Feature wins"};`);
  write("client/src/i18n/approvedTrainingExplanations.ts", 'export const approvedTrainingExplanationSpanish={"Training explanation":"Explicación del entrenamiento","Shared":"Training wins"};');
  write("client/src/i18n/consumerJourney.ts", 'export const consumerSpanish={...approvedTrainingExplanationSpanish,...consumerFeatureSpanish,"Shared":"Local wins"};export const consumerEnglish=Object.fromEntries(Object.keys(consumerSpanish).map(key=>[key,key]));');
  const resources = loadResources(read);
  for (const [, , key, value] of definitions) assert.equal(resources.es.consumerJourney[key], value);
  assert.equal(resources.es.consumerJourney.Shared, "Local wins");
  assert.equal(resources.es.consumerJourney["Training explanation"], "Explicación del entrenamiento");
  write("client/src/i18n/consumerFeatureCopy.ts", 'export const consumerFeatureSpanish={...unregisteredDictionary};');
  assert.throws(() => loadResources(read), /Unregistered dictionary spread: .*#unregisteredDictionary/);
}));
test("registered feature resources still enforce empty, placeholder, interpolation and protected-copy checks", () => fixture(({ root, write }) => {
  write("client/src/i18n/consumerJourney.ts", 'export const consumerSpanish={...consumerFeatureSpanish};export const consumerEnglish=Object.fromEntries(Object.keys(consumerSpanish).map(key=>[key,key]));');
  write("client/src/i18n/consumerFeatureCopy.ts", 'export const consumerFeatureSpanish={...savedGroceriesSpanish};');
  write("client/src/i18n/savedGroceriesCopy.ts", 'export const savedGroceriesSpanish={"Empty copy":"","Pending copy":"TODO","Day {{day}}":"Día","Medical advice":"Consejo médico"};');
  const findings = check(root).findings;
  for (const key of ["Empty copy", "Pending copy", "Day {{day}}"])
    assert.ok(findings.some(item => item.text === `consumerJourney:${key}` && item.classification === "missing-connection"));
  assert.ok(findings.some(item => item.text === "consumerJourney:Medical advice" && item.classification === "protected-review"));
}));
test("connected approved training explanations remain required, static and subject to review", () => fixture(({ root, write }) => {
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  write("client/src/i18n/consumerJourney.ts", 'export const consumerSpanish={...approvedTrainingExplanationSpanish};export const consumerEnglish=Object.fromEntries(Object.keys(consumerSpanish).map(key=>[key,key]));');
  assert.throws(() => loadResources(read), /ENOENT/);
  write("client/src/i18n/approvedTrainingExplanations.ts", 'export const approvedTrainingExplanationSpanish={"Medical advice":"Consejo médico"};');
  assert.ok(check(root).findings.some(item => item.classification === "protected-review"));
  write("client/src/i18n/approvedTrainingExplanations.ts", 'export const approvedTrainingExplanationSpanish=fetch("https://example.invalid");');
  assert.throws(() => loadResources(read), /Unsupported static dictionary/);
}));
test("calculator resources follow actual namespace registration and preserve strict construction checks", () => fixture(({ root, write }) => {
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  assert.equal(loadResources(read).es.macroCalculatorCopy, undefined);
  const connectedIndex = 'i18n.init({resources:{en:{macroCalculatorCopy:macroCalculatorEnglish},es:{macroCalculatorCopy:macroCalculatorSpanish}}});';
  write("client/src/i18n/index.ts", connectedIndex);
  assert.throws(() => loadResources(read), /ENOENT/);
  const catalog = 'export const macroCalculatorSpanish={"Goal:":"Objetivo:","Meal {{count}}":"Comida {{count}}"};';
  write("client/src/i18n/macroCalculatorCopy.ts", catalog + 'export const macroCalculatorEnglish=Object.fromEntries(Object.keys(macroCalculatorSpanish).map(key=>[key,key]));');
  assert.equal(loadResources(read).en.macroCalculatorCopy["Goal:"], "Goal:");
  assert.equal(loadResources(read).es.macroCalculatorCopy["Goal:"], "Objetivo:");
  write("client/src/i18n/index.ts", 'i18n.init({resources:{en:{macroCalculatorCopy:macroCalculatorEnglish},es:{}}});');
  assert.throws(() => loadResources(read), /Both EN\/ES registrations/);
  write("client/src/i18n/index.ts", connectedIndex);
  write("client/src/i18n/macroCalculatorCopy.ts", catalog + 'export const macroCalculatorEnglish={};');
  assert.throws(() => loadResources(read), /Resource construction changed/);
}));
test("daily display resources are required when connected and preserve existing resource precedence", () => fixture(({ root, write }) => {
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  assert.equal(loadResources(read).es.consumerJourney.Approved, "Aprobado");
  write("client/src/i18n/consumerJourney.ts", 'export const consumerSpanish={...consumerDailyDisplaySpanish,...approvedConsumerOnboardingSpanish};export const consumerEnglish=Object.fromEntries(Object.keys(consumerSpanish).map(key=>[key,key]));');
  assert.throws(() => loadResources(read), /ENOENT/);
  write("client/src/i18n/consumerDailyDisplayCopy.ts", 'export const consumerDailyDisplaySpanish={"Past Entries":"Entradas anteriores","Approved":"No debe reemplazar"};');
  assert.equal(loadResources(read).es.consumerJourney["Past Entries"], "Entradas anteriores");
  assert.equal(loadResources(read).es.consumerJourney.Approved, "Aprobado");
  write("client/src/i18n/consumerDailyDisplayCopy.ts", 'export const consumerDailyDisplaySpanish=fetch("https://example.invalid");');
  assert.throws(() => loadResources(read), /Unsupported static dictionary/);
}));
test("daily display resources cannot bypass interpolation or protected-wording checks", () => fixture(({ root, write }) => {
  write("client/src/i18n/consumerJourney.ts", 'export const consumerSpanish={...consumerDailyDisplaySpanish};export const consumerEnglish=Object.fromEntries(Object.keys(consumerSpanish).map(key=>[key,key]));');
  write("client/src/i18n/consumerDailyDisplayCopy.ts", 'export const consumerDailyDisplaySpanish={"Day {{day}}":"Día","Medical advice":"Consejo médico"};');
  const findings = check(root).findings;
  assert.ok(findings.some(item => item.text === "consumerJourney:Day {{day}}" && item.classification === "missing-connection"));
  assert.ok(findings.some(item => item.text === "consumerJourney:Medical advice" && item.classification === "protected-review"));
}));
test("food dictionary is optional before adoption but required when connected, and checked statically", () => fixture(({ root, write }) => {
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  fs.unlinkSync(path.join(root, "client/src/i18n/foodWorkflowCopy.ts"));
  assert.equal(loadResources(read).es.consumerJourney.Loading, "Cargando");
  write("client/src/i18n/consumerJourney.ts", 'export const consumerSpanish={...startupPhraseTranslations,...approvedConsumerOnboardingSpanish,...foodWorkflowSpanish};export const consumerEnglish=Object.fromEntries(Object.keys(consumerSpanish).map(key=>[key,key]));');
  assert.throws(() => loadResources(read), /ENOENT/);
  write("client/src/i18n/foodWorkflowCopy.ts", 'export const foodWorkflowSpanish={"Recipe Ready":"Receta lista"};');
  assert.equal(loadResources(read).es.consumerJourney["Recipe Ready"], "Receta lista");
  assert.equal(check(root).findings.length, 0);
  write("client/src/i18n/foodWorkflowCopy.ts", 'export const foodWorkflowSpanish={"Recipe Ready":fetch("https://example.invalid")};');
  assert.throws(() => loadResources(read), /Unsupported resource expression/);
}));
test("exact non-target review exceptions require source hash and evidence; cannot suppress confirmed interface or protected copy", () => fixture(({ root, write, config, saveConfig }) => {
  const owner = "client/src/Data.ts", text = 'const recipe={title:"Historical recipe name"};';
  write(owner, text);
  const finding = check(root).findings[0];
  write("docs/localization/decisions.md", "Reviewed: fixture is authored historical recipe data.");
  config.exceptions.push({ owner, kind: finding.kind, text: finding.text, disposition: "non-target",
    reason: "Historical recipe data, not newly authored interface copy.", evidence: "docs/localization/decisions.md",
    sourceSha256: require("node:crypto").createHash("sha256").update(text).digest("hex") });
  saveConfig();
  assert.equal(check(root).findings.length, 0);
  assert.equal(check(root).appliedExceptions.length, 1);
  write(owner, text + "\n");
  assert.throws(() => check(root), /Stale exception/);
  const protectedSource = 'const recipe={title:"Check your insulin dosage"};';
  write(owner, protectedSource);
  config.exceptions[0].text = "Check your insulin dosage";
  config.exceptions[0].sourceSha256 = require("node:crypto").createHash("sha256").update(protectedSource).digest("hex");
  saveConfig();
  assert.throws(() => check(root), /cannot suppress protected-review/);
}));
test("ordinary server notification producers remain in scope without starting the server", () => fixture(({ root, write }) => {
  write("server/services/notification.ts", 'const payload={title:"New update",body:"Your plan changed"};');
  assert.equal(check(root).findings.length, 2);
  assert.ok(check(root).findings.every(item => item.classification === "review"));
}));
test("changed protected resources require review even without source changes", () => fixture(({ root, write }) => {
  write("client/src/i18n/locales/en.json", '{"common":{"save":"Save"},"clinical":"Check your insulin dosage"}');
  write("client/src/i18n/locales/es.json", '{"common":{"save":"Guardar"},"clinical":"Comprueba tu dosis de insulina"}');
  assert.ok(check(root).findings.some(item => item.classification === "protected-review"));
}));
test("changed executable resource construction fails closed instead of assuming the old contract", () => fixture(({ root, write }) => {
  write("client/src/i18n/consumerJourney.ts", 'export const consumerSpanish={"Listen":"Escuchar"};export const consumerEnglish={};');
  assert.throws(() => check(root), /Resource construction changed/);
}));
