/**
 * @jest-environment jsdom
 *
 * Phase 1 image-architecture regression suite
 *
 * Guarantees after removing semantic misinformation:
 *  1. A broken image URL NEVER results in another food's photo (no Unsplash
 *     substitution) — a neutral "Image unavailable" state renders instead.
 *  2. Loading and unavailable states are visually distinct.
 *  3. ChefFlowImage reaches a TERMINAL unavailable state on error — never an
 *     infinite shimmer.
 *  4. Successful generated images still render normally.
 *  5. No hardcoded Unsplash URLs remain in the three server generators or the
 *     Phase 1 client files.
 */

import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as fs from "fs";
import * as path from "path";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { ChefFlowImage } from "@/components/ChefFlowImage";

const ROOT = path.resolve(__dirname, "../../../..");

// ── 1. Broken URLs never show another food ───────────────────────────────────

describe("MealImageSlot — broken image never becomes another food", () => {
  const cases: Array<[string, string]> = [
    ["Chocolate Fudge Cake", "https://storage.example.com/broken-cake.png"],
    ["Spicy Tuna Sushi Roll", "https://storage.example.com/broken-sushi.png"],
    ["Iced Matcha Latte", "https://storage.example.com/broken-beverage.png"],
  ];

  it.each(cases)("%s: onError renders neutral unavailable state, no substitute image", (mealName, url) => {
    const { container } = render(<MealImageSlot imageUrl={url} mealName={mealName} />);

    const img = container.querySelector("img")!;
    expect(img).toBeInTheDocument();
    fireEvent.error(img);

    // After error: no <img> remains at all — nothing to substitute with
    expect(container.querySelector("img")).toBeNull();
    // Neutral unavailable state is shown
    expect(container.textContent).toContain("Image unavailable");
    // No Unsplash URL anywhere in the rendered output
    expect(container.innerHTML).not.toContain("unsplash");
  });

  it("missing imageUrl renders unavailable state immediately (no stock image)", () => {
    const { container } = render(<MealImageSlot imageUrl={null} mealName="Grilled Salmon Bowl" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Image unavailable");
    expect(container.innerHTML).not.toContain("unsplash");
  });
});

// ── 2. Loading vs unavailable are distinct ───────────────────────────────────

describe("MealImageSlot — loading and unavailable states are distinct", () => {
  it("isLoading shows generating state, not unavailable", () => {
    const { container } = render(
      <MealImageSlot imageUrl={null} mealName="Pasta Primavera" isLoading />,
    );
    expect(container.textContent).toContain("Generating image");
    expect(container.textContent).not.toContain("Image unavailable");
  });

  it("not loading + no url shows unavailable, not generating", () => {
    const { container } = render(
      <MealImageSlot imageUrl={null} mealName="Pasta Primavera" isLoading={false} />,
    );
    expect(container.textContent).toContain("Image unavailable");
    expect(container.textContent).not.toContain("Generating image");
  });
});

// ── 3. ChefFlowImage terminal unavailable state ──────────────────────────────

describe("ChefFlowImage — terminal unavailable state (no infinite shimmer)", () => {
  it("shows a shimmer while a background request is still generating an image", () => {
    const { container } = render(
      <ChefFlowImage alt="Grilled Chicken Bowl" isLoading />,
    );

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(container.textContent).not.toContain("Image unavailable");
  });

  it("onError enters terminal unavailable state and removes the shimmer", () => {
    const { container } = render(
      <ChefFlowImage src="https://storage.example.com/broken.png" alt="Burrito Bowl" />,
    );

    // Before error: shimmer present while loading
    expect(container.querySelector(".animate-pulse")).not.toBeNull();

    fireEvent.error(container.querySelector("img")!);

    // After error: shimmer gone, terminal unavailable state shown, no img
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Image unavailable");
    expect(container.innerHTML).not.toContain("unsplash");
  });

  it("successful load renders the actual image", () => {
    const { container } = render(
      <ChefFlowImage src="https://storage.example.com/good.png" alt="Taco Salad" />,
    );
    const img = container.querySelector("img")!;
    fireEvent.load(img);
    expect(img).toHaveClass("opacity-100");
    expect(container.textContent).not.toContain("Image unavailable");
  });
});

// ── 4. Restaurant endpoints leave image enrichment to the client ─────────────

describe("Restaurant image enrichment — non-blocking endpoint contract", () => {
  const files = [
    "server/routes/mealFinder.ts",
    "server/routes/restaurants.ts",
  ];

  it.each(files)("%s does not generate images before returning recommendations", (rel) => {
    const content = fs.readFileSync(path.join(ROOT, rel), "utf-8");
    expect(content).not.toContain("generateMealImageUnified");
  });
});

// ── 5. Successful generated images still render ──────────────────────────────

describe("MealImageSlot — successful image path unchanged", () => {
  it("renders the generated image and reveals it on load", () => {
    const url = "/public-objects/meal-images/abc123.png";
    const { container } = render(<MealImageSlot imageUrl={url} mealName="Chicken Stir Fry" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", url);
    fireEvent.load(img);
    expect(img).toHaveClass("opacity-100");
  });
});

// ── 6. No hardcoded Unsplash URLs remain (static source scan) ───────────────

describe("Source scan — no hardcoded Unsplash meal images remain", () => {
  const filesThatMustBeClean = [
    "server/services/pregnancyNutritionGenerator.ts",
    "server/services/testosteroneNutritionGenerator.ts",
    "server/medicalPersonalizationService.ts",
    "client/src/components/ui/MealImageSlot.tsx",
    "client/src/lib/mealFallbackImage.ts",
    "client/src/components/MealCard.tsx",
    "client/src/components/WeeklyMealCard.tsx",
    "client/src/components/ChefFlowImage.tsx",
    "client/src/pages/home.tsx",
  ];

  it.each(filesThatMustBeClean.filter((rel) => fs.existsSync(path.join(ROOT, rel))))("%s contains no images.unsplash.com URL", (rel) => {
    const content = fs.readFileSync(path.join(ROOT, rel), "utf-8");
    expect(content).not.toContain("images.unsplash.com");
  });

  it("three server generators call the canonical image pipeline", () => {
    for (const rel of [
      "server/services/pregnancyNutritionGenerator.ts",
      "server/services/testosteroneNutritionGenerator.ts",
      "server/medicalPersonalizationService.ts",
    ]) {
      const content = fs.readFileSync(path.join(ROOT, rel), "utf-8");
      expect(content).toContain("generateMealImageUnified");
    }
  });

  it("intentional static snack SVG mapping is preserved", () => {
    const p = path.join(ROOT, "shared/staticSnackMappings.ts");
    expect(fs.existsSync(p)).toBe(true);
  });
});
