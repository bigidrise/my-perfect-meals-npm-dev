import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.join(process.cwd(), "client/src/pages/ShoppingListResponsive.css"), "utf8");

describe("Shopping product presentation", () => {
  it("bounds the loading and results picker inside both iOS safe areas", () => {
    expect(css).toContain("--shopping-picker-safe-top: calc(env(safe-area-inset-top, 0px) + 1rem)");
    expect(css).toContain("--shopping-picker-safe-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem)");
    expect(css).toContain("top: calc((100dvh + var(--shopping-picker-safe-top) - var(--shopping-picker-safe-bottom)) / 2)");
    expect(css).toContain("max-height: min(90vh, calc(100dvh - var(--shopping-picker-safe-top) - var(--shopping-picker-safe-bottom)))");
  });

  it("provides bright borders and text over dark backgrounds for the row controls", () => {
    const controls = css.match(/\.shopping-list-page \.shopping-product-options-button,\s*\.shopping-list-page \.shopping-product-choice-action \{([^}]*line-height[^}]*)\}/)?.[1];
    expect(controls).toContain("color: #fff");
    expect(controls).toContain("border-color: rgba(255, 255, 255, 0.8)");
    expect(controls).toContain("background-color: rgba(0, 0, 0, 0.5)");
    expect(css).toContain(".shopping-product-choice-action:focus-visible");
    expect(css).toContain(".shopping-product-choice-action:disabled");
  });

  it("makes the needed amount readable without replacing the quantity formatter", () => {
    expect(css).toMatch(/\.shopping-list-page \.shopping-quantity \{[^}]*color: #fff;[^}]*background-color: rgba\(0, 0, 0, 0\.5\)/);
  });
});
