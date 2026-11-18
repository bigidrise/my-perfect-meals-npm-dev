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
