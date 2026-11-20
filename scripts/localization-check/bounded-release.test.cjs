const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { analyze, introduced } = require("./analyze.cjs");
const { loadResources } = require("./resources.cjs");
const { loadDisplayOwners } = require("./display-owners.cjs");
const { auditContext } = require("./audit-context.cjs");
const { validateSourceDispositions } = require("./clinical-source.cjs");
const read = file => fs.readFileSync(file, "utf8");
const resources = loadResources(read);
const displays = loadDisplayOwners(read, resources);
const owner = "client/src/components/BoundedFixture.tsx";
const scan = (source, dictionaries = resources, owners = displays, protectedTexts = new Set()) =>
  analyze(owner, source, dictionaries, protectedTexts, owners);
const digest = text => crypto.createHash("sha256").update(text).digest("hex");

test("translated navigation props resolve their actual EN/ES owner, including import aliases", () => {
  const source = `import { BackNavigationLabel as Label } from "@/components/navigation/BackNavigationLabel";
    export const X = () => <Label label="Back to Tutorials" />;`;
  assert.deepEqual(scan(source), []);
});
test("unknown labels, arbitrary same-named components and spread props remain findings", () => {
  for (const source of [
    `import { BackNavigationLabel } from "@/components/navigation/BackNavigationLabel"; const X=()=> <BackNavigationLabel label="New unconnected label" />`,
    `import { BackNavigationLabel } from "other-package"; const X=()=> <BackNavigationLabel label="Back to Tutorials" />`,
    `import { BackNavigationLabel } from "@/components/navigation/BackNavigationLabel"; const X=()=> <BackNavigationLabel {...props} label="Back to Tutorials" />`,
  ]) assert.equal(scan(source).length, 1);
});
test("conditional/fallback closed labels connect without hiding unknown branches or arguments", () => {
  const imported = `import { BackNavigationLabel } from "@/components/navigation/BackNavigationLabel";`;
  assert.deepEqual(scan(`${imported} const X=()=> <BackNavigationLabel label={isCat ? "My Perfect Cat" : "My Perfect Dog"} />`), []);
  assert.deepEqual(scan(`${imported} const X=()=> <BackNavigationLabel label={label || "Hub"} />`), []);
  assert.equal(scan(`${imported} const X=()=> <BackNavigationLabel label={flag ? "Back to Tutorials" : "New unconnected label"} />`)[0].text, "New unconnected label");
  assert.equal(scan(`${imported} const X=()=> <BackNavigationLabel label={unknown("Hub")} />`)[0].text, "Hub");
});
test("missing Spanish cannot borrow the closed-component connection", () => {
  const broken = structuredClone(resources);
  delete broken.es.consumerJourney["Back to Tutorials"];
  const owners = loadDisplayOwners(read, broken);
  const source = `import { BackNavigationLabel } from "@/components/navigation/BackNavigationLabel";
    const X=()=> <BackNavigationLabel label="Back to Tutorials" />`;
  assert.equal(scan(source, broken, owners)[0].classification, "interface");
});
test("changed shared renderer fails closed instead of retaining an exemption", () => {
  const owners = loadDisplayOwners(file => read(file).replace("sources.has(label) ? t(label) : label", "label"), resources);
  const source = `import { BackNavigationLabel } from "@/components/navigation/BackNavigationLabel";
    const X=()=> <BackNavigationLabel label="Back to Tutorials" />`;
  assert.equal(scan(source, resources, owners).length, 1);
});
test("translated clinical display names retain protected-review findings", () => {
  const source = `import { ClinicalSupportLabel } from "@/components/ClinicalSupportLabel";
    const X=()=> <ClinicalSupportLabel label="Active Clinical Supports:" />`;
  assert.equal(scan(source)[0].classification, "protected-review");
});
test("enum comparison operands are not copy, but actual rendered branches still are", () => {
  const found = scan(`const X=()=> <p aria-label={phase === "idle" ? "Choose product" : "Stop search"}>
    {sex === "male" ? "Ready to continue" : "Waiting for input"}</p>`);
  assert.deepEqual(found.map(x => x.text).sort(),
    ["Choose product", "Stop search", "Ready to continue", "Waiting for input"].sort());
});
test("an enum that is actually displayed remains a finding", () => {
  assert.ok(scan(`const X=()=> <option value="Other">Other</option>`).some(x => x.text === "Other"));
});
test("runtime-only templates add no authored copy; templates with words still fail", () => {
  assert.deepEqual(scan('const X=()=> <span>{`${name}`}</span>'), []);
  assert.ok(scan('const X=()=> <span>{`Hello ${name}`}</span>').some(x => x.text.includes("Hello")));
});
test("legacy ratchet excludes TypeScript syntax without losing real JSX/config candidates", () => {
  const source = `type P = { accept: () => void | Promise<void> };
    const item = { title: "Visible title" };
    const X=()=> <section title="Visible tooltip">Visible heading</section>;`;
  const context = auditContext(source, owner);
  assert.equal(context(source.indexOf("void | Promise"), "text"), false);
  assert.equal(context(source.indexOf("Visible heading"), "text"), true);
  assert.equal(context(source.indexOf("Visible tooltip"), "prop"), true);
  assert.equal(context(source.indexOf("Visible title"), "config"), true);
});
test("legacy ratchet recognizes only the actual bound display prop", () => {
  const source = `import { BackNavigationLabel } from "@/components/navigation/BackNavigationLabel";
    const X=()=> <><BackNavigationLabel label="Back to Tutorials" /><button title="New tooltip">New text</button></>;`;
  const context = auditContext(source, owner, displays);
  assert.equal(context(source.indexOf("Back to Tutorials"), "prop"), false);
  assert.equal(context(source.indexOf("New tooltip"), "prop"), true);
});
test("clinical review and duplicate multiplicity are not suppressed by detection repairs", () => {
  const protectedCopy = `import { useTranslation } from "react-i18next";
    function X(){const {t}=useTranslation();return <p>{t("new.clinical")}</p>}`;
  const dictionaries = structuredClone(resources);
  dictionaries.en.translation.new = { clinical: "Clinical guidance" };
  dictionaries.es.translation.new = { clinical: "Orientación clínica" };
  assert.equal(scan(protectedCopy, dictionaries)[0].classification, "protected-review");
  const before = scan("const X=()=> <p>Visible heading</p>");
  const after = scan("const X=()=> <><p>Visible heading</p><p>Visible heading</p></>");
  assert.equal(introduced(before, after).length, 1);
});

