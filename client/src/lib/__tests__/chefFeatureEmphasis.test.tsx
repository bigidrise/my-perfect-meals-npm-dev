/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { chefResponseText } from "@/components/coaching/chefResponseText";

function render(text: string, enabled = true, features = true) {
  const host = document.createElement("div");
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(host);
  act(() => root.render(<>{chefResponseText(text, enabled, features)}</>));
  const snapshot = host.cloneNode(true) as HTMLElement;
  act(() => root.unmount());
  return snapshot;
}

test("all requested verified feature names are semantic bold without model Markdown", () => {
  const names = ["Beverage Creator", "Fridge Rescue", "Shopping List", "Meal Builders",
    "My Perfect Menu", "Restaurant Guide", "Find Meals Near Me", "Craving Creator"];
  const text = names.join(", ");
  const host = render(text);
  expect([...host.querySelectorAll("strong")].map(node => node.textContent)).toEqual(names);
  expect(host.textContent).toBe(text);
  expect(host.querySelector("a, img, script")).toBeNull();
});
test("longest names win without nesting Beverage Creator inside Athlete Beverage Creator", () => {
  const host = render("Athlete Beverage Creator and Beverage Creator.");
  expect([...host.querySelectorAll("strong")].map(node => node.textContent))
    .toEqual(["Athlete Beverage Creator", "Beverage Creator"]);
  expect(host.querySelector("strong strong")).toBeNull();
});
test.each(["**Beverage Creator**", "__Beverage Creator__", "*Beverage Creator*"])(
  "existing safe inline emphasis composes with feature highlighting: %s", text => {
    const host = render(text);
    expect(host.textContent).toBe("Beverage Creator");
    expect(host.querySelectorAll("strong")).toHaveLength(1);
    expect(host.querySelector("strong strong")).toBeNull();
  });
test("unknown names and substrings do not acquire registry emphasis", () => {
  const text = "SuperBeverage CreatorX, Fake Creator and Beverage Creator.";
  const host = render(text);
  expect([...host.querySelectorAll("strong")].map(node => node.textContent)).toEqual(["Beverage Creator"]);
  expect(host.textContent).toBe(text);
});
test("HTML, links and script-like content remain inert text", () => {
  const text = '<img src=x onerror="alert(1)"> [Beverage Creator](javascript:alert(1))';
  const host = render(text);
  expect(host.querySelector("img, a, script")).toBeNull();
  expect(host.textContent).toBe(text);
  expect(host.querySelector("strong")?.textContent).toBe("Beverage Creator");
});
test("the disabled Development feature gate preserves existing non-feature rendering", () => {
  expect(render("Beverage Creator", true, false).querySelector("strong")).toBeNull();
  expect(render("Beverage Creator", false, true).querySelector("strong")).toBeNull();
  expect(render("**Beverage Creator**", true, false).querySelectorAll("strong")).toHaveLength(1);
});
