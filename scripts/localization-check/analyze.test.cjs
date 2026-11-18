const { test } = require("node:test");
const assert = require("node:assert/strict");
const { analyze, introduced } = require("./analyze.cjs");
const { resourceFindings } = require("./resources.cjs");
const resources = {
  en: { translation: { common: { save: "Save" }, greeting: "Hello {{name}}", count_one: "{{count}} item", count_other: "{{count}} items" },
    shopping: { brands_one: "{{count}} brand", brands_other: "{{count}} brands" }, consumerJourney: { "Listen": "Listen" } },
  es: { translation: { common: { save: "Guardar" }, greeting: "Hola {{name}}", count_one: "{{count}} elemento", count_other: "{{count}} elementos" },
    shopping: { brands_one: "{{count}} marca", brands_other: "{{count}} marcas" }, consumerJourney: { "Listen": "Escuchar" } },
};
const scan = source => analyze("client/src/components/Example.tsx", source, resources);
test("flags headings, labels, menu/dialog content, accessibility and conditional fallback text", () => {
  const result = scan(`export const X = () => <Dialog title="Choose a dish"><h2>New meals</h2><input placeholder={"Find food"} aria-label="Food search" /><span>{error ? "Try again please" : "Ready now"}</span></Dialog>`);
  for (const text of ["Choose a dish", "New meals", "Find food", "Food search", "Try again please", "Ready now"])
    assert.ok(result.some(item => item.text === text), text);
  assert.ok(result.every(item => item.owner.endsWith("Example.tsx") && item.line > 0));
});
test("notification literals and templates inside JSX callbacks are not hidden", () => {
  const result = scan('const X = () => <button onClick={() => toast({title: "Added to shopping", description: `${count} items added`})}>Go shopping</button>');
  assert.ok(result.some(item => item.text === "Added to shopping" && item.classification === "interface"));
  assert.ok(result.some(item => item.text === "{{expression}} items added"));
});
test("technical attrs, identifiers, quantities, proper brand, units and authored runtime values are not literals to translate", () => {
  assert.deepEqual(scan(`const route = "/shopping"; const productId = "food_123"; const kg = "kg"; const result = <div className="bg-black flex" data-testid="my-title">{meal.title}{message.body}<p>My Perfect Meals</p><code>kg</code></div>`), []);
});
test("config data and copy arrays need review, not a confirmed-defect label", () => {
  const result = scan('const meals = [{title: "Chicken salad"}]; const loadingMessages = ["Preparing options"];');
  assert.equal(result.length, 2);
  assert.ok(result.every(item => item.classification === "review"));
});
test("protected source wording never becomes an ordinary technical exemption", () => {
  const result = scan('const X = () => <p>Review your insulin dosage</p>');
  assert.equal(result[0].classification, "protected-review");
  assert.equal(analyze("client/src/X.tsx", 'const X = () => <p>Custom safety instruction</p>', resources, new Set(["Custom safety instruction"]))[0].classification, "protected-review");
});
test("legacy hook alias, destructured translator alias, namespaces and count plurals resolve", () => {
  const result = scan(`import {useTranslation as useLocale} from "react-i18next";
    function X(){const {t: tr}=useLocale("shopping"); return <span>{tr("brands",{count:2})}</span>}`);
  assert.deepEqual(result, []);
});
test("consumer hook alias and object translator bind to their own namespace", () => {
  assert.deepEqual(scan(`import {useConsumerCopy as useTranslation} from "@/i18n/useConsumerCopy";
    function X(){const copy=useTranslation("shopping");return <>{copy.t("Listen")}{copy.t("brands",{count:3})}</>}`), []);
});
test("multiple hooks stay separate and do not use another function's namespace", () => {
  const result = scan(`import {useTranslation} from "react-i18next";
    function X(){const {t}=useTranslation("shopping");return <>{t("brands",{count:2})}</>}
    function Y(){const {t}=useTranslation();return <>{t("greeting",{name:"A"})}</>}`);
  assert.deepEqual(result, []);
});
test("shadowed or unrecognized translator bindings require review rather than borrowing a hook", () => {
  const result = scan(`import {useTranslation} from "react-i18next";function X(){const {t}=useTranslation();return data.map(t=><span>{t("greeting")}</span>)}`);
  assert.equal(result[0].classification, "review");
});
test("count interpolation can legitimately use a direct nonplural resource", () => {
  assert.deepEqual(scan(`import {useTranslation} from "react-i18next";function X(){const {t}=useTranslation();return <>{t("greeting",{count:2,name:"A"})}</>}`), []);
});
test("English fallback/default text is not accepted as a missing Spanish connection", () => {
  const result = scan(`import {useTranslation} from "react-i18next"; function X(){const {t}=useTranslation();return <>{t("newKey",{defaultValue:"A new label"})}</>}`);
  assert.equal(result.length, 1);
  assert.equal(result[0].classification, "missing-connection");
});
test("dynamic translation keys require bounded review and interpolation is checked", () => {
  assert.equal(scan(`import {useTranslation} from "react-i18next";function X(){const {t}=useTranslation();return <>{t(key)}</>}`)[0].classification, "review");
  const bad = structuredClone(resources); bad.es.translation.greeting = "Hola {{other}}";
  assert.equal(analyze("client/src/X.tsx", `import {useTranslation} from "react-i18next";function X(){const {t}=useTranslation();return <>{t("greeting")}</>}`, bad)[0].classification, "missing-connection");
});
test("shared-label connection applies only to actual direct imported children, not nested markup, PillButton or asChild", () => {
  assert.deepEqual(scan(`import {Button as B} from "@/components/ui/button";const X=()=> <B>Save</B>`), []);
  assert.equal(scan(`import {Button} from "@/components/ui/button";const X=()=> <Button><span>Save</span></Button>`)[0].text, "Save");
  assert.equal(scan(`import {Button} from "@/components/ui/button";const X=()=> <Button asChild>Save</Button>`)[0].text, "Save");
  assert.equal(scan(`const X=()=> <PillButton>Save</PillButton>`)[0].text, "Save");
});
test("CSS in style JSX is non-target when not an interface sink", () => {
  // Style bodies are handled separately from ordinary JSX copy below.
  const result = scan('const style = {color: "red"}; const css = `@media (max-width: 400px) { color: red }`;');
  assert.deepEqual(result, []);
  assert.deepEqual(scan('const X=()=> <style>{`@media (max-width: 400px) { .foo {color:red;} }`}</style>'), []);
});
test("new text in an existing file is caught even if unrelated debt is removed", () => {
  const before = scan('const X=()=> <><span>Old English</span><span>Keep this</span></>');
  const after = scan('const X=()=> <><span>Keep this</span><span>Brand new English</span></>');
  assert.deepEqual(introduced(before, after).map(item => item.text), ["Brand new English"]);
});
test("duplicate occurrences and changed wrapping are counted without line-only churn", () => {
  const before = scan('const X=()=> <span>Keep this</span>');
  const after = scan('const X=()=> <>\n<span>Keep this</span><span>Keep this</span></>');
  assert.equal(introduced(before, after).length, 1);
  assert.deepEqual(introduced(before, scan('\n\nconst X=()=> <span>Keep this</span>')), []);
});
test("EN/ES additive resources, missing values, placeholders, interpolation and extra plural categories", () => {
  assert.deepEqual(resourceFindings(resources), []);
  const altered = structuredClone(resources);
  altered.es.shopping.brands_many = "{{count}} marcas";
  // A Spanish-specific plural category is valid; no one-to-one plural count gate.
  assert.deepEqual(resourceFindings(altered), []);
  altered.es.consumerJourney.Listen = "";
  assert.ok(resourceFindings(altered).some(item => item.text === "consumerJourney:Listen"));
});
