/** @jest-environment jsdom */
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { dessertYieldOptions } from "@shared/dessertYields";

// Execute the real page JSX/callbacks in an isolated harness. Never import the
// pages' account, database, image, speech, or paid-generation dependencies.
const creators = [
  { id: "craving", file: "craving-creator.tsx", state: "cravingCategory", setter: "setCravingCategory", selected: "surprise", other: "pizza-flatbreads", generate: "handleGenerateMeal" },
  { id: "dessert", file: "CravingDessertCreator.tsx", state: "dessertCategory", setter: "setDessertCategory", selected: "surprise", other: "cake", generate: "handleGenerateDessert" },
  { id: "beverage", file: "BeverageCreator.tsx", state: "beverageCategory", setter: "setBeverageCategory", selected: "surprise", other: "tea", generate: "handleGenerateBeverage" },
  { id: "sushi", file: "SushiCreator.tsx", state: "sushiStyle", setter: "setSushiStyle", selected: "chef choice", other: "roll", generate: "handleGenerateMeal" },
] as const;
type Creator = typeof creators[number];

function sourceFor(creator: Creator) {
  return ts.createSourceFile(creator.file, readFileSync(path.join(process.cwd(), "client/src/pages", creator.file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function findNode(source: ts.SourceFile, predicate: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (!found && predicate(node)) found = node;
    if (!found) ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) throw new Error(`Missing source contract in ${source.fileName}`);
  return found;
}

function evaluate(text: string, scope: Record<string, unknown>) {
  const compiled = ts.transpileModule(`return (${text.replaceAll("import.meta.env.DEV", "true")});`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return new Function(...Object.keys(scope), compiled)(...Object.values(scope));
}

function callback(source: ts.SourceFile, name: string, scope: Record<string, unknown>) {
  const node = findNode(source, node =>
    (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name?.getText(source) === name);
  const expression = ts.isVariableDeclaration(node) ? node.initializer!.getText(source) : node.getText(source);
  return evaluate(expression, scope);
}

function buttonExpression(source: ts.SourceFile, creator: Creator) {
  const node = findNode(source, node => ts.isJsxElement(node) &&
    node.openingElement.attributes.properties.some(prop => ts.isJsxAttribute(prop) &&
      prop.name.getText(source) === "data-testid" && prop.initializer?.getText(source) === `"${creator.id}-surprise-me"`));
  let parent: ts.Node = node;
  while (!ts.isJsxExpression(parent)) parent = parent.parent;
  return parent.expression!.getText(source).replaceAll("import.meta.env.DEV", "development");
}

function originalSelection(source: ts.SourceFile, creator: Creator, scope: Record<string, unknown>) {
  if (creator.id === "sushi") {
    const node = findNode(source, node => ts.isJsxAttribute(node) &&
      node.name.getText(source) === "onClick" && node.getText(source).includes('setSushiStyle(sushiStyle === value'));
    return evaluate((node as ts.JsxAttribute).initializer!.getText(source).slice(1, -1), { ...scope, value: creator.other });
  }
  const select = findNode(source, node => ts.isJsxElement(node) &&
    node.openingElement.tagName.getText(source) === "Select" &&
    node.openingElement.attributes.properties.some(prop => ts.isJsxAttribute(prop) &&
      prop.name.getText(source) === "value" && prop.getText(source).includes(creator.state))) as ts.JsxElement;
  const change = select.openingElement.attributes.properties.find(prop =>
    ts.isJsxAttribute(prop) && prop.name.getText(source) === "onValueChange") as ts.JsxAttribute;
  return evaluate(change.initializer!.getText(source).slice(1, -1), scope);
}

let host: HTMLDivElement;
let root: Root;
let network: jest.Mock;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  network = jest.fn(() => { throw new Error("Unexpected network request"); });
  globalThis.fetch = network;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function mount(creator: Creator, options: { generating?: boolean; safety?: boolean; development?: boolean } = {}) {
  const source = sourceFor(creator);
  const yieldChanges = jest.fn();
  const generate = jest.fn();
  function Harness() {
    const [selection, setSelection] = useState<string>("");
    const [yieldValue, setYield] = useState("member-chosen-yield");
    const [description, setDescription] = useState("My typed idea");
    const scope: Record<string, unknown> = {
      React, development: options.development ?? true,
      [creator.state]: selection, [creator.setter]: setSelection,
      isGenerating: options.generating ?? false, safetyChecking: options.safety ?? false,
      cakeType: "standard", dessertYieldOptions,
      setServingSize: (value: string) => { yieldChanges(value); setYield(value); },
      GlassButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
    };
    if (creator.id === "dessert") scope.handleCategoryChange = callback(source, "handleCategoryChange", scope);
    const select = originalSelection(source, creator, scope);
    return (
      <form onSubmit={event => { event.preventDefault(); generate(); }}>
        <textarea value={description} onChange={event => setDescription(event.target.value)} />
        {evaluate(buttonExpression(source, creator), scope)}
        <button type="button" onClick={() => setDescription("Voice input")}>Voice</button>
        <select aria-label="Existing choice" value={selection} onChange={event => select(event.target.value)}>
          <option value="">None</option>
          <option value={creator.selected}>Surprise</option>
          <option value={creator.other}>Other</option>
        </select>
        <input aria-label="Flavor" defaultValue="member flavor" />
        <input aria-label="Ingredients" defaultValue="member ingredients" />
        <input aria-label="Diet" defaultValue="member diet" />
        <button type="button" onClick={() => setYield("member-custom-yield")}>Customize yield</button>
        <output>{yieldValue}</output>
      </form>
    );
  }
  act(() => root.render(<Harness />));
  return { source, yieldChanges, generate, button: () => host.querySelector<HTMLButtonElement>(`[data-testid="${creator.id}-surprise-me"]`)! };
}

describe.each(creators)("$id Surprise Me", creator => {
  test("selects existing state without submitting, requesting, clearing text, or changing preferences", () => {
    const { button, generate } = mount(creator);
    const before = [...host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea,input")].map(input => input.value);
    act(() => button().click());
    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(button().textContent).toContain("Selected");
    expect(host.querySelector("select")!.value).toBe(creator.selected);
    expect([...host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea,input")].map(input => input.value)).toEqual(before);
    expect(network).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(button().type).toBe("button");
  });

  test("the original dropdown/style callback clears and restores the selected appearance", () => {
    const { button } = mount(creator);
    act(() => button().click());
    const select = host.querySelector("select")!;
    act(() => { select.value = creator.other; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(button().getAttribute("aria-pressed")).toBe("false");
    expect(button().textContent).not.toContain("Selected");
    expect(button().className).not.toContain("border-orange-300");
    if (creator.id !== "sushi") {
      act(() => { select.value = creator.selected; select.dispatchEvent(new Event("change", { bubbles: true })); });
      expect(button().getAttribute("aria-pressed")).toBe("true");
    } else {
      act(() => button().click());
      expect(select.value).toBe("chef choice");
    }
  });

  test("repeated clicks retain selection and a customized yield", () => {
    const { button, yieldChanges } = mount(creator);
    act(() => button().click());
    if (creator.id === "dessert") {
      expect(yieldChanges).toHaveBeenCalledWith(dessertYieldOptions("surprise")[0].value);
      expect(yieldChanges).toHaveBeenCalledTimes(1);
    }
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Customize yield")!.click());
    act(() => { button().click(); button().click(); });
    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector("output")!.textContent).toBe("member-custom-yield");
    expect(yieldChanges).toHaveBeenCalledTimes(creator.id === "dessert" ? 1 : 0);
    expect(network).not.toHaveBeenCalled();
  });

  test.each([{ generating: true }, { safety: true }])("is disabled during processing %j", options => {
    const { button } = mount(creator, options);
    expect(button().disabled).toBe(true);
    act(() => button().click());
    expect(button().getAttribute("aria-pressed")).toBe("false");
    expect(network).not.toHaveBeenCalled();
  });

  test("is not exposed in a Production build", () => {
    const { button } = mount(creator, { development: false });
    expect(button()).toBeNull();
  });

  test("uses responsive full-width/mobile, intrinsic desktop, and touch-target classes", () => {
    const { button } = mount(creator);
    expect(button().classList.contains("w-full")).toBe(true);
    expect(button().classList.contains("sm:w-auto")).toBe(true);
    expect(button().classList.contains("min-h-11")).toBe(true);
  });

  test("the existing request body still uses the category/style and safety/access fields", () => {
    const source = sourceFor(creator);
    const payload = findNode(source, node => (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
      node.name.getText(source) === (creator.id === "sushi" ? "cravingInput" : creator.state) &&
      ts.isObjectLiteralExpression(node.parent) &&
      node.parent.getText(source).includes("safetyMode")) as ts.PropertyAssignment | ts.ShorthandPropertyAssignment;
    expect(ts.isPropertyAssignment(payload) ? payload.initializer.getText(source) : payload.name.getText(source)).toContain(creator.state);
    const body = payload.parent.getText(source);
    expect(body).toContain("overrideToken");
    expect(body).toContain("dietOverride");
    expect(source.getText()).toContain("checkSafety(");
    expect(source.getText()).toContain("checkDiet(");
    expect(source.getText()).toContain("VoiceInputButton");
  });
});

test.each(creators.filter(creator => creator.id === "dessert" || creator.id === "beverage"))(
  "$id still rejects an empty description with Surprise Me but no flavor",
  async creator => {
    const toast = jest.fn();
    const scope: Record<string, unknown> = {
      user: { id: "synthetic-user" }, customBeverageDescription: "",
      beverageCategory: "surprise", dessertCategory: "surprise", flavorFamily: "",
      customDessertDescription: "", specificDessert: "",
      customDessertDescriptionRef: { current: null }, specificDessertRef: { current: null },
      continueAnywayRef: { current: false },
      captureAuthoritativeTextValue: async (_ref: unknown, value: string) => value,
      setDietAdaptedNotice: jest.fn(), toast,
    };
    await callback(sourceFor(creator), creator.generate, scope)();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/flavor family/i) }));
    expect(network).not.toHaveBeenCalled();
  },
);
