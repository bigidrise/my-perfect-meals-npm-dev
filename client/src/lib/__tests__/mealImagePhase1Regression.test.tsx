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
import { render, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as fs from "fs";
import * as path from "path";
import { get, post } from "@/lib/api";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { ChefFlowImage } from "@/components/ChefFlowImage";

jest.mock("@/lib/api", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const ROOT = path.resolve(__dirname, "../../../..");
const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;

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

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Image unavailable");
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
    const { container } = render(<ChefFlowImage alt="Grilled Chicken Bowl" isLoading />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(container.textContent).not.toContain("Image unavailable");
  });

  it("onError enters terminal unavailable state and removes the shimmer", () => {
    const { container } = render(
      <ChefFlowImage src="https://storage.example.com/broken.png" alt="Burrito Bowl" />,
    );

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    fireEvent.error(container.querySelector("img")!);
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
  const files = ["server/routes/mealFinder.ts", "server/routes/restaurants.ts"];

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

// ── 6. Permanent Object Storage delivery failure recovery ────────────────────

describe("MealImageSlot — permanent URL recovery", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("reports a broken permanent URL and loads one regenerated replacement", async () => {
    const brokenUrl = "/public-objects/test-bucket/meal-images/broken-display.jpg";
    const restoredUrl = "/public-objects/test-bucket/meal-images/restored-display.jpg";
    mockPost
      .mockResolvedValueOnce({ status: "unavailable", reason: "missing" } as any)
      .mockResolvedValueOnce({ accepted: true, recoveryId: "recovery-1" } as any);
    mockGet.mockResolvedValue({ status: "ready", imageUrl: restoredUrl } as any);

    const { container } = render(
      <MealImageSlot
        imageUrl={brokenUrl}
        mealName="Grilled Salmon Bowl"
        ingredients={["salmon", "lemon", "brown rice"]}
        savedMealId="saved-meal-1"
        mediaAssetId="asset-1"
      />,
    );

    fireEvent.error(container.querySelector("img")!);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/media/image-delivery-recovery",
        { imageUrl: brokenUrl, savedMealId: "saved-meal-1", mediaAssetId: "asset-1" },
      );
      expect(mockPost).toHaveBeenCalledWith(
        "/api/meal-images/recover",
        expect.objectContaining({
          imageUrl: brokenUrl,
          mealName: "Grilled Salmon Bowl",
          ingredients: ["salmon", "lemon", "brown rice"],
          savedMealId: "saved-meal-1",
          mediaAssetId: "asset-1",
        }),
      );
    });

    await waitFor(() => {
      expect(container.querySelector("img")).toHaveAttribute("src", restoredUrl);
    });

    fireEvent.error(container.querySelector("img")!);
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Image unavailable");
  });

  it("does not report third-party image delivery failures as Object Storage repairs", () => {
    const { container } = render(
      <MealImageSlot
        imageUrl="https://storage.example.com/broken-cake.png"
        mealName="Chocolate Fudge Cake"
        ingredients={["cocoa", "flour"]}
      />,
    );

    fireEvent.error(container.querySelector("img")!);

    expect(mockPost).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Image unavailable");
  });

  it("retries a temporary Object Storage delivery failure once without queuing regeneration", async () => {
    const brokenUrl = "/public-objects/test-bucket/meal-images/transient.jpg";
    mockPost.mockResolvedValueOnce({ status: "retry", imageUrl: brokenUrl } as any);
    const { container } = render(
      <MealImageSlot imageUrl={brokenUrl} mealName="Temporary Salmon" savedMealId="saved-temporary" mediaAssetId="asset-temporary" />,
    );

    fireEvent.error(container.querySelector("img")!);

    await waitFor(() => {
      expect(container.querySelector("img")).toHaveAttribute("src", `${brokenUrl}?delivery-retry=1`);
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      "/api/media/image-delivery-recovery",
      { imageUrl: brokenUrl, savedMealId: "saved-temporary", mediaAssetId: "asset-temporary" },
    );
  });

  it("uses a surviving Object Storage variant without queuing regeneration", async () => {
    const brokenUrl = "/public-objects/test-bucket/meal-images/thumb.jpg";
    const displayUrl = "/public-objects/test-bucket/meal-images/display.jpg";
    mockPost.mockResolvedValueOnce({ status: "recovered", imageUrl: displayUrl } as any);
    const { container } = render(
      <MealImageSlot imageUrl={brokenUrl} mealName="Variant Salmon" savedMealId="saved-variant" mediaAssetId="asset-variant" />,
    );

    fireEvent.error(container.querySelector("img")!);

    await waitFor(() => {
      expect(container.querySelector("img")).toHaveAttribute("src", displayUrl);
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("ignores a completed old recovery after the server supplies a newer URL", async () => {
    const oldUrl = "/public-objects/test-bucket/meal-images/old.jpg";
    const newUrl = "/public-objects/test-bucket/meal-images/new.jpg";
    let resolveStatus!: (value: unknown) => void;
    mockPost
      .mockResolvedValueOnce({ status: "unavailable", reason: "missing" } as any)
      .mockResolvedValueOnce({ accepted: true, recoveryId: "old-recovery" } as any);
    mockGet.mockReturnValueOnce(new Promise((resolve) => { resolveStatus = resolve; }) as any);

    const { container, rerender } = render(
      <MealImageSlot imageUrl={oldUrl} mealName="Old Salmon" savedMealId="saved-old" mediaAssetId="asset-old" />,
    );
    fireEvent.error(container.querySelector("img")!);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    rerender(<MealImageSlot imageUrl={newUrl} mealName="New Salmon" savedMealId="saved-new" mediaAssetId="asset-new" />);
    resolveStatus({ status: "ready", imageUrl: "/public-objects/test-bucket/meal-images/stale-recovered.jpg" });

    await waitFor(() => {
      expect(container.querySelector("img")).toHaveAttribute("src", newUrl);
      expect(container.querySelector("img")).not.toHaveAttribute("src", "/public-objects/test-bucket/meal-images/stale-recovered.jpg");
    });
  });

  it("ignores an old recovery when a reused image URL belongs to a different saved meal", async () => {
    const sharedUrl = "/public-objects/test-bucket/meal-images/shared.jpg";
    let resolveStatus!: (value: unknown) => void;
    mockPost
      .mockResolvedValueOnce({ status: "unavailable", reason: "missing" } as any)
      .mockResolvedValueOnce({ accepted: true, recoveryId: "shared-recovery" } as any);
    mockGet.mockReturnValueOnce(new Promise((resolve) => { resolveStatus = resolve; }) as any);

    const { container, rerender } = render(
      <MealImageSlot imageUrl={sharedUrl} mealName="First Salmon" savedMealId="saved-first" mediaAssetId="asset-first" />,
    );
    fireEvent.error(container.querySelector("img")!);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    rerender(
      <MealImageSlot imageUrl={sharedUrl} mealName="Second Salmon" savedMealId="saved-second" mediaAssetId="asset-second" />,
    );
    await waitFor(() => expect(container.querySelector("img")).toHaveAttribute("src", sharedUrl));
    resolveStatus({ status: "ready", imageUrl: "/public-objects/test-bucket/meal-images/first-only-recovered.jpg" });

    await waitFor(() => {
      expect(container.querySelector("img")).toHaveAttribute("src", sharedUrl);
      expect(container.querySelector("img")).not.toHaveAttribute("src", "/public-objects/test-bucket/meal-images/first-only-recovered.jpg");
    });
  });

  it("reports a broken permanent S3 image URL for the same durable repair path", async () => {
    const brokenUrl = "https://archived-meal-images.s3.amazonaws.com/meal-images/legacy.jpg";
    mockPost.mockResolvedValue({ accepted: true, recoveryId: "legacy-recovery" } as any);
    mockGet.mockResolvedValue({ status: "ready", imageUrl: "/public-objects/test-bucket/repaired.jpg" } as any);

    const { container } = render(
      <MealImageSlot
        imageUrl={brokenUrl}
        mealName="Legacy Salmon Bowl"
        ingredients={["salmon", "rice"]}
        savedMealId="saved-meal-legacy"
        mediaAssetId="asset-legacy"
      />,
    );

    fireEvent.error(container.querySelector("img")!);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/meal-images/recover",
        expect.objectContaining({ imageUrl: brokenUrl, savedMealId: "saved-meal-legacy", mediaAssetId: "asset-legacy" }),
      );
      expect(container.querySelector("img")).toHaveAttribute("src", "/public-objects/test-bucket/repaired.jpg");
    });
  });
});

// ── 7. No hardcoded Unsplash URLs remain (static source scan) ───────────────

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
    expect(fs.existsSync(path.join(ROOT, "shared/staticSnackMappings.ts"))).toBe(true);
  });
});