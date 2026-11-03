import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { test } from "node:test";
import { analyze, classify } from "./analyze";

const read = (file: string) => fs.readFileSync(file, "utf8");
const routes = analyze("Router.tsx", read("client/src/components/Router.tsx"), true).routes.map(ref => ref.value);

test("approved controls resolve to existing destinations without the obsolete target", () => {
  const cases = [
    ["client/src/pages/TrainingNutritionHub.tsx", "/macro-calculator", "/macro-counter"],
    ["client/src/pages/biometrics/body-composition.tsx", "/macro-calculator", "/macro-counter"],
    ["client/src/pages/my-biometrics.tsx", "/macro-calculator", "/macro-counter"],
    ["client/src/components/copilot/CanonicalAliasRegistry.ts", "/glp1-menu-builder", "/glp1-meal-builder"],
    ["client/src/lib/biometricsNavigation.ts", "/beachbody-meal-board", "/beach-body-meal-board"],
    ["client/src/pages/PricingPage.tsx", "/terms-of-service", "/terms"],
    ["client/src/pages/BusinessInviteAccept.tsx", "/affiliate", "/business-center/affiliate"],
  ];
  for (const [file, previous, destination] of cases) {
    const refs = analyze(file, read(file)).destinations;
    assert.ok(!refs.some(ref => ref.value === previous), `${file}: stale destination`);
    assert.ok(refs.some(ref => ref.value === destination), `${file}: expected destination missing`);
    assert.equal(classify(destination, routes), "matched", destination);
  }
});

test("Biometrics return-source key and professional-session exclusion are retained", () => {
  assert.match(read("client/src/lib/biometricsNavigation.ts"),
    /"beachbody-meal-board":\s*\{[^}]*path:\s*"\/beach-body-meal-board"/);
  assert.match(read("client/src/pages/my-biometrics.tsx"), /returnSource && !isProSession/);
});

test("Quick Demo executes the existing guest-session helper without replacing account identity", () => {
  const file = "client/src/pages/home.tsx";
  const sourceText = read(file);
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let click: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === "onClick" &&
        node.initializer && ts.isJsxExpression(node.initializer) &&
        node.initializer.expression?.getText(source).includes("startGuestSession()"))
      click = node.initializer.expression;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(click, "Quick Demo must use the established guest-session entry");
  const storage = new Map([["userId", "existing-account"], ["authToken", "existing-token"]]);
  const navigations: string[] = [];
  const exports: Record<string, any> = {};
  const context = vm.createContext({
    exports, console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    navigate: (route: string) => navigations.push(route),
  });
  // Execute real guest helper code with memory-only storage; no application imports.
  vm.runInContext(ts.transpileModule(read("client/src/lib/guestMode.ts"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  vm.runInContext(`(${click.getText(source)})();`, context);
  assert.deepEqual(navigations, ["/guest-builder"]);
  assert.equal(exports.isGuestMode(), true, "GuestBuilder's existing entry prerequisite is satisfied");
  assert.equal(storage.get("userId"), "existing-account");
  assert.equal(storage.get("authToken"), "existing-token");
  assert.equal(classify("/guest-builder", routes), "matched");
  assert.ok(!sourceText.includes("demo_user_"));
});