function retirement(source = "export const X = () => null;") {
  const entry = {
    file: owner, proposedKey: "old.heading", text: "Retired Clinical Heading",
    disposition: "retired", sourceSha256: digest(source),
    reason: "Approved retirement of an already removed section.",
    evidence: "docs/localization/fixture-review.md",
  };
  return { source, entry, registry: { allStrings: [{ ...entry }] }, document: { version: 1, entries: [entry] } };
}
test("retirement is exact, source-hash-bound and keeps registry identity", () => {
  const f = retirement(), original = JSON.stringify(f.registry);
  assert.equal(validateSourceDispositions(f.registry, f.document, file => file === owner ? f.source : "Reviewed", resources).size, 1);
  assert.equal(JSON.stringify(f.registry), original);
  assert.throws(() => validateSourceDispositions({ allStrings: [] }, f.document, () => f.source, resources), /identity/);
  assert.throws(() => validateSourceDispositions(f.registry, f.document, () => f.source + " ", resources), /renewed review/);
});
test("a retired reference cannot be reactivated even with an updated source hash", () => {
  const f = retirement(`const title = "Retired Clinical Heading";`);
  assert.throws(() => validateSourceDispositions(f.registry, f.document, file => file === owner ? f.source : "Reviewed", resources), /active again/);
});
test("localized ownership requires exact English, Spanish and a recognized bound call", () => {
  const source = `import {useTranslation} from "react-i18next";
    function X(){const {t}=useTranslation();return <p>{t("diabeticBuilder.backLabel")}</p>}`;
  const f = retirement(source);
  Object.assign(f.entry, { text: "Diabetes Hub", disposition: "localized-display-owner",
    resource: { namespace: "translation", key: "diabeticBuilder.backLabel" } });
  f.registry.allStrings = [{ ...f.entry }];
  const reader = file => file === owner ? source : "Reviewed source move";
  assert.equal(validateSourceDispositions(f.registry, f.document, reader, resources).size, 1);
  const broken = source.replace('const {t}=useTranslation();', 'const t=unknown;');
  f.entry.sourceSha256 = digest(broken);
  assert.throws(() => validateSourceDispositions(f.registry, f.document,
    file => file === owner ? broken : "Reviewed source move", resources), /recognized bound translation/);
});
test("all approved current source dispositions validate without clearing six clinical holds", () => {
  const registry = JSON.parse(read("docs/localization/clinical-registry.json"));
  const document = JSON.parse(read("docs/localization/release-source-dispositions.json"));
  const accepted = validateSourceDispositions(registry, document, read, resources);
  assert.equal([...accepted.values()].filter(x => x === "retired").length, 5);
  assert.equal([...accepted.values()].filter(x => x === "localized-display-owner").length, 1);
  const missing = registry.allStrings.filter(entry =>
    !read(entry.file).includes(entry.text) && !accepted.has(`${entry.file}#${entry.proposedKey}`));
  assert.equal(missing.length, 6);
  assert.ok(missing.every(entry => /(?:Learn|EditProfilePage)\.tsx$/.test(entry.file)));
});
