/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { chefResponseText } from "@/components/coaching/chefResponseText";

test("registry feature names are bold without model Markdown", () => {
  const { container } = render(<>{chefResponseText(
    "Restaurant Assistant and Beverage Creator are available. Your Meal Builders page retains access checks.", true, true)}</>);
  expect([...container.querySelectorAll("strong")].map(node => node.textContent))
    .toEqual(["Restaurant Assistant", "Beverage Creator", "Meal Builders"]);
});
test("ordinary words and substrings are not emphasized", () => {
  const { container } = render(<>{chefResponseText("A beverage creatorish tool, meals and dinner.", true, true)}</>);
  expect(container.querySelector("strong")).toBeNull();
});
test("explicit Markdown and plain formatting are preserved without nested strong elements", () => {
  const { container } = render(<>{chefResponseText("**Beverage Creator**\n* ordinary item\n*Restaurant Assistant*", true, true)}</>);
  expect(container.querySelector("strong strong")).toBeNull();
  expect(container.querySelector("em strong")?.textContent).toBe("Restaurant Assistant");
  expect(container.textContent).toContain("• ordinary item");
  expect(screen.getByText("Beverage Creator").tagName).toBe("STRONG");
});
test("formatting never creates executable links or HTML", () => {
  const { container } = render(<>{chefResponseText('<img src=x onerror=alert(1)> [Beverage Creator](https://example.com)', true, true)}</>);
  expect(container.querySelector("img,a")).toBeNull();
  expect(container.textContent).toContain("<img");
});
